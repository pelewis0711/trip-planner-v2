"use client";

// Phase 6: per-account home-base cities beyond the fixed 20 in
// src/data/homes.ts, for a host city that isn't one of ours -- geocoded via
// /api/geocode at onboarding time. Mirrors useCustomTripsStore's pattern
// exactly: local-first (localStorage, works fully anonymously), merged into
// the static HOMES/HOME_COUNTRY dicts everywhere a home city is read (see
// src/lib/calc/context.ts, src/lib/calc/schengen.ts, src/lib/store/plan.ts,
// and the Header/catalog/TripTray fallback sites).
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomHome {
  lat: number;
  lon: number;
  country: string;
}

interface CustomHomesState {
  homes: Record<string, CustomHome>;
  addHome: (city: string, home: CustomHome) => void;
}

export const useCustomHomesStore = create<CustomHomesState>()(
  persist(
    (set) => ({
      homes: {},
      addHome: (city, home) => set((s) => ({ homes: { ...s.homes, [city]: home } })),
    }),
    {
      name: "customHomes",
      partialize: (s) => ({ homes: s.homes }),
    }
  )
);
