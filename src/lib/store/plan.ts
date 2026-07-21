"use client";

// The active plan's placements + bag setting, persisted to localStorage.
// This is a single-plan precursor to the full multi-plan system that lands
// in Stage 6 (Plans & Compare) — that stage wraps this same shape with
// save/switch/duplicate on top, it doesn't replace it.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRIPS, type Trip } from "@/data/trips";
import type { BagOption } from "@/lib/calc/pricing";
import type { Placement, Placements, SlotActuals, Stop } from "@/lib/calc/types";

const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));

function defaultStop(t: Trip): Stop {
  return {
    tripId: t.id,
    nights: t.g,
    act: t.a.map(() => true),
    sig: t.f.map(() => true),
    l: 0,
    fd: 0,
  };
}

interface PlanState {
  placements: Placements;
  bag: BagOption;
  addStop: (slotId: string, tripId: string) => void;
  removeStop: (slotId: string, stopIndex: number) => void;
  updateStop: (slotId: string, stopIndex: number, patch: Partial<Stop>) => void;
  toggleAct: (slotId: string, stopIndex: number, actIndex: number) => void;
  toggleSig: (slotId: string, stopIndex: number, sigIndex: number) => void;
  moveStop: (slotId: string, from: number, to: number) => void;
  clearSlot: (slotId: string) => void;
  clearAll: () => void;
  setActual: (slotId: string, key: keyof SlotActuals, value: number | null) => void;
  setBag: (bag: BagOption) => void;
}

function withStop(
  placements: Placements,
  slotId: string,
  stopIndex: number,
  fn: (stop: Stop) => Stop
): Placements {
  const p = placements[slotId];
  if (!p || !p.stops[stopIndex]) return placements;
  const stops = p.stops.map((s, i) => (i === stopIndex ? fn(s) : s));
  return { ...placements, [slotId]: { ...p, stops } };
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      placements: {},
      bag: "cabin",

      addStop: (slotId, tripId) =>
        set((state) => {
          const t = TRIP_BY_ID.get(tripId);
          if (!t) return state;
          const existing: Placement = state.placements[slotId] || { stops: [] };
          return {
            placements: {
              ...state.placements,
              [slotId]: { ...existing, stops: [...existing.stops, defaultStop(t)] },
            },
          };
        }),

      removeStop: (slotId, stopIndex) =>
        set((state) => {
          const p = state.placements[slotId];
          if (!p) return state;
          const stops = p.stops.filter((_, i) => i !== stopIndex);
          const next = { ...state.placements };
          if (stops.length) next[slotId] = { ...p, stops };
          else delete next[slotId];
          return { placements: next };
        }),

      updateStop: (slotId, stopIndex, patch) =>
        set((state) => ({
          placements: withStop(state.placements, slotId, stopIndex, (s) => ({ ...s, ...patch })),
        })),

      toggleAct: (slotId, stopIndex, actIndex) =>
        set((state) => ({
          placements: withStop(state.placements, slotId, stopIndex, (s) => {
            const act = [...s.act];
            act[actIndex] = !act[actIndex];
            return { ...s, act };
          }),
        })),

      toggleSig: (slotId, stopIndex, sigIndex) =>
        set((state) => ({
          placements: withStop(state.placements, slotId, stopIndex, (s) => {
            const sig = [...s.sig];
            sig[sigIndex] = !sig[sigIndex];
            return { ...s, sig };
          }),
        })),

      moveStop: (slotId, from, to) =>
        set((state) => {
          const p = state.placements[slotId];
          if (!p || !p.stops[from] || to < 0 || to >= p.stops.length) return state;
          const stops = [...p.stops];
          const [moved] = stops.splice(from, 1);
          stops.splice(to, 0, moved);
          return { placements: { ...state.placements, [slotId]: { ...p, stops } } };
        }),

      clearSlot: (slotId) =>
        set((state) => {
          const next = { ...state.placements };
          delete next[slotId];
          return { placements: next };
        }),

      clearAll: () => set({ placements: {} }),

      setActual: (slotId, key, value) =>
        set((state) => {
          const p = state.placements[slotId];
          if (!p) return state;
          return {
            placements: {
              ...state.placements,
              [slotId]: { ...p, actual: { ...p.actual, [key]: value } },
            },
          };
        }),

      setBag: (bag) => set({ bag }),
    }),
    { name: "activePlan" }
  )
);
