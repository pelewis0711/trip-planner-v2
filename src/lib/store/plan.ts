"use client";

// Multi-plan system: named plans, each with its own home city, bag setting,
// budget, and placements. Mirrors v1's PLANS/ACTIVE model (reference-v1-app.html
// :1742-1786) closely enough that exported .json plan files round-trip.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRIPS, type Trip } from "@/data/trips";
import { HOMES } from "@/data/homes";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import type { BagOption } from "@/lib/calc/pricing";
import type { Placement, Placements, SlotActuals, Stop } from "@/lib/calc/types";
import type { SemesterConfig } from "@/lib/calc/semester";
import type { Currency } from "@/components/onboarding/OnboardingFlow";

function isKnownHome(home: string): boolean {
  return !!HOMES[home] || !!useCustomHomesStore.getState().homes[home];
}

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
  // custom semester dates/breaks — undefined means "use the default AAU
  // Spring 2027 SLOTS list unchanged" (see src/lib/calc/semester.ts)
  semester?: SemesterConfig;
  // when true, totals use live flight prices (where fetched) in place of
  // the estimate for flight legs — see src/lib/calc/livePricing.ts
  useLivePrices?: boolean;
  // Phase 8: this plan's default party size for any slot that hasn't set
  // its own travelers count. undefined -> 1 (solo), same fallback shape as
  // everything else in the calc engine.
  defaultTravelers?: number;

  // account sync / sharing (all optional — absent for plans that have never
  // touched Supabase, e.g. anonymous local-only use)
  ownerId?: string; // account that owns this plan once it's been synced
  readOnly?: boolean; // true for a friend's plan pulled in view-only (Compare only, never synced)
  shareViewToken?: string | null;
  shareCollabToken?: string | null;
  collaboratorIds?: string[];
  lastEditedBy?: string | null; // email, for display
  lastEditedAt?: number | null;
}

// Phase 7: activities start unchecked -- with 15-25 per city incoming, auto-
// checking everything would make every stop look absurdly expensive and
// defeats the point of choice. Signature dishes stay auto-checked: they're a
// $0 bucket list now (see costs.ts), so "all on" costs nothing and reads
// naturally as "here's what to try."
function defaultStop(t: Trip): Stop {
  return {
    tripId: t.id,
    nights: t.g,
    act: t.a.map(() => false),
    sig: t.f.map(() => true),
    l: 0,
    fd: 0,
  };
}

export type ActivityPreset = "none" | "highlights" | "balanced" | "everything";

// Highlights/Balanced both read as "top N in authored priority order" -- city
// activity lists are authored must-do-first, so this needs no extra
// per-activity metadata and automatically covers future AI-discovered trips.
export function presetActivityChecks(count: number, preset: ActivityPreset): boolean[] {
  const n =
    preset === "none" ? 0
    : preset === "highlights" ? Math.min(3, count)
    : preset === "balanced" ? Math.ceil(count / 2)
    : count;
  return Array.from({ length: count }, (_, i) => i < n);
}

