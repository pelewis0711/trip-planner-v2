// Direct port of v1's seasonal fare multipliers + budget-airline extras
// (reference-v1-app.html:1085-1114).
import type { RouteLeg } from "./routing";
import type { Trip } from "@/data/trips";

export type BagOption = "none" | "cabin" | "checked";

export const BAGS: Record<BagOption, [label: string, price: number]> = {
  none: ["No bag (personal item only)", 0],
  cabin: ["Cabin bag", 28],
  checked: ["Checked bag", 45],
};

// Cities whose budget flights often land at a distant secondary airport
// (one-way transfer estimate).
export const XFER: Record<string, [label: string, price: number]> = {
  Paris: ["Beauvais/Orly transfer", 22],
  Milan: ["Bergamo transfer", 14],
  Barcelona: ["Girona/Reus transfer", 18],
  London: ["Stansted/Luton transfer", 16],
  Brussels: ["Charleroi transfer", 18],
  Rome: ["airport transfer", 9],
  Stockholm: ["Skavsta/Arlanda transfer", 16],
  Venice: ["Treviso transfer", 12],
  Vienna: ["Bratislava (Wizz) transfer", 14],
  Frankfurt: ["Hahn transfer", 20],
  Oslo: ["Torp transfer", 18],
};

export interface SeasonInfo {
  mult: number;
  why: string;
}

export function seasonInfo(
  slotId: string,
  leg: RouteLeg,
  trips: Trip[]
): SeasonInfo | null {
  if (slotId === "sSP" && leg.mode === "flight") {
    const dub = /dublin/i.test(leg.from) || /dublin/i.test(leg.to);
    return dub ? { mult: 2.2, why: "St. Pat's peak" } : { mult: 1.15, why: "holiday week" };
  }
  if (slotId === "sBRK") {
    if (leg.mode === "flight") return { mult: 1.5, why: "Easter/break peak" };
    if (leg.mode === "train/bus") return { mult: 1.15, why: "holiday period" };
  }
  if (slotId === "sPOST" && leg.mode === "flight") {
    const beach = [leg.from, leg.to].some((n) => {
      const t = trips.find((x) => x.n === n);
      return t && t.t.includes("beach");
    });
    if (beach) return { mult: 1.3, why: "late-May island demand" };
  }
  return null;
}

export interface PricedLeg extends RouteLeg {
  note: string;
}

// Route legs with real-world pricing: seasonal multiplier, bag fee, secondary-airport transfer.
export function pricedLegs(
  slotId: string,
  legs: RouteLeg[],
  bag: BagOption,
  trips: Trip[]
): PricedLeg[] {
  return legs.map((l) => {
    let cost = l.cost;
    const notes: string[] = [];
    const si = seasonInfo(slotId, l, trips);
    if (si) {
      cost = Math.round(cost * si.mult);
      notes.push("×" + si.mult + " " + si.why);
    }
    if (l.mode === "flight") {
      const bagInfo = BAGS[bag] || BAGS.cabin;
      if (bagInfo[1]) {
        cost += bagInfo[1];
        notes.push(bagInfo[0].toLowerCase() + " +$" + bagInfo[1]);
      }
      const x = XFER[l.to];
      if (x) {
        cost += x[1];
        notes.push(x[0] + " +$" + x[1]);
      }
    }
    return { ...l, cost, note: notes.join(" · ") };
  });
}
