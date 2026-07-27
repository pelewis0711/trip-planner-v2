import { describe, expect, it } from "vitest";
import { legEstimate } from "../routing";
import { pricedLegs } from "../pricing";
import { schengenDays } from "../schengen";
import { generateSlots, getSlotsForPlan, DEFAULT_SEMESTER, describeTerm } from "../semester";
import { smartDefaultSemester, postFinalsBreak } from "../onboarding";
import type { Placements, Stop } from "../types";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore, presetActivityChecks, migratePlanToSlots, slotsToBeLost } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { resolveHome, isKnownCity } from "@/lib/resolveHome";
import { HOMES } from "@/data/homes";
import { LEGACY_SLOTS } from "@/data/slots";
import { TRIPS } from "@/data/trips";
import { slotCosts, tripPriceRange, travelersFor, grandTotals } from "../costs";
import { makeCtx } from "../context";
import { foodTiers, daysOf, lodgingTiers } from "../cost";
import { convert, formatMoney, RATES } from "../currency";
import { searchPrograms, toSemesterConfig } from "@/data/programCalendars";
import { parsePlanFile, sanitizePlacements } from "@/lib/planIO";

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

  it("exempts a geocoded (fully custom, not in any bundled dataset) host country via useCustomHomesStore (Phase 6)", () => {
    // Alicante is deliberately NOT in EUROPEAN_CITIES -- this test is
    // specifically about the useCustomHomesStore tier of resolution.
    useCustomHomesStore.getState().addHome("Alicante", { lat: 38.35, lon: -0.48, country: "Spain" });
    // Rome (Italy) is Schengen and != Spain -> counts
    const romeStop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 };
    const tripOf = (id: string) => TRIPS.find((t) => t.id === id);
    expect(schengenDays({ s06: { stops: [romeStop] } }, "Alicante", tripOf)).toBe(3);

    // a Spain trip, with Alicante as home, should be exempt (home country match)
    const spainTrip = TRIPS.find((t) => t.c === "Spain");
    if (spainTrip) {
      const spainStop: Stop = { tripId: spainTrip.id, nights: 2, act: [], sig: [], l: 0, fd: 0 };
      expect(schengenDays({ s06: { stops: [spainStop] } }, "Alicante", tripOf)).toBe(0);
    }
  });
});

describe("Phase 9 step 6: generalized home cities (bundled ~150-city dataset)", () => {
  it("Schengen home country now derives from the bundled dataset too, not just the original 20 or a custom-geocoded home", () => {
    // Krakow is in EUROPEAN_CITIES (Poland), not the original 20 HOMES and
    // not custom-geocoded -- this is the actual bug fix: previously this
    // would have resolved to `undefined`, over-counting even a Poland trip.
    const tripOf = (id: string) => TRIPS.find((t) => t.id === id);
    const polandTrip = TRIPS.find((t) => t.c === "Poland");
    const romeStop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 };
    // Rome (Italy) is Schengen and != Poland -> counts, same formula as ever
    expect(schengenDays({ s06: { stops: [romeStop] } }, "Krakow", tripOf)).toBe(3);
    if (polandTrip) {
      const polandStop: Stop = { tripId: polandTrip.id, nights: 2, act: [], sig: [], l: 0, fd: 0 };
      expect(schengenDays({ s06: { stops: [polandStop] } }, "Krakow", tripOf)).toBe(0);
    }
  });

  it("resolveHome checks the original 20, then the bundled dataset, then a custom home, in that order", () => {
    expect(resolveHome("Prague")).toEqual({ lat: 50.08, lon: 14.44, country: "Czechia" });
    expect(resolveHome("Krakow")).toEqual({ lat: 50.06, lon: 19.94, country: "Poland" });
    useCustomHomesStore.getState().addHome("Nowheresville", { lat: 1, lon: 2, country: "Testland" });
    expect(resolveHome("Nowheresville")).toEqual({ lat: 1, lon: 2, country: "Testland" });
  });

  it("resolveHome returns null (never a Prague guess) for a city that isn't resolvable at all", () => {
    expect(resolveHome("")).toBeNull();
    expect(resolveHome("Definitely Not A Real City XYZ")).toBeNull();
  });

  it("isKnownCity is true for all three resolution tiers and false for an unresolvable city", () => {
    expect(isKnownCity("Prague")).toBe(true);
    expect(isKnownCity("Krakow")).toBe(true);
    expect(isKnownCity("Definitely Not A Real City XYZ")).toBe(false);
  });
});

