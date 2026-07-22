import { describe, expect, it } from "vitest";
import { legEstimate } from "../routing";
import { pricedLegs } from "../pricing";
import { schengenDays } from "../schengen";
import { generateSlots, getSlotsForPlan, DEFAULT_SEMESTER } from "../semester";
import { smartDefaultSemester, postFinalsBreak } from "../onboarding";
import type { Placements, Stop } from "../types";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore, presetActivityChecks } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { HOMES } from "@/data/homes";
import { SLOTS } from "@/data/slots";
import { TRIPS } from "@/data/trips";
import { slotCosts, tripPriceRange } from "../costs";
import { makeCtx } from "../context";
import { foodTiers, daysOf } from "../cost";

const rome = TRIPS.find((t) => t.id === "rome")!;
const dublin = TRIPS.find((t) => t.id === "dublin")!;

describe("routing", () => {
  it("prices a Prague -> Rome flight leg like v1 (known value)", () => {
    const e = legEstimate(HOMES.Prague, rome.co);
    expect(e.mode).toBe("flight");
    expect(e.km).toBe(922);
    expect(e.cost).toBe(61);
  });

  it("treats short hops as free local transit", () => {
    // Prague <-> Prague is 0km, well under the 60km local threshold.
    const e = legEstimate(HOMES.Prague, HOMES.Prague);
    expect(e.mode).toBe("local");
    expect(e.cost).toBe(0);
  });
});

describe("seasonal pricing", () => {
  it("applies the St. Patrick's x2.2 Dublin multiplier", () => {
    const leg = { from: "Prague", to: dublin.n, ...legEstimate(HOMES.Prague, dublin.co), kind: "out" as const };
    const [priced] = pricedLegs("sSP", [leg], "none", TRIPS);
    expect(leg.cost).toBe(76);
    expect(priced.cost).toBe(Math.round(76 * 2.2));
    expect(priced.note).toContain("St. Pat's peak");
  });

  it("does not apply the Dublin multiplier to a non-holiday weekend", () => {
    const leg = { from: "Prague", to: dublin.n, ...legEstimate(HOMES.Prague, dublin.co), kind: "out" as const };
    const [priced] = pricedLegs("s01", [leg], "none", TRIPS);
    expect(priced.cost).toBe(leg.cost);
  });
});

describe("Schengen tracker", () => {
  it("counts nights+1 for a Schengen stop outside the home country", () => {
    const stop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 };
    const placements: Placements = { s06: { stops: [stop] } };
    const tripOf = (id: string) => TRIPS.find((t) => t.id === id);
    expect(schengenDays(placements, "Prague", tripOf)).toBe(3);
  });

  it("does not count non-Schengen stops (e.g. Dublin, Ireland)", () => {
    const stop: Stop = { tripId: "dublin", nights: 2, act: [], sig: [], l: 0, fd: 0 };
    const placements: Placements = { sSP: { stops: [stop] } };
    const tripOf = (id: string) => TRIPS.find((t) => t.id === id);
    expect(schengenDays(placements, "Prague", tripOf)).toBe(0);
  });

  it("exempts a geocoded (non-HOMES) host country via useCustomHomesStore (Phase 6)", () => {
    useCustomHomesStore.getState().addHome("Valencia", { lat: 39.47, lon: -0.38, country: "Spain" });
    // Rome (Italy) is Schengen and != Spain -> counts
    const romeStop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 };
    const tripOf = (id: string) => TRIPS.find((t) => t.id === id);
    expect(schengenDays({ s06: { stops: [romeStop] } }, "Valencia", tripOf)).toBe(3);

    // a Spain trip, with Valencia as home, should be exempt (home country match)
    const spainTrip = TRIPS.find((t) => t.c === "Spain");
    if (spainTrip) {
      const spainStop: Stop = { tripId: spainTrip.id, nights: 2, act: [], sig: [], l: 0, fd: 0 };
      expect(schengenDays({ s06: { stops: [spainStop] } }, "Valencia", tripOf)).toBe(0);
    }
  });
});

