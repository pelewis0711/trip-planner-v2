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
import { generateSlots, DEFAULT_SEMESTER, fmtMonthDay, type SemesterConfig } from "@/lib/calc/semester";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import { LEGACY_SLOTS, type Slot, type SlotKind } from "@/data/slots";

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
  // this plan's actual calendar -- generated from `semester` (see below) the
  // moment it's set/changed, then directly editable afterward (add/rename/
  // delete/adjust dates from the Calendar page's "Edit slots" mode).
  // Undefined/empty means "not configured yet" (Phase 9's setup-wizard
  // empty state), same signal as `semester` being unset.
  slots?: Slot[];
  // the start/end/breaks slots were last generated from -- kept alongside
  // `slots` so the "customize semester" panel has something to pre-fill and
  // so regenerating (changing dates) has a starting point to diff against.
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
  slots: [],
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
  // generated from defaultSemester the moment it's set (see
  // setOnboardingDefaults) -- newPlan() seeds every new plan's `slots` from
  // this, same seeding pattern as defaultHome/defaultSemester.
  defaultSlots: Slot[];
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

  // slot editing (Calendar page's "Edit slots" mode) -- all act on the
  // ACTIVE plan's own `slots` array
  addSlot: (label: string, start: [number, number], end: [number, number], kind: SlotKind) => void;
  renameSlot: (slotId: string, label: string) => void;
  updateSlotDates: (slotId: string, start: [number, number], end: [number, number]) => void;
  updateSlotNote: (slotId: string, note: string) => void;
  deleteSlot: (slotId: string) => void;

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
  // (not necessarily the active plan). Recomputes the auto-generated slots
  // (weekend/break/post) from the new semester, leaves any user-added
  // custom_* slots untouched, and drops placements for any slot that no
  // longer exists -- callers should check slotsToBeLost() first and confirm
  // with the user before calling this if it's non-empty (see SemesterPanel).
  regenerateSlotsFor: (id: string, semester: SemesterConfig) => void;
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

function newSlotId() {
  return "custom_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const isCustomSlot = (id: string) => id.startsWith("custom_");

// Recomputes the auto-generated (weekend/break/post) slots from `semester`,
// keeps any user-added custom_* slots as-is, and drops placements for any
// slot id that no longer exists in the result. Pure -- used by both
// slotsToBeLost() (preview, no mutation) and the real regenerateSlotsFor
// store action below.
function recomputeSlots(plan: Plan, semester: SemesterConfig): { slots: Slot[]; placements: Placements } {
  const auto = generateSlots(semester);
  const custom = (plan.slots ?? []).filter((s) => isCustomSlot(s.id));
  const slots = [...auto, ...custom].sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1]);
  const keep = new Set(slots.map((s) => s.id));
  const placements: Placements = {};
  Object.entries(plan.placements).forEach(([id, p]) => {
    if (keep.has(id)) placements[id] = p;
  });
  return { slots, placements };
}

// Which of this plan's currently-placed slots (with real trips in them)
// would disappear if `semester` were applied -- for the calling UI to warn
// about *before* actually regenerating, per "warn me first instead of
// silently deleting."
export function slotsToBeLost(plan: Plan, semester: SemesterConfig): Slot[] {
  const { slots: nextSlots } = recomputeSlots(plan, semester);
  const keep = new Set(nextSlots.map((s) => s.id));
  return (plan.slots ?? []).filter(
    (s) => !keep.has(s.id) && (plan.placements[s.id]?.stops.length ?? 0) > 0
  );
}