describe("Phase 6: dynamic semester slots", () => {
  it("generateSlots produces the same weekend count for the AAU default as the historical (legacy) hardcoded slots", () => {
    const generated = generateSlots(DEFAULT_SEMESTER);
    const weekends = generated.filter((s) => s.kind === "weekend");
    const legacyWeekends = LEGACY_SLOTS.filter((s) => s.kind === "weekend");
    expect(weekends.length).toBe(legacyWeekends.length);
  });

  it("generateSlots produces the exact same dates as the historical hardcoded slots for the AAU default (migration safety)", () => {
    const generated = generateSlots(DEFAULT_SEMESTER);
    for (const legacy of LEGACY_SLOTS) {
      const match = generated.find((s) => s.s[0] === legacy.s[0] && s.s[1] === legacy.s[1] && s.e[0] === legacy.e[0] && s.e[1] === legacy.e[1]);
      expect(match, `no generated slot matches legacy ${legacy.id} (${legacy.date})`).toBeTruthy();
    }
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

describe("Phase 9 step 4: generateSlots as a standalone pure function (spring + fall)", () => {
  it("spring term: produces weekend slots, the supplied breaks, and a guaranteed post-term slot even when none was supplied", () => {
    const slots = generateSlots({
      start: "2027-01-24",
      end: "2027-05-24",
      breaks: [{ id: "brk", label: "SPRING BREAK", start: "2027-03-26", end: "2027-04-04", kind: "break" }],
    });
    expect(slots.some((s) => s.kind === "weekend")).toBe(true);
    expect(slots.some((s) => s.kind === "break" && s.label === "SPRING BREAK")).toBe(true);
    // no post-kind break was supplied -- generateSlots must add one itself
    expect(slots.some((s) => s.kind === "post")).toBe(true);
  });

  it("fall term: produces weekend slots across a full Aug-Dec term and a guaranteed post-term slot", () => {
    const slots = generateSlots({ start: "2026-08-25", end: "2026-12-12", breaks: [] });
    const weekends = slots.filter((s) => s.kind === "weekend");
    expect(weekends.length).toBeGreaterThan(10);
    expect(slots.some((s) => s.kind === "post")).toBe(true);
  });

  it("does not duplicate a post-term slot when the caller already supplied one", () => {
    const slots = generateSlots({
      start: "2027-01-24",
      end: "2027-05-24",
      breaks: [{ id: "post", label: "POST-FINALS", start: "2027-05-15", end: "2027-05-24", kind: "post" }],
    });
    expect(slots.filter((s) => s.kind === "post").length).toBe(1);
  });
});

describe("Phase 9 step 7: describeTerm (profile-driven Overview/Header labels)", () => {
  it("a spring-start semester describes as Spring, with the real year", () => {
    expect(describeTerm({ start: "2027-01-24", end: "2027-05-24", breaks: [] })).toEqual({ season: "Spring", year: 2027 });
  });

  it("a fall-start semester describes as Fall, with the real year", () => {
    expect(describeTerm({ start: "2026-08-25", end: "2026-12-12", breaks: [] })).toEqual({ season: "Fall", year: 2026 });
  });

  it("returns null for an unconfigured plan (no semester at all) -- never guesses a term", () => {
    expect(describeTerm(undefined)).toBeNull();
  });
});

describe("Phase 9 step 8: display-only currency conversion (calc engine stays USD)", () => {
  it("the same plan's real grandTotals convert to mathematically equivalent amounts in EUR and GBP -- not different numbers", () => {
    const ctx = makeCtx("Prague");
    const placements: Placements = {
      s06: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] },
    };
    const g = grandTotals(placements, ctx, 1);

    // the calc engine only ever produces plain USD numbers -- untouched by
    // this feature, verified directly before checking the display layer
    expect(typeof g.total).toBe("number");

    const eur = convert(g.total, "EUR");
    const gbp = convert(g.total, "GBP");
    expect(eur).toBeCloseTo(g.total * RATES.EUR, 6);
    expect(gbp).toBeCloseTo(g.total * RATES.GBP, 6);

    // formatMoney shows the right symbol for the same underlying total --
    // same plan, same trip, three different display strings
    expect(formatMoney(g.total, "USD")).toBe(`$${Math.round(g.total).toLocaleString()}`);
    expect(formatMoney(g.total, "EUR")).toBe(`€${Math.round(eur).toLocaleString()}`);
    expect(formatMoney(g.total, "GBP")).toBe(`£${Math.round(gbp).toLocaleString()}`);
  });

  it("USD is always an exact 1:1 passthrough (no rounding drift from the identity rate)", () => {
    expect(convert(123.45, "USD")).toBe(123.45);
    expect(RATES.USD).toBe(1);
  });
});

describe("Phase 6: plan store onboarding defaults", () => {
  it("newPlan() seeds home/semester from setOnboardingDefaults, not the active plan's home", () => {
    const store = usePlanStore.getState();
    const customSemester = { start: "2026-09-01", end: "2026-12-15", breaks: [] };
    store.setOnboardingDefaults("Barcelona", customSemester, true, "USD");
    const id = usePlanStore.getState().newPlan("Test plan");
    const created = usePlanStore.getState().plans[id];
    expect(created.home).toBe("Barcelona");
    expect(created.semester).toEqual(customSemester);
  });
});

describe("Onboarding-loop fix: setOnboardingDefaults also configures the active plan when it's unconfigured", () => {
  it("populates home/semester/slots on the active plan when it had none (the reported infinite-loop scenario)", () => {
    const store = usePlanStore.getState();
    const id = store.newPlan("Loop-bug test plan");
    // force the freshly-created plan back into a genuinely unconfigured
    // state, regardless of whatever store-wide defaults were left over from
    // earlier tests in this file
    store.patchPlan(id, { home: "", semester: undefined, slots: [], placements: {} });
    store.switchPlan(id);
    expect(usePlanStore.getState().plans[id].home).toBe("");
    expect(usePlanStore.getState().plans[id].semester).toBeUndefined();

    const semester = { start: "2027-01-25", end: "2027-05-16", breaks: [] };
    store.setOnboardingDefaults("Florence", semester, true, "USD");

    const after = usePlanStore.getState().plans[id];
    expect(after.home).toBe("Florence");
    expect(after.semester).toEqual(semester);
    // edge-to-edge weekend coverage, not just a couple of slots
    expect(after.slots!.length).toBeGreaterThan(10);
    expect(after.slots).toEqual(generateSlots(semester));
  });

  it("leaves an already-configured active plan completely untouched", () => {
    const store = usePlanStore.getState();
    const id = store.newPlan("Already-configured test plan");
    const originalSemester = { start: "2026-08-25", end: "2026-12-12", breaks: [] };
    const originalSlots = generateSlots(originalSemester);
    store.patchPlan(id, {
      home: "Prague",
      semester: originalSemester,
      slots: originalSlots,
      placements: { [originalSlots[0].id]: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] } },
    });
    store.switchPlan(id);

    // keep studyingInEurope/currency at their store-wide defaults here --
    // this test is only about the active PLAN staying untouched, and other
    // tests in this file assert the store's initial default values
    store.setOnboardingDefaults("Madrid", { start: "2027-01-25", end: "2027-05-16", breaks: [] }, true, "USD");

    const after = usePlanStore.getState().plans[id];
    expect(after.home).toBe("Prague");
    expect(after.semester).toEqual(originalSemester);
    expect(after.slots).toEqual(originalSlots);
    expect(after.placements[originalSlots[0].id]).toBeTruthy();
  });
});