const DEFAULT_ID = "p_default";
// "" means "no home city chosen yet" -- deliberately NOT a real city, so a
// brand-new visitor doesn't silently look like whoever built this app.
// Every consumer of Plan.home already treats an unrecognized string as
// "not set" (see isKnownHome below), so this needs no other type change.
const NO_HOME = "";
const DEFAULT_PLAN: Plan = {
  id: DEFAULT_ID,
  name: "My semester plan",
  home: NO_HOME,
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
  // signed-in user id, set by AuthSync — not persisted to localStorage
  userId: string | null;
  // ids of plans with edits that failed to sync (offline) and are waiting
  // to retry — persisted so a queued edit survives closing the app offline
  pendingSyncIds: string[];

  // Phase 6: onboarding answers, used as the seed for every NEW plan going
  // forward (newPlan() below) — never applied to existing plans.
  defaultHome: string;
  defaultSemester: SemesterConfig | undefined;
  // Phase 9 step 3: local mirror of the two Phase 9 step 2 fields, so an
  // anonymous visitor who completes the setup wizard locally (no account)
  // has somewhere to keep these -- previously they only ever reached
  // Supabase's user_settings table, which anonymous use has no access to.
  defaultStudyingInEurope: boolean;
  defaultCurrency: Currency;

  // Phase 7: one-time "food pricing was fixed" banner -- global, not
  // per-plan, since it's about the app's math changing, not any one plan.
  foodFixNoticeSeen: boolean;
  dismissFoodFixNotice: () => void;

  // Phase 9 step 3: dismissible "set up your trip" banner shown to
  // anonymous visitors with no home chosen yet -- global, not per-plan,
  // same shape as foodFixNoticeSeen above.
  setupPromptDismissed: boolean;
  dismissSetupPrompt: () => void;

  // mutate the ACTIVE plan
  addStop: (slotId: string, tripId: string) => void;
  removeStop: (slotId: string, stopIndex: number) => void;
  updateStop: (slotId: string, stopIndex: number, patch: Partial<Stop>) => void;
  toggleAct: (slotId: string, stopIndex: number, actIndex: number) => void;
  toggleSig: (slotId: string, stopIndex: number, sigIndex: number) => void;
  applyActivityPreset: (slotId: string, stopIndex: number, preset: ActivityPreset) => void;
  moveStop: (slotId: string, from: number, to: number) => void;
  clearSlot: (slotId: string) => void;
  clearAll: () => void;
  setActual: (slotId: string, key: keyof SlotActuals, value: number | null) => void;
  setBag: (bag: BagOption) => void;
  setBudget: (budget: number | null) => void;
  setHome: (home: string) => void;
  setUseLivePrices: (useLivePrices: boolean) => void;
  setDefaultTravelers: (travelers: number) => void;
  setTravelersFor: (slotId: string, travelers: number) => void;

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

  // account sync
  setUserId: (userId: string | null) => void;
  // last-write-wins merge of Supabase rows into local plans; returns ids of
  // local plans that came out newer/missing on the remote side (need upload)
  mergeRemote: (remotePlans: Plan[]) => string[];
  // shallow-merge arbitrary fields into any plan by id (sharing/sync metadata)
  // -- does NOT bump `updated`, so patching sync metadata never re-triggers a sync
  patchPlan: (id: string, patch: Partial<Plan>) => void;
  // like patchPlan, but for real content edits from a specific plan card
  // (not necessarily the active plan) -- bumps `updated` so it syncs
  setSemesterFor: (id: string, semester: SemesterConfig | undefined) => void;
  // add/refresh a friend's plan pulled in via a share link — always readOnly
  addSharedPlan: (plan: Plan) => void;
  removeSharedPlan: (id: string) => void;

  // offline sync queue
  markPendingSync: (ids: string[]) => void;
  clearPendingSync: (ids: string[]) => void;

  // onboarding
  setOnboardingDefaults: (
    home: string,
    semester: SemesterConfig | undefined,
    studyingInEurope: boolean,
    currency: Currency
  ) => void;
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
      userId: null,
      pendingSyncIds: [],
      defaultHome: NO_HOME,
      defaultSemester: undefined,
      defaultStudyingInEurope: true,
      defaultCurrency: "USD",
      foodFixNoticeSeen: false,
      setupPromptDismissed: false,

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

      applyActivityPreset: (slotId, stopIndex, preset) =>
        set((state) =>
          withActive(state, (p) => ({
            placements: withStop(p.placements, slotId, stopIndex, (s) => ({
              ...s,
              act: presetActivityChecks(s.act.length, preset),
            })),
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
      setHome: (home) => set((state) => withActive(state, () => ({ home: isKnownHome(home) ? home : NO_HOME }))),
      setUseLivePrices: (useLivePrices) => set((state) => withActive(state, () => ({ useLivePrices }))),
      setDefaultTravelers: (travelers) =>
        set((state) => withActive(state, () => ({ defaultTravelers: Math.max(1, Math.round(travelers)) }))),

      setTravelersFor: (slotId, travelers) =>
        set((state) =>
          withActive(state, (p) => {
            const existing = p.placements[slotId];
            if (!existing) return {};
            return {
              placements: {
                ...p.placements,
                [slotId]: { ...existing, travelers: Math.max(1, Math.round(travelers)) },
              },
            };
          })
        ),

      newPlan: (name) => {
        const id = uid();
        const now = Date.now();
        const { defaultHome, defaultSemester } = get();
        set((state) => ({
          plans: {
            ...state.plans,
            [id]: {
              id,
              name: name || "Untitled plan",
              home: defaultHome,
              bag: "cabin",
              budget: null,
              placements: {},
              created: now,
              updated: now,
              semester: defaultSemester,
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
              // a duplicate is always your own fresh, unshared, unsynced
              // plan -- never inherit the source's ownership/sharing state
              // (critical for a readOnly shared plan: without this the copy
              // would stay permanently read-only and never sync)
              ownerId: undefined,
              readOnly: undefined,
              shareViewToken: undefined,
              shareCollabToken: undefined,
              collaboratorIds: undefined,
              lastEditedBy: undefined,
              lastEditedAt: undefined,
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
        // read-only shared plans are Compare-only, never editable/active
        set((state) => (state.plans[id] && !state.plans[id].readOnly ? { activeId: id } : state)),

      importPlans: (incoming) =>
        set((state) => {
          const plans = { ...state.plans };
          const now = Date.now();
          incoming.forEach((pl) => {
            const id = uid();
            plans[id] = {
              id,
              name: `${pl.name || "Imported"} (imported)`,
              home: pl.home && isKnownHome(pl.home) ? pl.home : NO_HOME,
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

      setUserId: (userId) => set({ userId }),

      mergeRemote: (remotePlans) => {
        set((state) => {
          const plans = { ...state.plans };
          remotePlans.forEach((rp) => {
            const local = plans[rp.id];
            if (!local || rp.updated > local.updated) plans[rp.id] = rp;
          });
          return { plans };
        });

        const remoteById = new Map(remotePlans.map((p) => [p.id, p]));
        return Object.values(get().plans)
          .filter((p) => {
            const remote = remoteById.get(p.id);
            return !remote || p.updated > remote.updated;
          })
          .map((p) => p.id);
      },

      patchPlan: (id, patch) =>
        set((state) => {
          const p = state.plans[id];
          if (!p) return state;
          return { plans: { ...state.plans, [id]: { ...p, ...patch } } };
        }),

      setSemesterFor: (id, semester) =>
        set((state) => {
          const p = state.plans[id];
          if (!p) return state;
          return { plans: { ...state.plans, [id]: { ...p, semester, updated: Date.now() } } };
        }),

      addSharedPlan: (plan) =>
        set((state) => ({
          plans: { ...state.plans, [plan.id]: { ...plan, readOnly: true } },
        })),

      removeSharedPlan: (id) =>
        // read-only shared plans can never be the active plan (switchPlan
        // refuses them), so there's no activeId fallback to handle here
        set((state) => {
          if (!state.plans[id]?.readOnly) return state;
          const next = { ...state.plans };
          delete next[id];
          return { plans: next, compareIds: state.compareIds.filter((cid) => cid !== id) };
        }),

      markPendingSync: (ids) =>
        set((state) => ({ pendingSyncIds: Array.from(new Set([...state.pendingSyncIds, ...ids])) })),
      clearPendingSync: (ids) =>
        set((state) => ({ pendingSyncIds: state.pendingSyncIds.filter((id) => !ids.includes(id)) })),

      setOnboardingDefaults: (home, semester, studyingInEurope, currency) =>
        set({
          defaultHome: home,
          defaultSemester: semester,
          defaultStudyingInEurope: studyingInEurope,
          defaultCurrency: currency,
        }),

      dismissFoodFixNotice: () => set({ foodFixNoticeSeen: true }),
      dismissSetupPrompt: () => set({ setupPromptDismissed: true }),
    }),
    {
      name: "activePlan",
      version: 1,
      partialize: (state) => ({
        plans: state.plans,
        activeId: state.activeId,
        compareIds: state.compareIds,
        pendingSyncIds: state.pendingSyncIds,
        defaultHome: state.defaultHome,
        defaultSemester: state.defaultSemester,
        defaultStudyingInEurope: state.defaultStudyingInEurope,
        defaultCurrency: state.defaultCurrency,
        foodFixNoticeSeen: state.foodFixNoticeSeen,
        setupPromptDismissed: state.setupPromptDismissed,
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 1 && state.plans) return state as unknown as PlanStoreState;

        // pre-Stage-6 shape: a single flat {placements, bag, budget}. Carry it
        // forward as a real plan instead of silently dropping it. This branch
        // only runs for truly ancient (version 0, no `plans`) localStorage --
        // anyone already on version 1+ (everyone by now) hits the early
        // return above untouched, so this never touches real saved plans.
        let home = NO_HOME;
        try {
          const raw = window.localStorage.getItem("homeBase");
          if (raw) home = JSON.parse(raw)?.state?.home || NO_HOME;
        } catch {
          // ignore — leave home unset
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
