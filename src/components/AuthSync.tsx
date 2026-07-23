"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { usePlanStore, type Plan } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { resolveHome, isKnownCity } from "@/lib/resolveHome";
import { fetchProfileEmails } from "@/lib/supabase/profiles";
import { planToInsertRow, rowToPlan, savePlanData, type PlanRow } from "@/lib/supabase/sharing";
import { fetchUserSettings, saveUserSettings, rowToOnboardingValues } from "@/lib/supabase/settings";

interface SyncResult {
  succeeded: string[];
  failed: string[];
}

/** Inserts brand-new plans (never synced -- no ownerId yet) and pushes
 * content edits for already-synced plans through update_plan_data (so
 * owner-or-collaborator RLS applies correctly and last_edited_by/at get
 * stamped). Patches each local plan with whatever sharing/edit metadata
 * comes back. Returns which plan ids made it and which didn't (offline,
 * etc.) so the caller can queue failures for a later retry. Shared by the
 * initial post-sign-in merge, the ongoing write-through sync, and the
 * offline-queue flush below. */
async function syncPlansUp(supabase: SupabaseClient, userId: string, plans: Plan[]): Promise<SyncResult> {
  const brandNew = plans.filter((p) => !p.ownerId);
  const existing = plans.filter((p) => p.ownerId);
  const succeeded: string[] = [];
  const failed: string[] = [];

  if (brandNew.length) {
    const { data, error } = await supabase
      .from("plans")
      .insert(brandNew.map((p) => planToInsertRow(userId, p)))
      .select();
    if (error) {
      console.error("Failed to create plan(s) in Supabase", error);
      failed.push(...brandNew.map((p) => p.id));
    } else if (data) {
      const rows = data as PlanRow[];
      const emails = await fetchProfileEmails(supabase, rows.map((r) => r.user_id));
      const returnedIds = new Set<string>();
      rows.forEach((row) => {
        const p = rowToPlan(row, emails);
        usePlanStore.getState().patchPlan(row.id, {
          ownerId: p.ownerId,
          shareViewToken: p.shareViewToken,
          shareCollabToken: p.shareCollabToken,
          collaboratorIds: p.collaboratorIds,
        });
        returnedIds.add(row.id);
        succeeded.push(row.id);
      });
      brandNew.forEach((p) => {
        if (!returnedIds.has(p.id)) failed.push(p.id);
      });
    }
  }

  await Promise.all(
    existing.map(async (p) => {
      const updated = await savePlanData(supabase, p.id, p.name, {
        home: p.home,
        bag: p.bag,
        budget: p.budget,
        placements: p.placements,
        created: p.created,
        updated: p.updated,
        semester: p.semester,
      });
      if (updated) {
        usePlanStore.getState().patchPlan(p.id, {
          lastEditedBy: updated.lastEditedBy,
          lastEditedAt: updated.lastEditedAt,
        });
        succeeded.push(p.id);
      } else {
        failed.push(p.id);
      }
    })
  );

  return { succeeded, failed };
}

/** Retries whatever's still queued in pendingSyncIds (edits made while
 * offline -- most commonly a booked actual typed in on a train). Plans that
 * got deleted locally before ever syncing just get dropped from the queue,
 * nothing to retry. */
async function flushPendingSync(supabase: SupabaseClient, userId: string) {
  const ids = usePlanStore.getState().pendingSyncIds;
  if (!ids.length) return;

  const plans = usePlanStore.getState().plans;
  const toRetry = ids.map((id) => plans[id]).filter((p): p is Plan => !!p && !p.readOnly);
  const gone = ids.filter((id) => !plans[id]);
  if (gone.length) usePlanStore.getState().clearPendingSync(gone);
  if (!toRetry.length) return;

  const { succeeded } = await syncPlansUp(supabase, userId, toRetry);
  if (succeeded.length) usePlanStore.getState().clearPendingSync(succeeded);
}

/** Mounted once in the root layout. Tracks Supabase auth state, merges local
 * plans into the account on sign-in (both plans you own and ones you
 * collaborate on), keeps Postgres in sync with localStorage (the offline
 * cache / source of truth for anonymous use) afterwards, and queues +
 * retries any edit that fails to sync while offline. */