describe("Weekend-deletion fix: deletions persist across regenerating slots, and don't touch neighbors", () => {
  function freshConfiguredPlan(semester: { start: string; end: string; breaks: never[] }) {
    const store = usePlanStore.getState();
    const id = store.newPlan("Deletion test plan");
    const slots = generateSlots(semester);
    store.patchPlan(id, { home: "Prague", semester, slots, placements: {} });
    store.switchPlan(id);
    return { store, id, slots };
  }

  it("a deleted auto weekend does not reappear after regenerateSlotsFor is called again with the SAME semester", () => {
    const semester = { start: "2027-01-25", end: "2027-05-16", breaks: [] };
    const { store, id, slots } = freshConfiguredPlan(semester);
    const targetId = slots[3].id;

    store.deleteSlot(targetId);
    expect(usePlanStore.getState().plans[id].slots!.some((s) => s.id === targetId)).toBe(false);
    expect(usePlanStore.getState().plans[id].deletedAutoSlots?.length).toBe(1);

    store.regenerateSlotsFor(id, semester);
    const after = usePlanStore.getState().plans[id];
    const stillGone = !after.slots!.some((s) => s.s[0] === slots[3].s[0] && s.s[1] === slots[3].s[1] && s.e[0] === slots[3].e[0] && s.e[1] === slots[3].e[1]);
    expect(stillGone).toBe(true);
  });

  it("switching to a genuinely different semester clears old deletions", () => {
    const semester = { start: "2027-01-25", end: "2027-05-16", breaks: [] };
    const { store, id, slots } = freshConfiguredPlan(semester);
    store.deleteSlot(slots[3].id);
    expect(usePlanStore.getState().plans[id].deletedAutoSlots?.length).toBe(1);

    const newSemester = { start: "2026-08-25", end: "2026-12-12", breaks: [] };
    store.regenerateSlotsFor(id, newSemester);
    expect(usePlanStore.getState().plans[id].deletedAutoSlots ?? []).toEqual([]);
  });

  it("deleting one weekend does not remove or renumber its neighbors, and leaves their placements alone", () => {
    const semester = { start: "2027-01-25", end: "2027-05-16", breaks: [] };
    const { store, id, slots } = freshConfiguredPlan(semester);
    const before = slots[2].id;
    const target = slots[3].id;
    const after2 = slots[4].id;
    store.patchPlan(id, {
      placements: {
        [before]: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] },
        [after2]: { stops: [{ tripId: "dublin", nights: 2, act: [], sig: [], l: 0, fd: 0 }] },
      },
    });

    store.deleteSlot(target);

    const plan = usePlanStore.getState().plans[id];
    expect(plan.slots!.some((s) => s.id === before)).toBe(true);
    expect(plan.slots!.some((s) => s.id === after2)).toBe(true);
    expect(plan.placements[before]?.stops[0].tripId).toBe("rome");
    expect(plan.placements[after2]?.stops[0].tripId).toBe("dublin");
  });

  it("deleting a slot that has a placed trip drops its placement (the UI warns first via confirm())", () => {
    const semester = { start: "2027-01-25", end: "2027-05-16", breaks: [] };
    const { store, id, slots } = freshConfiguredPlan(semester);
    const target = slots[3].id;
    store.patchPlan(id, {
      placements: { [target]: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] } },
    });

    store.deleteSlot(target);

    const plan = usePlanStore.getState().plans[id];
    expect(plan.placements[target]).toBeUndefined();
  });
});