describe("Phase 6: dynamic semester slots", () => {
  it("a plan with no semester set keeps using the exact static SLOTS array (zero regression)", () => {
    const plan = { semester: undefined } as unknown as Plan;
    expect(getSlotsForPlan(plan)).toBe(SLOTS);
  });

  it("generateSlots produces the same weekend count for the AAU default as the hardcoded SLOTS", () => {
    const generated = generateSlots(DEFAULT_SEMESTER);
    const weekends = generated.filter((s) => s.kind === "weekend");
    const staticWeekends = SLOTS.filter((s) => s.kind === "weekend");
    expect(weekends.length).toBe(staticWeekends.length);
  });

  it("smartDefaultSemester always includes a computed post-finals window", () => {
    const config = smartDefaultSemester("fall", new Date("2026-07-20"));
    expect(config.breaks.some((b) => b.kind === "post")).toBe(true);
  });

  it("postFinalsBreak computes a window ending exactly on the program end date", () => {
    const brk = postFinalsBreak("2027-05-24", 9);
    expect(brk.end).toBe("2027-05-24");
    expect(brk.start).toBe("2027-05-15");
  });
});

describe("Phase 6: plan store onboarding defaults", () => {
  it("newPlan() seeds home/semester from setOnboardingDefaults, not the active plan's home", () => {
    const store = usePlanStore.getState();
    const customSemester = { start: "2026-09-01", end: "2026-12-15", breaks: [] };
    store.setOnboardingDefaults("Barcelona", customSemester);
    const id = usePlanStore.getState().newPlan("Test plan");
    const created = usePlanStore.getState().plans[id];
    expect(created.home).toBe("Barcelona");
    expect(created.semester).toEqual(customSemester);
  });
});

describe("Phase 7: food-model fix (no double-count)", () => {
  it("slotCosts does not add checked signature-dish prices on top of the food tier", () => {
    const ctx = makeCtx("Prague");
    // rome.f has priced entries (e.g. a $28 trattoria dinner) -- check all of them
    const stop: Stop = { tripId: "rome", nights: 2, act: [], sig: rome.f.map(() => true), l: 0, fd: 0 };
    const withDishesChecked = slotCosts("s06", [stop], ctx);

    const stopNoDishes: Stop = { tripId: "rome", nights: 2, act: [], sig: rome.f.map(() => false), l: 0, fd: 0 };
    const withoutDishesChecked = slotCosts("s06", [stopNoDishes], ctx);

    // food total must be identical whether or not bucket-list dishes are checked
    expect(withDishesChecked.food).toBe(withoutDishesChecked.food);
    // and it should equal exactly the tier rate x days, nothing more
    expect(withDishesChecked.food).toBe(foodTiers(rome.ci)[0][1] * daysOf(2));
  });
});

describe("Phase 7: trip price range", () => {
  it("floor excludes all activities, ceiling includes every activity's price", () => {
    const ctx = makeCtx("Prague");
    const range = tripPriceRange(rome, ctx);
    const allActivityCost = rome.a.reduce((s, [, price]) => s + price, 0);
    expect(range.ceiling - range.floor).toBe(allActivityCost);
    expect(range.ceiling).toBeGreaterThanOrEqual(range.floor);
  });
});

describe("Phase 7: activity presets", () => {
  it("highlights/balanced/everything/none produce the right checked-index counts", () => {
    expect(presetActivityChecks(20, "none").filter(Boolean).length).toBe(0);
    expect(presetActivityChecks(20, "highlights").filter(Boolean).length).toBe(3);
    expect(presetActivityChecks(20, "balanced").filter(Boolean).length).toBe(10);
    expect(presetActivityChecks(20, "everything").filter(Boolean).length).toBe(20);
  });

  it("highlights never exceeds the actual activity count for a short list", () => {
    expect(presetActivityChecks(2, "highlights").filter(Boolean).length).toBe(2);
    expect(presetActivityChecks(0, "highlights").filter(Boolean).length).toBe(0);
  });

  it("presets check the first N in authored order (priority order), not an arbitrary subset", () => {
    const checks = presetActivityChecks(6, "balanced");
    expect(checks).toEqual([true, true, true, false, false, false]);
  });
});