export default function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const mergedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    /** Phase 6: pulls the account's onboarding answers (if any) so this
     * device's plan defaults + custom home city match what was set up
     * elsewhere, and sends a never-onboarded account to /onboarding once.
     * Runs after the plan merge above so a redirect doesn't race it.
     *
     * Phase 9 step 3: if there's no Supabase row yet but this device already
     * completed the anonymous setup wizard (defaultHome is set locally),
     * push those local answers up as the account's first user_settings row
     * instead of forcing a fresh /onboarding redirect that would make them
     * re-answer questions they already answered. Host/home university are
     * left blank on this path -- the local wizard doesn't collect them any
     * differently than the signed-in one does (both treat them as
     * optional), and this is disclosed in CLAUDE.md, not a silent gap. */
    async function checkOnboarding(userId: string) {
      const row = await fetchUserSettings(supabase, userId);
      if (!row) {
        const { defaultHome, defaultSemester, defaultStudyingInEurope, defaultCurrency } = usePlanStore.getState();
        if (defaultHome) {
          const resolved = resolveHome(defaultHome);
          const host = resolved ? { city: defaultHome, country: resolved.country ?? "", lat: resolved.lat, lon: resolved.lon } : null;
          if (host && defaultSemester) {
            await saveUserSettings(
              supabase,
              userId,
              {
                host,
                hostUniversity: "",
                homeUniversity: "",
                term: "spring",
                semester: defaultSemester,
                studyingInEurope: defaultStudyingInEurope,
                currency: defaultCurrency,
              },
              false
            );
            return;
          }
        }
        if (window.location.pathname !== "/onboarding") router.push("/onboarding");
        return;
      }
      const values = rowToOnboardingValues(row);
      if (!isKnownCity(values.host.city)) {
        useCustomHomesStore.getState().addHome(values.host.city, {
          lat: values.host.lat,
          lon: values.host.lon,
          country: values.host.country,
        });
      }
      usePlanStore.getState().setOnboardingDefaults(values.host.city, values.semester, values.studyingInEurope, values.currency);
      if (!row.onboarded_at && window.location.pathname !== "/onboarding") router.push("/onboarding");
    }

    async function mergeOnSignIn(userId: string) {
      const [owned, collaborated] = await Promise.all([
        supabase.from("plans").select("*").eq("user_id", userId),
        supabase.from("plans").select("*").contains("collaborator_ids", [userId]),
      ]);
      if (owned.error || collaborated.error) {
        console.error("Failed to fetch plans from Supabase", owned.error ?? collaborated.error);
        return;
      }

      const rows = [...(owned.data ?? []), ...(collaborated.data ?? [])] as PlanRow[];
      const emails = await fetchProfileEmails(
        supabase,
        rows.flatMap((r) => [r.user_id, r.last_edited_by, ...(r.collaborator_ids ?? [])].filter((x): x is string => !!x))
      );
      const remotePlans = rows.map((row) => rowToPlan(row, emails));
      const remoteIds = new Set(remotePlans.map((p) => p.id));

      const toUploadIds = usePlanStore.getState().mergeRemote(remotePlans);
      usePlanStore.getState().setUserId(userId);

      // mergeRemote keeps the local version whenever it's newer, which for
      // plans that already exist remotely means the sharing metadata
      // (ownerId, tokens, collaborators) from the server got dropped --
      // patch it back in before pushing the newer content up.
      toUploadIds.forEach((id) => {
        if (!remoteIds.has(id)) return;
        const remote = remotePlans.find((p) => p.id === id)!;
        usePlanStore.getState().patchPlan(id, {
          ownerId: remote.ownerId,
          shareViewToken: remote.shareViewToken,
          shareCollabToken: remote.shareCollabToken,
          collaboratorIds: remote.collaboratorIds,
        });
      });

      if (toUploadIds.length) {
        const plans = usePlanStore.getState().plans;
        const { failed } = await syncPlansUp(supabase, userId, toUploadIds.map((id) => plans[id]));
        if (failed.length) usePlanStore.getState().markPendingSync(failed);
      }

      // pick up anything that was queued from a previous offline session
      flushPendingSync(supabase, userId);

      checkOnboarding(userId);
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUser(user);
      if (user && !mergedRef.current) {
        mergedRef.current = true;
        mergeOnSignIn(user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setUser(user);
      if (event === "SIGNED_IN" && user && !mergedRef.current) {
        mergedRef.current = true;
        mergeOnSignIn(user.id);
      }
      if (event === "SIGNED_OUT") {
        mergedRef.current = false;
        usePlanStore.getState().setUserId(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [setUser, router]);

  // write-through: push plan changes to Postgres while signed in
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = usePlanStore.subscribe((state, prevState) => {
      const userId = state.userId;
      if (!userId || state.plans === prevState.plans) return;

      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const prev = prevState.plans;
        const next = state.plans;

        const changed = Object.values(next).filter((p) => prev[p.id] !== p && !p.readOnly);
        if (changed.length) {
          const { succeeded, failed } = await syncPlansUp(supabase, userId, changed);
          if (succeeded.length) usePlanStore.getState().clearPendingSync(succeeded);
          // offline (or any other failure) -- queue for retry rather than
          // silently dropping the edit; local data is already safe in
          // localStorage either way
          if (failed.length) usePlanStore.getState().markPendingSync(failed);
        }

        // only the owner's own deletions propagate -- a collaborator
        // removing their local copy of a shared plan just drops it locally
        // (leaving a collaboration isn't wired up yet, see CLAUDE.md)
        const deletions = Object.keys(prev).filter((id) => !next[id] && prev[id].ownerId === userId);
        if (deletions.length) {
          const { error } = await supabase.from("plans").delete().in("id", deletions);
          if (error) console.error("Failed to delete synced plan(s)", error);
        }
      }, 600);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // retry the offline queue on reconnect -- 'online' fires most of the
  // time, but a periodic fallback covers the cases (common in installed
  // PWAs) where it doesn't
  useEffect(() => {
    const supabase = createClient();

    const tryFlush = () => {
      const userId = usePlanStore.getState().userId;
      if (userId && navigator.onLine) flushPendingSync(supabase, userId);
    };

    window.addEventListener("online", tryFlush);
    const interval = setInterval(tryFlush, 30_000);
    tryFlush();

    return () => {
      window.removeEventListener("online", tryFlush);
      clearInterval(interval);
    };
  }, []);

  return null;
}