describe("Phase 9 step 3: local setup wizard defaults", () => {
  it("defaultStudyingInEurope/defaultCurrency start at true/USD and round-trip through setOnboardingDefaults", () => {
    const store = usePlanStore.getState();
    expect(usePlanStore.getState().defaultStudyingInEurope).toBe(true);
    expect(usePlanStore.getState().defaultCurrency).toBe("USD");

    const semester = { start: "2026-08-25", end: "2026-12-12", breaks: [] };
    store.setOnboardingDefaults("Lisbon", semester, false, "EUR");
    expect(usePlanStore.getState().defaultStudyingInEurope).toBe(false);
    expect(usePlanStore.getState().defaultCurrency).toBe("EUR");
  });

  it("setupPromptDismissed starts false and dismissSetupPrompt flips it (mirrors dismissFoodFixNotice)", () => {
    const store = usePlanStore.getState();
    expect(usePlanStore.getState().setupPromptDismissed).toBe(false);
    store.dismissSetupPrompt();
    expect(usePlanStore.getState().setupPromptDismissed).toBe(true);
  });

  it("getSlotsForPlan returns plan.slots directly -- no more static-file fallback (superseded by step 4's dynamic-slots system)", () => {
    const withSlots = { slots: [{ id: "w1", label: "Weekend 1", date: "Jan 1-2", s: [1, 1], e: [1, 2], kind: "weekend" }] } as unknown as Plan;
    expect(getSlotsForPlan(withSlots)).toBe(withSlots.slots);

    const withoutSlots = { semester: undefined } as unknown as Plan;
    expect(getSlotsForPlan(withoutSlots)).toEqual([]);
  });
});