// One-time migration helper: turns a pre-existing plan (no `slots` field --
// either the ancient pre-Stage-6 shape or any real Stage-6+ plan that relied
// on the old implicit "no semester -> hardcoded AAU SLOTS" fallback) into an
// explicit, generated slot list, remapping its placements so nothing placed
// gets silently orphaned. A plan that already has `slots`, or one with no
// real home chosen (never actually configured/used), is left alone --
// exactly the same "configured vs not" signal Phase 9 step 3 already uses.
export function migratePlanToSlots(plan: Plan): Plan {
  if (plan.slots) return plan;
  if (!plan.home) return { ...plan, slots: [] };

  if (plan.semester) {
    // already using the dynamic generator (a friend's custom semester) --
    // its placement ids already came from generateSlots, so no remap needed
    return { ...plan, slots: generateSlots(plan.semester) };
  }

  // the implicit AAU-fallback case (Parker's real plan, most likely) --
  // migrate to an explicit semester and remap old static-file ids (s01,
  // sSP, ...) to whichever new slot covers the same dates
  const newSlots = generateSlots(DEFAULT_SEMESTER);
  const placements: Placements = {};
  Object.entries(plan.placements).forEach(([oldId, p]) => {
    const oldSlot = LEGACY_SLOTS.find((s) => s.id === oldId);
    const match = oldSlot && newSlots.find((s) => s.s[0] === oldSlot.s[0] && s.s[1] === oldSlot.s[1] && s.e[0] === oldSlot.e[0] && s.e[1] === oldSlot.e[1]);
    // never drop a placement -- fall back to keeping it under its original
    // id if (unexpectedly) no matching new slot is found
    placements[match ? match.id : oldId] = p;
  });
  return { ...plan, semester: DEFAULT_SEMESTER, slots: newSlots, placements };
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
      defaultSlots: [],
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

      addSlot: (label, start, end, kind) =>
        set((state) =>
          withActive(state, (p) => {
            const newSlot: Slot = {
              id: newSlotId(),
              label: label.trim() || "Untitled",
              date: fmtMonthDay(start, end),
              s: start,
              e: end,
              kind,
            };
            return { slots: [...(p.slots ?? []), newSlot].sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1]) };
          })
        ),

      renameSlot: (slotId, label) =>
        set((state) =>
          withActive(state, (p) => ({
            slots: (p.slots ?? []).map((s) => (s.id === slotId ? { ...s, label: label.trim() || s.label } : s)),
          }))
        ),

      updateSlotDates: (slotId, start, end) =>
        set((state) =>
          withActive(state, (p) => ({
            slots: (p.slots ?? [])
              .map((s) => (s.id === slotId ? { ...s, s: start, e: end, date: fmtMonthDay(start, end) } : s))
              .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1]),
          }))
        ),

      updateSlotNote: (slotId, note) =>
        set((state) =>
          withActive(state, (p) => ({
            slots: (p.slots ?? []).map((s) => (s.id === slotId ? { ...s, note: note.trim() || undefined } : s)),
          }))
        ),

      deleteSlot: (slotId) =>
        set((state) =>
          withActive(state, (p) => {
            const next = { ...p.placements };
            delete next[slotId];
            return { slots: (p.slots ?? []).filter((s) => s.id !== slotId), placements: next };
          })
        ),

      newPlan: (name) => {
        const id = uid();
        const now = Date.now();
        const { defaultHome, defaultSemester, defaultSlots } = get();
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
              slots: defaultSlots.map((s) => ({ ...s })),
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
              slots: (src.slots ?? []).map((s) => ({ ...s })),
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
            // a JSON export predates Plan.slots the same way an old
            // localStorage save might -- migratePlanToSlots gives it real,
            // correctly-remapped slots instead of an empty calendar
            plans[id] = migratePlanToSlots({
              id,
              name: `${pl.name || "Imported"} (imported)`,
              home: pl.home && isKnownHome(pl.home) ? pl.home : NO_HOME,
              bag: pl.bag === "none" || pl.bag === "checked" ? pl.bag : "cabin",
              budget: typeof pl.budget === "number" ? pl.budget : null,
              placements: pl.placements ?? {},
              created: now,
              updated: now,
            });
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

      regenerateSlotsFor: (id, semester) =>
        set((state) => {
          const p = state.plans[id];
          if (!p) return state;
          const { slots, placements } = recomputeSlots(p, semester);
          return { plans: { ...state.plans, [id]: { ...p, semester, slots, placements, updated: Date.now() } } };
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
          defaultSlots: semester ? generateSlots(semester) : [],
          defaultStudyingInEurope: studyingInEurope,
          defaultCurrency: currency,
        }),

      dismissFoodFixNotice: () => set({ foodFixNoticeSeen: true }),
      dismissSetupPrompt: () => set({ setupPromptDismissed: true }),
    }),
    {
      name: "activePlan",
      version: 2,
      partialize: (state) => ({
        plans: state.plans,
        activeId: state.activeId,
        compareIds: state.compareIds,
        pendingSyncIds: state.pendingSyncIds,
        defaultHome: state.defaultHome,
        defaultSemester: state.defaultSemester,
        defaultSlots: state.defaultSlots,
        defaultStudyingInEurope: state.defaultStudyingInEurope,
        defaultCurrency: state.defaultCurrency,
        foodFixNoticeSeen: state.foodFixNoticeSeen,
        setupPromptDismissed: state.setupPromptDismissed,
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 2 && state.plans) return state as unknown as PlanStoreState;

        // version 1 -> 2: real multi-plan shape already, just needs every
        // plan given real, correctly-remapped slots (see migratePlanToSlots
        // for why this can't just be "start from an empty calendar" --
        // Parker's own real placed trips depend on this being right).
        if (version >= 1 && state.plans) {
          const plans = state.plans as Record<string, Plan>;
          const migratedPlans: Record<string, Plan> = {};
          for (const [id, p] of Object.entries(plans)) migratedPlans[id] = migratePlanToSlots(p);
          return { ...state, plans: migratedPlans } as unknown as PlanStoreState;
        }

        // pre-Stage-6 shape: a single flat {placements, bag, budget}. Carry it
        // forward as a real plan instead of silently dropping it. This branch
        // only runs for truly ancient (version 0, no `plans`) localStorage --
        // anyone already on version 1+ hits the branch above instead.
        let home = NO_HOME;
        try {
          const raw = window.localStorage.getItem("homeBase");
          if (raw) home = JSON.parse(raw)?.state?.home || NO_HOME;
        } catch {
          // ignore — leave home unset
        }
        const id = uid();
        const now = Date.now();
        const migrated: Plan = migratePlanToSlots({
          id,
          name: "My semester plan",
          home,
          bag: (state.bag as BagOption) || "cabin",
          budget: (state.budget as number | null) ?? null,
          placements: (state.placements as Placements) || {},
          created: now,
          updated: now,
        });
        return { plans: { [id]: migrated }, activeId: id, compareIds: [] } as unknown as PlanStoreState;
      },
    }
  )
);

export function useActivePlan(): Plan {
  return usePlanStore((s) => s.plans[s.activeId] ?? DEFAULT_PLAN);
}
