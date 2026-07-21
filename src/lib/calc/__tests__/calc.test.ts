import { describe, expect, it } from "vitest";
import { legEstimate } from "../routing";
import { pricedLegs } from "../pricing";
import { schengenDays } from "../schengen";
import type { Placements, Stop } from "../types";
import { HOMES } from "@/data/homes";
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
});