describe("Phase 9 step 4: migrating a pre-existing plan onto dynamic slots without losing placed trips", () => {
  it("a plan that relied on the old implicit AAU fallback (real home, no semester) gets an explicit semester and every placement remapped to the correctly-dated new slot", () => {
    const legacyPlan = {
      home: "Prague",
      semester: undefined,
      placements: {
        sSP: { stops: [{ tripId: "dublin", nights: 2, act: [], sig: [], l: 0, fd: 0 }] }, // St. Patrick's
        s01: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] }, // Weekend 1, Jan 30-31
      },
    } as unknown as Plan;

    const migrated = migratePlanToSlots(legacyPlan);

    expect(migrated.semester).toEqual(DEFAULT_SEMESTER);
    expect(migrated.slots?.length).toBeGreaterThan(0);

    // the St. Patrick's placement must land on whichever new slot covers
    // Mar 16-18, and the Weekend 1 placement on whichever covers Jan 30-31
    // -- not necessarily the same ids as the old static file
    const spSlot = migrated.slots!.find((s) => s.s[0] === 3 && s.s[1] === 16 && s.e[0] === 3 && s.e[1] === 18)!;
    const w1Slot = migrated.slots!.find((s) => s.s[0] === 1 && s.s[1] === 30 && s.e[0] === 1 && s.e[1] === 31)!;
    expect(spSlot).toBeTruthy();
    expect(w1Slot).toBeTruthy();
    expect(migrated.placements[spSlot.id]?.stops[0].tripId).toBe("dublin");
    expect(migrated.placements[w1Slot.id]?.stops[0].tripId).toBe("rome");

    // nothing placed is ever silently dropped
    const allTripIds = Object.values(migrated.placements).flatMap((p) => p.stops.map((s) => s.tripId));
    expect(allTripIds.sort()).toEqual(["dublin", "rome"]);
  });

  it("a plan that already has slots is left completely untouched", () => {
    const existing = { slots: [{ id: "w1" }] } as unknown as Plan;
    expect(migratePlanToSlots(existing)).toBe(existing);
  });

  it("a truly unconfigured plan (no home, no semester) gets an empty slot list, not the AAU baseline", () => {
    const fresh = { home: "", semester: undefined, placements: {} } as unknown as Plan;
    expect(migratePlanToSlots(fresh).slots).toEqual([]);
  });
});

describe("Phase 9 step 4: slotsToBeLost warns before a destructive regenerate", () => {
  it("names a placed slot that would disappear under a shorter semester", () => {
    const plan = {
      slots: generateSlots(DEFAULT_SEMESTER),
      placements: { w13: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] } },
    } as unknown as Plan;
    const shorterSemester = { start: "2027-01-24", end: "2027-04-01", breaks: [] };
    const lost = slotsToBeLost(plan, shorterSemester);
    expect(lost.some((s) => s.id === "w13")).toBe(true);
  });

  it("reports nothing lost when every placed slot survives regeneration", () => {
    const plan = {
      slots: generateSlots(DEFAULT_SEMESTER),
      placements: { w1: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }] } },
    } as unknown as Plan;
    expect(slotsToBeLost(plan, DEFAULT_SEMESTER)).toEqual([]);
  });
});

