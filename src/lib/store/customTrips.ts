"use client";

// Per-account discovered trips (Phase 5) -- always owner-only, no sharing/
// collaboration, so this is simpler than the plan store: local-first
// (localStorage, works fully anonymously) with a best-effort push to
// Supabase when signed in. Merged into the static TRIPS catalog everywhere
// a trip can be browsed, placed, or priced -- see src/lib/calc/context.ts.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trip } from "@/data/trips";

interface CustomTripsState {
  trips: Record<string, Trip>;
  userId: string | null;
  addTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
  setUserId: (id: string | null) => void;
  mergeRemote: (remoteTrips: Trip[]) => void;
}

export const useCustomTripsStore = create<CustomTripsState>()(
  persist(
    (set) => ({
      trips: {},
      userId: null,
      addTrip: (trip) => set((s) => ({ trips: { ...s.trips, [trip.id]: trip } })),
      removeTrip: (id) =>
        set((s) => {
          const next = { ...s.trips };
          delete next[id];
          return { trips: next };
        }),
      setUserId: (id) => set({ userId: id }),
      mergeRemote: (remoteTrips) =>
        set((s) => {
          const trips = { ...s.trips };
          remoteTrips.forEach((t) => {
            trips[t.id] = t;
          });
          return { trips };
        }),
    }),
    {
      name: "customTrips",
      partialize: (s) => ({ trips: s.trips }),
    }
  )
);
