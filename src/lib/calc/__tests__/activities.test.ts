// Phase 26 step 1: picked activities move from booleans-by-position to
// permanent activity ids. These tests pin the one thing that must not
// happen: a saved pick landing on a different activity.
import { describe, it, expect, beforeEach } from "vitest";
import { TRIPS } from "@/data/trips";
import LEGACY_ORDER from "../../../../scripts/data/legacyActivityOrder.json";
import LEGACY_MAP from "@/data/legacyActivityMap.json";
import { usePlanStore, migratePersistedPlans, type Plan } from "@/lib/store/plan";
import { DEFAULT_SEMESTER, generateSlots } from "@/lib/calc/semester";
import {
  legacyActivityId,
  type LegacyActivityMap,
  migrateAct,
  pickedActivities,
  pickedActivityTotal,
  placementsWithActivityIds,
} from "@/lib/calc/activities";
import { slotCosts } from "@/lib/calc/costs";
import { makeCtx } from "@/lib/calc/context";
import { rowToPlan, type PlanRow } from "@/lib/supabase/sharing";
import { parsePlanFile } from "@/lib/planIO";
import { buildXlsxSheets } from "@/lib/excel";
import type { Stop } from "@/lib/calc/types";

const LEGACY: Record<string, string[]> = LEGACY_ORDER;
const trip = (id: string) => TRIPS.find((t) => t.id === id)!;
const rome = trip("rome");
const dublin = trip("dublin");

// The old format: booleans parallel to the activity list, as of Oct 19, 2026.
function oldPicks(tripId: string, indexes: number[]): boolean[] {
  return trip(tripId).a.map((_, i) => indexes.includes(i));
}
// What the old app would have shown/charged for those boxes.
function oldNames(tripId: string, indexes: number[]): string[] {
  return indexes.map((i) => trip(tripId).a[i][0]);
}
function oldTotal(tripId: string, indexes: number[]): number {
  return indexes.reduce((s, i) => s + trip(tripId).a[i][1], 0);
}

