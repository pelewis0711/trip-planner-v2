"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { usePlanStore, type Plan } from "@/lib/store/plan";

interface PlanRow {
  id: string;
  name: string;
  data: Omit<Plan, "id" | "name">;
}

function rowToPlan(row: PlanRow): Plan {
  return { id: row.id, name: row.name, ...row.data };
}

function planToRow(userId: string, p: Plan) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    data: {
      home: p.home,
      bag: p.bag,
      budget: p.budget,
      placements: p.placements,
      created: p.created,
      updated: p.updated,
    },
    updated_at: new Date(p.updated).toISOString(),
  };
}

/** Mounted once in the root layout. Tracks Supabase auth state, merges local
 * plans into the account on sign-in, and keeps Postgres in sync with
 * localStorage (the offline cache / source of truth for anonymous use)
 * afterwards. */
export default function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const mergedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    async function mergeOnSignIn(userId: string) {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, data")
        .eq("user_id", userId);
      if (error) {
        console.error("Failed to fetch plans from Supabase", error);
        return;
      }
      const toUpload = usePlanStore
        .getState()
        .mergeRemote((data ?? []).map(rowToPlan));
      usePlanStore.getState().setUserId(userId);

      if (toUpload.length) {
        const plans = usePlanStore.getState().plans;
        const rows = toUpload.map((id) => planToRow(userId, plans[id]));
        const { error: upsertError } = await supabase.from("plans").upsert(rows);
        if (upsertError) console.error("Failed to upload local plans", upsertError);
      }
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
  }, [setUser]);

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

        const upserts = Object.values(next)
          .filter((p) => prev[p.id] !== p)
          .map((p) => planToRow(userId, p));
        const deletions = Object.keys(prev).filter((id) => !next[id]);

        if (upserts.length) {
          const { error } = await supabase.from("plans").upsert(upserts);
          if (error) console.error("Failed to sync plan(s) to Supabase", error);
        }
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

  return null;
}
