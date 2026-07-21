"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCustomTripsStore } from "@/lib/store/customTrips";
import type { Trip } from "@/data/trips";

interface CustomTripRow {
  id: string;
  data: Trip;
}

/** Mounted once in the root layout, alongside AuthSync. Discovered trips are
 * always owner-only (no sharing), so this is much simpler than the plan
 * sync: merge remote on sign-in, push new local ones up, push
 * removals/additions through as they happen. Best-effort -- no offline
 * retry queue like the plan store has, since losing a sync here just means
 * re-approving a discovery, not losing real trip-planning work. */
export default function CustomTripsSync() {
  const mergedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    async function mergeOnSignIn(userId: string) {
      const { data, error } = await supabase
        .from("custom_trips")
        .select("id, data")
        .eq("user_id", userId);
      if (error) {
        console.error("Failed to fetch custom trips from Supabase", error);
        return;
      }

      const remoteRows = (data ?? []) as CustomTripRow[];
      const remoteIds = new Set(remoteRows.map((r) => r.id));
      useCustomTripsStore.getState().mergeRemote(remoteRows.map((r) => r.data));
      useCustomTripsStore.getState().setUserId(userId);

      const localOnly = Object.values(useCustomTripsStore.getState().trips).filter(
        (t) => !remoteIds.has(t.id)
      );
      if (localOnly.length) {
        const { error: insertError } = await supabase
          .from("custom_trips")
          .insert(localOnly.map((t) => ({ id: t.id, user_id: userId, data: t })));
        if (insertError) console.error("Failed to sync custom trip(s) to Supabase", insertError);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId && !mergedRef.current) {
        mergedRef.current = true;
        mergeOnSignIn(userId);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id;
      if (event === "SIGNED_IN" && userId && !mergedRef.current) {
        mergedRef.current = true;
        mergeOnSignIn(userId);
      }
      if (event === "SIGNED_OUT") {
        mergedRef.current = false;
        useCustomTripsStore.getState().setUserId(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // write-through: push additions/removals while signed in
  useEffect(() => {
    const supabase = createClient();

    const unsubscribe = useCustomTripsStore.subscribe((state, prevState) => {
      const userId = state.userId;
      if (!userId || state.trips === prevState.trips) return;

      const added = Object.values(state.trips).filter((t) => !prevState.trips[t.id]);
      const removed = Object.keys(prevState.trips).filter((id) => !state.trips[id]);

      if (added.length) {
        supabase
          .from("custom_trips")
          .insert(added.map((t) => ({ id: t.id, user_id: userId, data: t })))
          .then(({ error }) => {
            if (error) console.error("Failed to sync new custom trip(s)", error);
          });
      }
      if (removed.length) {
        supabase
          .from("custom_trips")
          .delete()
          .eq("user_id", userId)
          .in("id", removed)
          .then(({ error }) => {
            if (error) console.error("Failed to remove synced custom trip(s)", error);
          });
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
