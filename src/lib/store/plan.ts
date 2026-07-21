"use client";

// Multi-plan system: named plans, each with its own home city, bag setting,
// budget, and placements. Mirrors v1's PLANS/ACTIVE model (reference-v1-app.html
// :1742-1786) closely enough that exported .json plan files round-trip.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRIPS, type Trip } from "@/data/trips";
import { HOMES } from "@/data/homes";
import type { BagOption } from "@/lib/calc/pricing";
import type { Placement, Placements, SlotActuals, Stop } from "@/lib/calc/types";

const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));

export interface Plan {
  id: string;
  name: string;
  home: string;
  bag: BagOption;
  budget: number | null;
  placements: Placements;
  created: number;
  updated: number;
}

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

const DEFAULT_ID = "p_default";
const DEFAULT_PLAN: Plan = {
  id: DEFAULT_ID,
  name: "My semester plan",
  home: "Prague",
  bag: "cabin",
  budget: null,
  placements: {},
  created: 0,
  updated: 0,
};

interface PlanStoreState {
  plans: Record<string, Plan>;
  activeId: string;
  compareIds: string[];

  // mutate the ACTIVE plan
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
  setBudget: (budget: number | null) => void;
  setHome: (home: string) => void;

  // plan management
  newPlan: (name?: string) => string;
  duplicatePlan: (id: string) => string;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  switchPlan: (id: string) => void;
  importPlans: (incoming: Partial<Plan>[]) => void;
  toggleCompare: (id: string) => void;
  compareAll: () => void;
  clearCompare: () => void;
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

// run fn against the active plan and write back the result, bumping `updated`
function withActive(
  state: PlanStoreState,
  fn: (plan: Plan) => Partial<Plan>
): Pick<PlanStoreState, "plans"> {
  const p = state.plans[state.activeId];
  if (!p) return { plans: state.plans };
  return {
    plans: {
      ...state.plans,
      [state.activeId]: { ...p, ...fn(p), updated: Date.now() },
    },
  };
}

function uid() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const usePlanStore = create<PlanStoreState>()(
  persist(
    (set, get) => ({
      plans: { [DEFAULT_ID]: DEFAULT_PLAN },
      activeId: DEFAULT_ID,
      compareIds: [],

      addStop: (slotId, tripId) =>
        set((state) =>
          withActive(state, (p) => {
            const t = TRIP_BY_ID.get(tripId);
            if (!t) return {};
            const existing: Placement = p.placements[slotId] || { stops: [] };
            return {
              placements: {
                ...p.placements,
                [slotId]: { ...existing, stops: [...existing.stops, defaultStop(t)] },
              },
            };
          })
        ),

      removeStop: (slotId, stopIndex) =>
        set((state) =>
          withActive(state, (p) => {
            const slot = p.placements[slotId];
            if (!slot) return {};
            const stops = slot.stops.filter((_, i) => i !== stopIndex);
            const next = { ...p.placements };
            if (stops.length) next[slotId] = { ...slot, stops };
            else delete next[slotId];
            return { placements: next };
          })
        ),

      updateStop: (slotId, stopIndex, patch) =>
        set((state) =>
          withActive(state, (p) => ({
            placements: withStop(p.placements, slotId, stopIndex, (s) => ({ ...s, ...patch })),
          }))
        ),

      toggleAct: (slotId, stopIndex, actIndex) =>
        set((state) =>
          withActive(state, (p) => ({
            placements: withStop(p.placements, slotId, stopIndex, (s) => {
              const act = [...s.act];
              act[actIndex] = !act[actIndex];
              return { ...s, act };
            }),
          }))
        ),

      toggleSig: (slotId, stopIndex, sigIndex) =>
        set((state) =>
          withActive(state, (p) => ({
            placements: withStop(p.placements, slotId, stopIndex, (s) => {
              const sig = [...s.sig];
              sig[sigIndex] = !sig[sigIndex];
              return { ...s, sig };
            }),
          }))
        ),

      moveStop: (slotId, from, to) =>
        set((state) =>
          withActive(state, (p) => {
            const slot = p.placements[slotId];
            if (!slot || !slot.stops[from] || to < 0 || to >= slot.stops.length) return {};
            const stops = [...slot.stops];
            const [moved] = stops.splice(from, 1);
            stops.splice(to, 0, moved);
            return { placements: { ...p.placements, [slotId]: { ...slot, stops } } };
          })
        ),

      clearSlot: (slotId) =>
        set((state) =>
          withActive(state, (p) => {
            const next = { ...p.placements };
            delete next[slotId];
            return { placements: next };
          })
        ),

      clearAll: () => set((state) => withActive(state, () => ({ placements: {} }))),

      setActual: (slotId, key, value) =>
        set((state) =>
          withActive(state, (p) => {
            const slot = p.placements[slotId];
            if (!slot) return {};
            return {
              placements: {
                ...p.placements,
                [slotId]: { ...slot, actual: { ...slot.actual, [key]: value } },
              },
            };
          })
        ),

      setBag: (bag) => set((state) => withActive(state, () => ({ bag }))),
      setBudget: (budget) => set((state) => withActive(state, () => ({ budget }))),
      setHome: (home) => set((state) => withActive(state, () => ({ home: HOMES[home] ? home : "Prague" }))),

      newPlan: (name) => {
        const id = uid();
        const now = Date.now();
        const home = get().plans[get().activeId]?.home ?? "Prague";
        set((state) => ({
          plans: {
            ...state.plans,
            [id]: {
              id,
              name: name || "Untitled plan",
              home,
              bag: "cabin",
              budget: null,
              placements: {},
              created: now,
              updated: now,
            },
          },
          activeId: id,
        }));
        return id;
      },

      duplicatePlan: (id) => {
        const src = get().plans[id];
        const newId = uid();
        const now = Date.now();
        if (!src) return newId;
        set((state) => ({
          plans: {
            ...state.plans,
            [newId]: {
              ...src,
              id: newId,
              name: `${src.name} (copy)`,
              placements: JSON.parse(JSON.stringify(src.placements)),
              created: now,
              updated: now,
            },
          },
        }));
        return newId;
      },

      renamePlan: (id, name) =>
        set((state) => {
          const p = state.plans[id];
          if (!p || !name.trim()) return state;
          return { plans: { ...state.plans, [id]: { ...p, name: name.trim(), updated: Date.now() } } };
        }),

      deletePlan: (id) =>
        set((state) => {
          const next = { ...state.plans };
          delete next[id];
          const remaining = Object.keys(next);
          let activeId = state.activeId;
          if (activeId === id) {
            if (remaining.length) {
              activeId = remaining.sort((a, b) => next[b].updated - next[a].updated)[0];
            } else {
              const freshId = uid();
              const now = Date.now();
              next[freshId] = { ...DEFAULT_PLAN, id: freshId, created: now, updated: now };
              activeId = freshId;
            }
          }
          return {
            plans: next,
            activeId,
            compareIds: state.compareIds.filter((cid) => cid !== id),
          };
        }),

      switchPlan: (id) =>
        set((state) => (state.plans[id] ? { activeId: id } : state)),

      importPlans: (incoming) =>
        set((state) => {
          const plans = { ...state.plans };
          const now = Date.now();
          incoming.forEach((pl) => {
            const id = uid();
            plans[id] = {
              id,
              name: `${pl.name || "Imported"} (imported)`,
              home: pl.home && HOMES[pl.home] ? pl.home : "Prague",
              bag: pl.bag === "none" || pl.bag === "checked" ? pl.bag : "cabin",
              budget: typeof pl.budget === "number" ? pl.budget : null,
              placements: pl.placements ?? {},
              created: now,
              updated: now,
            };
          });
          return { plans };
        }),

      toggleCompare: (id) =>
        set((state) => ({
          compareIds: state.compareIds.includes(id)
            ? state.compareIds.filter((x) => x !== id)
            : [...state.compareIds, id],
        })),
      compareAll: () => set((state) => ({ compareIds: Object.keys(state.plans) })),
      clearCompare: () => set({ compareIds: [] }),
    }),
    {
      name: "activePlan",
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 1 && state.plans) return state as unknown as PlanStoreState;

        // pre-Stage-6 shape: a single flat {placements, bag, budget}. Carry it
        // forward as a real plan instead of silently dropping it.
        let home = "Prague";
        try {
          const raw = window.localStorage.getItem("homeBase");
          if (raw) home = JSON.parse(raw)?.state?.home || "Prague";
        } catch {
          // ignore — fall back to Prague
        }
        const id = uid();
        const now = Date.now();
        const migrated: Plan = {
          id,
          name: "My semester plan",
          home,
          bag: (state.bag as BagOption) || "cabin",
          budget: (state.budget as number | null) ?? null,
          placements: (state.placements as Placements) || {},
          created: now,
          updated: now,
        };
        return { plans: { [id]: migrated }, activeId: id, compareIds: [] } as unknown as PlanStoreState;
      },
    }
  )
);

export function useActivePlan(): Plan {
  return usePlanStore((s) => s.plans[s.activeId] ?? DEFAULT_PLAN);
}
