import { describe, expect, it } from "vitest";
import { legEstimate } from "../routing";
import { pricedLegs } from "../pricing";
import { schengenDays } from "../schengen";
import { generateSlots, getSlotsForPlan, DEFAULT_SEMESTER } from "../semester";
import { smartDefaultSemester, postFinalsBreak } from "../onboarding";
import type { Placements, Stop } from "../types";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { HOMES } from "@/data/homes";
import { SLOTS } from "@/data/slots";
import { TRIPS } from "@/data/trips";

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
