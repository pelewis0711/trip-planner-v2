// Overlays live flight prices onto the (unchanged, still fully tested)
// static cost engine. Kept as a separate layer on purpose -- slotCosts()/
// grandTotals() stay pure estimates; this is what the "use live prices"
// per-plan toggle switches to in the UI.
import { IATA } from "@/data/iata";
import type { Slot } from "@/data/slots";
import type { Placements } from "./types";
import type { PlannerCtx } from "./context";
import { slotCosts, travelersFor, type SlotCosts, type GrandTotals } from "./costs";
import { stopDates, legDateFor, iso, type StopDates } from "./dates";
import { legKey, type LivePrice } from "@/lib/store/livePrices";

export function iataFor(cityName: string): string | undefined {
  return IATA[cityName];
}

export interface FlightLegInfo {
  index: number;
  date: Date | null;
  origin?: string;
  destination?: string;
  key?: string;
}

/** For each flight leg in a slot, works out the IATA origin/destination and
 * the live-price-store key -- or leaves them undefined when the cities
 * aren't mapped or the leg has no resolvable date. */
export function flightLegInfos(
  legs: { mode: string; from: string; to: string }[],
  sd: StopDates[],
  nStops: number
): FlightLegInfo[] {
  return legs.reduce<FlightLegInfo[]>((out, leg, index) => {
    if (leg.mode !== "flight") return out;
    const date = legDateFor(sd, nStops, legs.length, index);
    const origin = iataFor(leg.from);
    const destination = iataFor(leg.to);
    const key = date && origin && destination ? legKey(origin, destination, iso(date)) : undefined;
    out.push({ index, date, origin, destination, key });
    return out;
  }, []);
}

export interface LiveSlotCosts extends SlotCosts {
  liveLegIndexes: Set<number>;
}

/** Swaps in a live price for any flight leg that has one; everything else
 * (train/bus, local, unmapped cities, not-yet-fetched) keeps its estimate. */
export function applyLivePrices(
  costs: SlotCosts,
  legInfos: FlightLegInfo[],
  livePrices: Record<string, LivePrice>
): LiveSlotCosts {
  const liveLegIndexes = new Set<number>();
  const infoByIndex = new Map(legInfos.map((i) => [i.index, i]));

  const legs = costs.legs.map((leg, i) => {
    const key = infoByIndex.get(i)?.key;
    const live = key ? livePrices[key] : undefined;
    if (live && live.price !== null) {
      liveLegIndexes.add(i);
      return { ...leg, cost: live.price };
    }
    return leg;
  });

  const travel = legs.reduce((s, l) => s + l.cost, 0);
  return { ...costs, legs, travel, total: costs.act + costs.food + costs.lodg + travel, liveLegIndexes };
}

export function liveSlotCosts(
  slotId: string,
  slot: Slot | undefined,
  stops: Placements[string]["stops"],
  ctx: PlannerCtx,
  year: number,
  livePrices: Record<string, LivePrice>,
  travelers: number
): LiveSlotCosts {
  const costs = slotCosts(slotId, stops, ctx, travelers);
  if (!slot) return { ...costs, liveLegIndexes: new Set() };
  const sd = stopDates(slot, stops, year);
  const legInfos = flightLegInfos(costs.legs, sd, stops.length);
  return applyLivePrices(costs, legInfos, livePrices);
}

/** Same shape as grandTotals(), but flight legs use a live price where one's
 * been fetched. Slots aren't in `slots` (e.g. a stale placement after a
 * semester change) just fall back to the plain estimate. */
export function liveAdjustedGrandTotals(
  placements: Placements,
  ctx: PlannerCtx,
  slots: Slot[],
  year: number,
  livePrices: Record<string, LivePrice>,
  defaultTravelers = 1
): GrandTotals {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const g: GrandTotals = { act: 0, food: 0, travel: 0, lodg: 0, total: 0, totalGroup: 0, lodgGroup: 0, count: 0, stops: 0 };

  for (const id in placements) {
    const stops = placements[id].stops;
    const travelers = travelersFor(placements[id], defaultTravelers);
    const c = liveSlotCosts(id, slotById.get(id), stops, ctx, year, livePrices, travelers);
    g.act += c.act;
    g.food += c.food;
    g.lodg += c.lodg;
    g.travel += c.travel;
    g.total += c.total;
    g.totalGroup += c.total * travelers;
    g.lodgGroup += c.lodg * travelers;
    g.count++;
    g.stops += stops.length;
  }
  return g;
}
