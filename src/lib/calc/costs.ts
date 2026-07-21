// Direct port of v1's cost helpers (reference-v1-app.html:1150-1188).
import type { Trip } from "@/data/trips";
import type { Placement, Placements, SlotActuals, Stop } from "./types";
import type { PlannerCtx } from "./context";
import { CI_BASE, daysOf, foodTiers, lodgingTiers } from "./cost";
import { legEstimate, routeLegs } from "./routing";
import { pricedLegs, type PricedLeg } from "./pricing";

export interface SlotCosts {
  act: number;
  food: number;
  lodg: number;
  travel: number;
  total: number;
  legs: PricedLeg[];
}

export function slotCosts(slotId: string, stops: Stop[], ctx: PlannerCtx): SlotCosts {
  let act = 0;
  let food = 0;
  let lodg = 0;
  stops.forEach((st) => {
    const t = ctx.tripOf(st.tripId);
    if (!t) return;
    t.a.forEach(([, price], i) => {
      if (st.act[i]) act += price;
    });
    t.f.forEach(([, price], i) => {
      if (st.sig[i]) food += price;
    });
    const ft = foodTiers(t.ci)[st.fd];
    const lt = lodgingTiers(t.ci)[st.l];
    if (ft) food += ft[1] * daysOf(st.nights);
    if (lt) lodg += lt[1] * st.nights;
  });

  const rawLegs = routeLegs(
    stops,
    ctx.home,
    ctx.homeCoord,
    ctx.coordsOf,
    ctx.nameOf
  );
  const legs = pricedLegs(slotId, rawLegs, ctx.bag, ctx.trips);
  const travel = legs.reduce((s, l) => s + l.cost, 0);

  return { act, food, lodg, travel, total: act + food + lodg + travel, legs };
}

// Solo round-trip estimate from home at the trip's recommended nights — used
// on catalog cards. Uses the cheapest (index 0) lodging/food tier.
export function tripBaseTotal(t: Trip, ctx: PlannerCtx): number {
  let s = 0;
  t.a.forEach(([, price]) => (s += price));
  t.f.forEach(([, price]) => (s += price));
  s += 2 * legEstimate(ctx.homeCoord, ctx.coordsOf(t.id)).cost;
  s += foodTiers(t.ci)[0][1] * daysOf(t.g);
  s += lodgingTiers(t.ci)[0][1] * t.g;
  return s;
}

export interface GrandTotals {
  act: number;
  food: number;
  travel: number;
  lodg: number;
  total: number;
  count: number;
  stops: number;
}

export function grandTotals(placements: Placements, ctx: PlannerCtx): GrandTotals {
  const g: GrandTotals = { act: 0, food: 0, travel: 0, lodg: 0, total: 0, count: 0, stops: 0 };
  for (const id in placements) {
    const c = slotCosts(id, placements[id].stops, ctx);
    g.act += c.act;
    g.food += c.food;
    g.travel += c.travel;
    g.lodg += c.lodg;
    g.total += c.total;
    g.count++;
    g.stops += placements[id].stops.length;
  }
  return g;
}

export const hasVal = (x: unknown): x is number | string =>
  x !== undefined && x !== null && x !== "" && !Number.isNaN(+x);

export function slotActuals(p: Placement | undefined): SlotActuals {
  return (p && p.actual) || {};
}

export function blendedSlot(slotId: string, p: Placement, ctx: PlannerCtx): number {
  const c = slotCosts(slotId, p.stops, ctx);
  const a = slotActuals(p);
  const v = (k: keyof SlotActuals, est: number) => (hasVal(a[k]) ? +a[k]! : est);
  return v("tr", c.travel) + v("lo", c.lodg) + v("fo", c.food) + v("ac", c.act);
}

export function actualEntered(p: Placement | undefined): boolean {
  const a = slotActuals(p);
  return (["tr", "lo", "fo", "ac"] as const).some((k) => hasVal(a[k]));
}

export interface BlendedTotals {
  est: number;
  blend: number;
  booked: number;
}

export function blendedTotals(placements: Placements, ctx: PlannerCtx): BlendedTotals {
  let est = 0;
  let blend = 0;
  let booked = 0;
  for (const sid in placements) {
    est += slotCosts(sid, placements[sid].stops, ctx).total;
    blend += blendedSlot(sid, placements[sid], ctx);
    if (actualEntered(placements[sid])) booked++;
  }
  return { est, blend, booked };
}

// CI_BASE re-exported here for convenience since costs.ts is the main
// entry point most UI code will import from.
export { CI_BASE };