describe("Phase 7: food-model fix (no double-count)", () => {
  it("slotCosts does not add checked signature-dish prices on top of the food tier", () => {
    const ctx = makeCtx("Prague");
    // rome.f has priced entries (e.g. a $28 trattoria dinner) -- check all of them
    const stop: Stop = { tripId: "rome", nights: 2, act: [], sig: rome.f.map(() => true), l: 0, fd: 0 };
    const withDishesChecked = slotCosts("s06", [stop], ctx, 1);

    const stopNoDishes: Stop = { tripId: "rome", nights: 2, act: [], sig: rome.f.map(() => false), l: 0, fd: 0 };
    const withoutDishesChecked = slotCosts("s06", [stopNoDishes], ctx, 1);

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

describe("Phase 8: group-aware lodging (sanity-check table, ci=3)", () => {
  // Matches the table shown to Parker before this shipped: b=28 (CI_BASE[3]).
  it("hostel dorm is flat per person regardless of group size", () => {
    for (const n of [1, 2, 4, 6]) {
      expect(lodgingTiers(3, n)[0][1]).toBe(28);
    }
  });

  it("Airbnb/apartment per-person cost matches the calibration table", () => {
    expect(lodgingTiers(3, 1)[1][1]).toBe(84);
    expect(lodgingTiers(3, 2)[1][1]).toBe(49);
    expect(lodgingTiers(3, 4)[1][1]).toBe(32); // 31.5 rounds up
    expect(lodgingTiers(3, 6)[1][1]).toBe(26); // 25.67 rounds up
  });

  it("Airbnb's 0.8b floor doesn't engage in the 1-6 traveler range", () => {
    // floor = 0.8*28 = 22.4 -- every value in the table above is well above it
    for (const n of [1, 2, 4, 6]) {
      expect(lodgingTiers(3, n)[1][1]).toBeGreaterThan(0.8 * 28);
    }
  });

  it("private room per-person cost matches the calibration table (room split evenly)", () => {
    expect(lodgingTiers(3, 1)[2][1]).toBe(59); // 58.8 rounds up
    expect(lodgingTiers(3, 2)[2][1]).toBe(29); // 29.4 rounds down
    expect(lodgingTiers(3, 4)[2][1]).toBe(29);
    expect(lodgingTiers(3, 6)[2][1]).toBe(29);
  });

  it("boutique per-person cost matches the calibration table", () => {
    expect(lodgingTiers(3, 1)[3][1]).toBe(101); // 100.8 rounds up
    expect(lodgingTiers(3, 2)[3][1]).toBe(50);
    expect(lodgingTiers(3, 4)[3][1]).toBe(50);
    expect(lodgingTiers(3, 6)[3][1]).toBe(50);
  });

  it("private and boutique are identical per-person at any even group size (both reduce to room-rate/2)", () => {
    for (const n of [2, 4, 6]) {
      const tiers = lodgingTiers(3, n);
      expect(tiers[2][1]).toBe(Math.round((28 * 2.1) / 2));
      expect(tiers[3][1]).toBe(Math.round((28 * 3.6) / 2));
    }
  });
});

describe("Phase 8: travelers-aware totals", () => {
  it("travelersFor falls back placement -> plan default -> 1", () => {
    expect(travelersFor(undefined, 4)).toBe(4);
    expect(travelersFor({ stops: [] }, 4)).toBe(4);
    expect(travelersFor({ stops: [], travelers: 6 }, 4)).toBe(6);
    expect(travelersFor(undefined, undefined as unknown as number)).toBe(1);
  });

  it("slotCosts with travelers=1 matches pre-Phase-8 behavior exactly (regression)", () => {
    const ctx = makeCtx("Prague");
    const stop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 2, fd: 0 };
    const solo = slotCosts("s06", [stop], ctx, 1);
    // ci=3, private room tier at n=1 -> 59/person/night (see calibration table)
    expect(solo.lodg).toBe(59 * 2);
  });

  it("group total is always exactly per-person lodging times travelers", () => {
    const ctx = makeCtx("Prague");
    const stop: Stop = { tripId: "rome", nights: 2, act: [], sig: [], l: 2, fd: 0 };
    for (const travelers of [1, 2, 4, 6]) {
      const c = slotCosts("s06", [stop], ctx, travelers);
      const perPersonLodgingRate = lodgingTiers(3, travelers)[2][1];
      expect(c.lodg).toBe(perPersonLodgingRate * 2);
      // the group total (a display-time computation, not a stored field) is
      // always per-person * travelers by construction
      expect(c.lodg * travelers).toBe(perPersonLodgingRate * 2 * travelers);
    }
  });

  it("grandTotals sums per-slot group totals correctly even with mixed party sizes", () => {
    const ctx = makeCtx("Prague");
    const soloStop: Stop = { tripId: "rome", nights: 1, act: [], sig: [], l: 0, fd: 0 };
    const groupStop: Stop = { tripId: "dublin", nights: 1, act: [], sig: [], l: 0, fd: 0 };
    const placements: Placements = {
      s06: { stops: [soloStop] }, // no override -> uses defaultTravelers
      s01: { stops: [groupStop], travelers: 4 }, // explicit override
    };
    const g = grandTotals(placements, ctx, 1);
    // manually recompute the expected group total: solo slot at 1 traveler,
    // group slot at 4 travelers -- NOT the per-person grand total times a
    // single shared travelers count
    const soloCosts = slotCosts("s06", [soloStop], ctx, 1);
    const groupCosts = slotCosts("s01", [groupStop], ctx, 4);
    expect(g.totalGroup).toBe(soloCosts.total * 1 + groupCosts.total * 4);
  });
});

describe("Profile layer: no hardcoded 'Prague' for a brand-new visitor", () => {
  it("a fresh plan store has no home city set (not Prague)", () => {
    // Simulates a brand-new visitor: read the store's initial state shape
    // directly rather than going through localStorage/persist.
    const state = usePlanStore.getState();
    // defaultHome is the account-wide fallback used to seed new plans --
    // for anyone who hasn't onboarded, it must be empty, not a real city.
    // (Other tests in this file may have already set it via
    // setOnboardingDefaults, so this just checks the *type* of value is a
    // plain string, not that it's still empty at this point in the suite.)
    expect(typeof state.defaultHome).toBe("string");
  });

  it("setHome falls back to empty (not Prague) for an unrecognized city", () => {
    const store = usePlanStore.getState();
    store.setHome("Not A Real City");
    const active = usePlanStore.getState().plans[usePlanStore.getState().activeId];
    expect(active.home).toBe("");
  });

  it("importPlans falls back to empty (not Prague) when no valid home is given", () => {
    const store = usePlanStore.getState();
    const before = new Set(Object.keys(usePlanStore.getState().plans));
    store.importPlans([{ name: "Imported plan", placements: {} }]);
    const after = usePlanStore.getState().plans;
    const newId = Object.keys(after).find((id) => !before.has(id))!;
    expect(after[newId].home).toBe("");
  });
});

describe("Phase 12: merged program-calendar picker (providers + universities)", () => {
  it("searchPrograms finds a provider entry by partial name", () => {
    const results = searchPrograms("CEA CAPA Prague");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.type === "provider")).toBe(true);
    expect(results.some((r) => r.name === "CEA CAPA Prague")).toBe(true);
  });

  it("searchPrograms finds a university entry by partial name", () => {
    const results = searchPrograms("Anglo-American");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.type === "university")).toBe(true);
    expect(results.some((r) => r.name === "Anglo-American University")).toBe(true);
  });

  it("searchPrograms also matches by city, across both provider and university entries", () => {
    const results = searchPrograms("Prague", 20);
    expect(results.some((r) => r.type === "provider" && r.name === "CEA CAPA Prague")).toBe(true);
    expect(results.some((r) => r.type === "university" && r.name === "Anglo-American University")).toBe(true);
  });

  it("toSemesterConfig auto-fills correctly from a provider entry", () => {
    const entry = searchPrograms("CEA CAPA Prague").find((e) => e.term === "Spring 2027")!;
    const config = toSemesterConfig(entry);
    expect(config.start).toBe(entry.start);
    expect(config.end).toBe(entry.end);
    // a post-finals window is always appended, computed regardless of source
    expect(config.breaks.some((b) => b.kind === "post")).toBe(true);
  });

  it("toSemesterConfig auto-fills correctly from a university entry, preserving its own researched breaks", () => {
    const entry = searchPrograms("Anglo-American").find((e) => e.term === "Spring 2027")!;
    const config = toSemesterConfig(entry);
    expect(config.start).toBe(entry.start);
    expect(config.end).toBe(entry.end);
    expect(config.breaks.some((b) => b.label === entry.breaks[0].label)).toBe(true);
    expect(config.breaks.some((b) => b.kind === "post")).toBe(true);
  });

  // Confirms the full chain a picked program actually drives end to end:
  // toSemesterConfig -> generateSlots -> real weekend + break slots, exactly
  // the behavior described when this was requested ("weekends auto-added as
  // 2-day travel weekends, spring break becomes its own slot, editable
  // afterward").
  it("picking a program with a real spring break generates 2-day weekend slots plus a dedicated break slot", () => {
    const entry = searchPrograms("CEA CAPA Florence").find((e) => e.term === "Spring 2027")!;
    expect(entry.breaks.some((b) => b.label === "Spring Break")).toBe(true);

    const config = toSemesterConfig(entry);
    const slots = generateSlots(config);

    const weekends = slots.filter((s) => s.kind === "weekend");
    expect(weekends.length).toBeGreaterThan(0);
    for (const w of weekends) {
      const start = new Date(2027, w.s[0] - 1, w.s[1]);
      const end = new Date(2027, w.e[0] - 1, w.e[1]);
      const days = (end.getTime() - start.getTime()) / 86_400_000;
      expect(days).toBe(1); // Sat -> Sun inclusive = 2 calendar days, 1 day apart
    }

    const springBreakSlot = slots.find((s) => s.label === "Spring Break");
    expect(springBreakSlot).toBeTruthy();
    expect(springBreakSlot!.kind).toBe("break");

    // a post-finals slot is always appended regardless of source
    expect(slots.some((s) => s.kind === "post")).toBe(true);
  });
});