describe("activity ids in the catalog", () => {
  it("every activity has a unique id prefixed by its trip", () => {
    const seen = new Set<string>();
    for (const t of TRIPS) {
      for (const [name, , id] of t.a) {
        expect(id.startsWith(`${t.id}.`), `${t.id}: ${name}`).toBe(true);
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(3197);
  });

  it("the shipped map sends every old position to the same activity (or marks it retired)", () => {
    // The map only lists trips whose order changed since ids shipped (the
    // Oct 20, 2026 flag fixes retired 8 activities). Every other trip must
    // still match the frozen order exactly.
    const map = LEGACY_MAP as Record<string, (number | string)[]>;
    for (const t of TRIPS) {
      const legacyIds = LEGACY[t.id].map((s) => `${t.id}.${s}`);
      const current = t.a.map(([, , id]) => id);
      const entries = map[t.id];
      if (!entries) {
        expect(current).toEqual(legacyIds);
        continue;
      }
      expect(entries).toHaveLength(legacyIds.length);
      entries.forEach((e, i) => {
        if (typeof e === "number") expect(current[e]).toBe(legacyIds[i]);
        else {
          expect(e).toBe(legacyIds[i]);
          expect(current).not.toContain(e);
        }
      });
    }
  });

  it("an old pick of a retired activity is kept, shown as no longer listed, and costs $0", () => {
    const bologna = TRIPS.find((t) => t.id === "bologna")!;
    const old = LEGACY.bologna.map((_, i) => i === 0); // old-format: Asinelli tower picked
    const ids = migrateAct("bologna", old);
    expect(ids).toEqual(["bologna.asinelli-tower-climb"]);
    const picked = pickedActivities(bologna, ids);
    expect(picked).toEqual([
      expect.objectContaining({ id: "bologna.asinelli-tower-climb", listed: false, price: 0 }),
    ]);
  });

  it("old positions still resolve correctly after the catalog is reordered and trimmed", () => {
    // Simulates a later step: Rome's list reversed, one activity retired,
    // two new ones added. The map is built exactly as extract-trips.mjs does.
    const oldIds = LEGACY.rome.map((s) => `rome.${s}`);
    const retired = oldIds[3];
    const current = [
      ["New A", 5, "rome.new-a"],
      ...[...rome.a].reverse().filter(([, , id]) => id !== retired),
      ["New B", 5, "rome.new-b"],
    ] as [string, number, string][];
    const changedRome = { ...rome, a: current };
    const trips = new Map([["rome", changedRome]]);
    const ids = current.map((a) => a[2]);
    const map: LegacyActivityMap = { rome: oldIds.map((id) => (ids.includes(id) ? ids.indexOf(id) : id)) };

    oldIds.forEach((id, i) => expect(legacyActivityId("rome", i, map, trips)).toBe(id));
    expect(legacyActivityId("rome", oldIds.length, map, trips)).toBeUndefined();
    // the retired pick survives as "no longer listed" at $0
    const picked = pickedActivities(changedRome, [retired, oldIds[0]]);
    expect(picked.find((a) => a.id === retired)).toMatchObject({ listed: false, price: 0 });
    expect(picked.find((a) => a.id === oldIds[0])).toMatchObject({ listed: true, name: rome.a[0][0] });
  });
});

describe("migrateAct", () => {
  it("maps old position-based picks to the activity that was at that position", () => {
    const ids = migrateAct("rome", oldPicks("rome", [0, 2]));
    expect(pickedActivities(rome, ids).map((a) => a.name)).toEqual(oldNames("rome", [0, 2]));
  });

  it("keeps new-format ids, drops duplicates and anything malformed", () => {
    const id = rome.a[4][2];
    expect(migrateAct("rome", [id, id, "not an id", 42, null, "../etc", "ROME.Bad"])).toEqual([id]);
  });

  it("returns no picks for missing or non-array input, never throws", () => {
    expect(migrateAct("rome", undefined)).toEqual([]);
    expect(migrateAct("rome", { 0: true })).toEqual([]);
    expect(migrateAct("no-such-trip", [true, true])).toEqual([]);
  });

  it("ignores old-format positions past the end of the frozen list", () => {
    const tooLong = [...oldPicks("rome", [1]), true, true, true, true, true, true];
    expect(migrateAct("rome", tooLong)).toEqual([rome.a[1][2]]);
  });
});

describe("picked activities and pricing", () => {
  it("an id no longer in the catalog is kept, labelled, and priced at $0", () => {
    const picks = [rome.a[0][2], "rome.a-tour-that-was-removed"];
    const picked = pickedActivities(rome, picks);
    expect(picked).toHaveLength(2);
    expect(picked[1]).toEqual({ id: "rome.a-tour-that-was-removed", name: "A tour that was removed", price: 0, listed: false });
    expect(pickedActivityTotal(rome, picks)).toBe(rome.a[0][1]);
  });

  it("listed picks come back in catalog order regardless of pick order", () => {
    const picked = pickedActivities(rome, [rome.a[5][2], rome.a[1][2]]);
    expect(picked.map((a) => a.id)).toEqual([rome.a[1][2], rome.a[5][2]]);
  });

  it("slot cost reads old- and new-format picks identically", () => {
    const ctx = makeCtx("Prague", "cabin");
    const base = { tripId: "rome", nights: 2, sig: [], l: 0, fd: 0 };
    const oldStop = { ...base, act: oldPicks("rome", [0, 2]) } as unknown as Stop;
    const newStop: Stop = { ...base, act: migrateAct("rome", oldPicks("rome", [0, 2])) };
    const a = slotCosts("w1", [oldStop], ctx, 1);
    const b = slotCosts("w1", [newStop], ctx, 1);
    expect(a.act).toBe(oldTotal("rome", [0, 2]));
    expect(b.act).toBe(a.act);
    expect(b.total).toBe(a.total);
  });
});

describe("migrating saved plans (localStorage, synced rows, exported files)", () => {
  const slots = generateSlots(DEFAULT_SEMESTER);
  // Shaped like Parker's real plan: Rome with picks 1 and 3, Dublin with pick 2.
  const oldPlacements = {
    [slots[0].id]: { stops: [{ tripId: "rome", nights: 3, act: oldPicks("rome", [0, 2]), sig: [true], l: 1, fd: 1 }] },
    [slots[5].id]: { stops: [{ tripId: "dublin", nights: 2, act: oldPicks("dublin", [1]), sig: [], l: 0, fd: 0 }] },
  };

  function expectMigrated(placements: Record<string, { stops: { tripId: string; act: unknown }[] }>) {
    const romeStop = placements[slots[0].id].stops[0];
    const dublinStop = placements[slots[5].id].stops[0];
    expect(romeStop.act).toEqual([rome.a[0][2], rome.a[2][2]]);
    expect(dublinStop.act).toEqual([dublin.a[1][2]]);
    expect(pickedActivities(rome, romeStop.act as string[]).map((a) => a.name)).toEqual(oldNames("rome", [0, 2]));
    expect(pickedActivities(dublin, dublinStop.act as string[]).map((a) => a.name)).toEqual(oldNames("dublin", [1]));
  }

  beforeEach(() => {
    usePlanStore.setState(usePlanStore.getInitialState(), true);
  });

  it("the real persist migration (v3 -> v4) converts every saved plan's picks", () => {
    const persisted = {
      plans: {
        p1: {
          id: "p1", name: "My semester plan", home: "Prague", bag: "cabin", budget: null,
          placements: oldPlacements, created: 1, updated: 2, semester: DEFAULT_SEMESTER, slots,
        },
      },
      activeId: "p1",
      compareIds: [],
    };
    const state = migratePersistedPlans(persisted, 3);
    expectMigrated(state.plans.p1.placements);
    // nothing else about the plan moved
    expect(state.plans.p1.slots).toEqual(slots);
    expect(state.plans.p1.placements[slots[0].id].stops[0]).toMatchObject({ nights: 3, sig: [true], l: 1, fd: 1 });
  });

  it("totals are identical before and after migration", () => {
    const ctx = makeCtx("Prague", "cabin");
    const migrated = placementsWithActivityIds(oldPlacements);
    for (const slotId of Object.keys(oldPlacements)) {
      const before = slotCosts(slotId, oldPlacements[slotId].stops as unknown as Stop[], ctx, 1);
      const after = slotCosts(slotId, migrated[slotId].stops as unknown as Stop[], ctx, 1);
      expect(after.total).toBe(before.total);
      expect(after.act).toBe(before.act);
    }
  });

  it("a synced Supabase row still in the old shape is converted by rowToPlan", () => {
    const row = {
      id: "p1", user_id: "u1", name: "Synced",
      data: { home: "Prague", bag: "cabin", budget: null, placements: oldPlacements, created: 1, updated: 2, semester: DEFAULT_SEMESTER, slots },
      share_view_token: null, share_collab_token: null, collaborator_ids: [], last_edited_by: null, last_edited_at: null,
    } as unknown as PlanRow;
    expectMigrated(rowToPlan(row, new Map()).placements);
  });

  it("an exported plan file from before Phase 26 imports with the right picks", () => {
    const text = JSON.stringify({ kind: "study-abroad-plan", version: 2, plan: { name: "Old export", home: "Prague", placements: oldPlacements } });
    const [imported] = parsePlanFile(text);
    expectMigrated(imported.placements!);
  });

  it("toggleAct adds and removes ids, and cleans up an old-format stop first", () => {
    usePlanStore.setState((s) => ({
      plans: {
        [s.activeId]: { ...s.plans[s.activeId], home: "Prague", semester: DEFAULT_SEMESTER, slots, placements: oldPlacements } as unknown as Plan,
      },
    }));
    const { toggleAct } = usePlanStore.getState();
    const added = dublin.a[4][2];
    toggleAct(slots[5].id, 0, added);
    const stopAfterAdd = () => {
      const s = usePlanStore.getState();
      return s.plans[s.activeId].placements[slots[5].id].stops[0];
    };
    expect(stopAfterAdd().act).toEqual([dublin.a[1][2], added]);
    toggleAct(slots[5].id, 0, dublin.a[1][2]);
    expect(stopAfterAdd().act).toEqual([added]);
  });

  it("addActivities appends new ids once, keeps existing picks, and ignores repeats", () => {
    usePlanStore.setState((s) => ({
      plans: { [s.activeId]: { ...s.plans[s.activeId], home: "Prague", semester: DEFAULT_SEMESTER, slots, placements: {} } as Plan },
    }));
    const { addStop, toggleAct, addActivities } = usePlanStore.getState();
    addStop(slots[0].id, "paris");
    const paris = TRIPS.find((t) => t.id === "paris")!;
    const [a, b, c] = paris.a.map(([, , id]) => id);
    toggleAct(slots[0].id, 0, b);
    addActivities(slots[0].id, 0, [a, b, a, c]);
    const s = usePlanStore.getState();
    expect(s.plans[s.activeId].placements[slots[0].id].stops[0].act).toEqual([b, a, c]);
  });

  it("a newly placed trip starts with no picks", () => {
    usePlanStore.setState((s) => ({
      plans: { [s.activeId]: { ...s.plans[s.activeId], home: "Prague", semester: DEFAULT_SEMESTER, slots, placements: {} } as Plan },
    }));
    usePlanStore.getState().addStop(slots[0].id, "paris");
    const s = usePlanStore.getState();
    expect(s.plans[s.activeId].placements[slots[0].id].stops[0].act).toEqual([]);
  });

  it("Excel export lists the same picked activities by name", () => {
    const plan = {
      id: "p1", name: "My semester plan", home: "Prague", bag: "cabin", budget: null,
      placements: placementsWithActivityIds(oldPlacements), created: 1, updated: 2, semester: DEFAULT_SEMESTER, slots,
    } as unknown as Plan;
    const { tp, lk } = buildXlsxSheets(plan);
    const activityRows = tp.filter((r) => r[2] === "Activity").map((r) => r[3]);
    expect(activityRows).toEqual([...oldNames("rome", [0, 2]), ...oldNames("dublin", [1])]);
    const linkRows = lk.filter((r) => r[4] && typeof r[4] === "object" && (r[4] as { v?: string }).v === "Find tickets").map((r) => r[2]);
    expect(linkRows).toEqual([...oldNames("rome", [0, 2]), ...oldNames("dublin", [1])]);
  });
});
