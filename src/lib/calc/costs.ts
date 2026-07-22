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

// Phase 8: helper resolving a placement's effective travelers count -- the
// per-slot override if set, otherwise the plan's default. Costs.ts stays
// decoupled from the Zustand store (takes the plain default number, not a
// Plan object), same reasoning as passing ctx/bag instead of the whole plan.
export function travelersFor(p: Placement | undefined, defaultTravelers: number): number {
  return Math.max(1, p?.travelers ?? defaultTravelers ?? 1);
}

// `lodg` is always a PER-PERSON total -- the group total is exactly
// `lodg * travelers` at every tier by construction, so callers just multiply
// by the same travelers count they already have in scope rather than the
// calc engine tracking a second parallel number.
export function slotCosts(slotId: string, stops: Stop[], ctx: PlannerCtx, travelers: number): SlotCosts {
  let act = 0;
  let food = 0;
  let lodg = 0;
  stops.forEach((st) => {
    const t = ctx.tripOf(st.tripId);
    if (!t) return;
    t.a.forEach(([, price], i) => {
      if (st.act[i]) act += price;
    });
    // Signature dishes are a $0 bucket list (Phase 7) -- the food tier below
    // is already the whole day's eating budget, so a checked dish doesn't
    // add anything on top of it. See CLAUDE.md's Phase 7 section.
    const ft = foodTiers(t.ci)[st.fd];
    const lt = lodgingTiers(t.ci, travelers)[st.l];
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

export interface PriceRange {
  floor: number;
  ceiling: number;
}

// Solo round-trip estimate from home at the trip's recommended nights — used
// on catalog cards (Phase 7: a range, not one number, since activities start
// unchecked and each is optional). Both ends use the same cheapest (index 0)
// lodging/food tier and the same travel estimate; only activities vary --
// floor checks none, ceiling checks all of them. Signature-dish prices never
// enter either number (bucket-list items, see slotCosts above). Deliberately
// solo (Phase 8): a trip isn't placed on any slot yet, so there's no real
// group size to use -- catalog browsing always shows the per-person-alone
// number, same as before Phase 8.
export function tripPriceRange(t: Trip, ctx: PlannerCtx): PriceRange {
  let base = 0;
  base += 2 * legEstimate(ctx.homeCoord, ctx.coordsOf(t.id)).cost;
  base += foodTiers(t.ci)[0][1] * daysOf(t.g);
  base += lodgingTiers(t.ci, 1)[0][1] * t.g;

  const allActivities = t.a.reduce((s, [, price]) => s + price, 0);
  return { floor: base, ceiling: base + allActivities };
}

// A single placed stop's "current total" -- same solo-round-trip shape as
// tripPriceRange (so it's directly comparable to that floor/ceiling), but
// using the stop's actually-selected lodging/food tiers and checked
// activities instead of always the cheapest tier / nothing. Shown next to
// the range so a placed trip reads as "$340 of $210-$480", not just a range.
// `travelers` is per-person (Phase 8) -- multiply by it at the call site for
// the group total.
export function stopCurrentEstimate(t: Trip, st: Stop, ctx: PlannerCtx, travelers: number): number {
  let s = 0;
  s += 2 * legEstimate(ctx.homeCoord, ctx.coordsOf(t.id)).cost;
  s += foodTiers(t.ci)[st.fd][1] * daysOf(st.nights);
  s += lodgingTiers(t.ci, travelers)[st.l][1] * st.nights;
  t.a.forEach(([, price], i) => {
    if (st.act[i]) s += price;
  });
  return s;
}

export interface GrandTotals {
  act: number;
  food: number;
  travel: number;
  lodg: number;
  total: number;
  // Phase 8: whole-group figures. Computed per-slot (total|lodg * that
  // slot's own travelers) and summed -- NOT the per-person grand total times
  // a single travelers count, since different slots can have different
  // group sizes (solo one weekend, a group of 4 the next).
  totalGroup: number;
  lodgGroup: number;
  count: number;
  stops: number;
}

export function grandTotals(placements: Placements, ctx: PlannerCtx, defaultTravelers = 1): GrandTotals {
  const g: GrandTotals = { act: 0, food: 0, travel: 0, lodg: 0, total: 0, totalGroup: 0, lodgGroup: 0, count: 0, stops: 0 };
  for (const id in placements) {
    const travelers = travelersFor(placements[id], defaultTravelers);
    const c = slotCosts(id, placements[id].stops, ctx, travelers);
    g.act += c.act;
    g.food += c.food;
    g.travel += c.travel;
    g.lodg += c.lodg;
    g.total += c.total;
    g.totalGroup += c.total * travelers;
    g.lodgGroup += c.lodg * travelers;
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

export function blendedSlot(slotId: string, p: Placement, ctx: PlannerCtx, travelers: number): number {
  const c = slotCosts(slotId, p.stops, ctx, travelers);
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
  estGroup: number;
  blendGroup: number;
}

export function blendedTotals(placements: Placements, ctx: PlannerCtx, defaultTravelers = 1): BlendedTotals {
  let est = 0;
  let blend = 0;
  let booked = 0;
  let estGroup = 0;
  let blendGroup = 0;
  for (const sid in placements) {
    const travelers = travelersFor(placements[sid], defaultTravelers);
    const slotEst = slotCosts(sid, placements[sid].stops, ctx, travelers).total;
    const slotBlend = blendedSlot(sid, placements[sid], ctx, travelers);
    est += slotEst;
    blend += slotBlend;
    estGroup += slotEst * travelers;
    blendGroup += slotBlend * travelers;
    if (actualEntered(placements[sid])) booked++;
  }
  return { est, blend, booked, estGroup, blendGroup };
}

// CI_BASE re-exported here for convenience since costs.ts is the main
// entry point most UI code will import from.
export { CI_BASE };