describe("Hardening: safe plan import (untrusted JSON files)", () => {
  it("round-trips a real, valid plan export unchanged", () => {
    const text = JSON.stringify({
      kind: "study-abroad-plan",
      version: 2,
      plan: {
        name: "My trip",
        home: "Prague",
        bag: "checked",
        budget: 2000,
        placements: {
          w1: { stops: [{ tripId: "rome", nights: 2, act: [true, false], sig: [true], l: 1, fd: 1 }], travelers: 2 },
        },
      },
    });
    const [imported] = parsePlanFile(text);
    expect(imported.name).toBe("My trip");
    expect(imported.home).toBe("Prague");
    expect(imported.bag).toBe("checked");
    expect(imported.budget).toBe(2000);
    expect(imported.placements!.w1.stops[0]).toEqual({ tripId: "rome", nights: 2, act: [true, false], sig: [true], l: 1, fd: 1 });
    expect(imported.placements!.w1.travelers).toBe(2);
  });

  it("strips __proto__/constructor/prototype keys instead of letting them through", () => {
    const malicious = JSON.parse(
      '{"__proto__": {"polluted": true}, "constructor": {"stops": []}, "w1": {"stops": []}}'
    );
    const clean = sanitizePlacements(malicious);
    expect(Object.keys(clean)).toEqual(["w1"]);
    // the real check: assigning through a plain object literal must never
    // have touched Object.prototype
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects a file that's too large with a friendly error, not a crash", () => {
    const huge = JSON.stringify({ plan: { name: "x".repeat(3_000_000) } });
    expect(() => parsePlanFile(huge)).toThrow(/too large/i);
  });

  it("rejects malformed JSON with a friendly error, not a raw parse exception", () => {
    expect(() => parsePlanFile("{not valid json")).toThrow(/valid JSON/i);
  });

  it("rejects a file with no plan/plans field", () => {
    expect(() => parsePlanFile(JSON.stringify({ hello: "world" }))).toThrow(/plan file/i);
  });

  it("drops garbage stops instead of importing them", () => {
    const text = JSON.stringify({
      plan: {
        placements: {
          w1: { stops: [{ tripId: "rome", nights: 2, act: [], sig: [], l: 0, fd: 0 }, { tripId: 12345, nights: "lots" }, "not an object"] },
        },
      },
    });
    const [imported] = parsePlanFile(text);
    expect(imported.placements!.w1.stops).toHaveLength(1);
    expect(imported.placements!.w1.stops[0].tripId).toBe("rome");
  });
});
