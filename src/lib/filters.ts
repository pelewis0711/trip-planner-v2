// Direct port of v1's catalog/tray filters (reference-v1-app.html:1255-1290).
// OR within a group, AND across groups.
import type { Trip } from "@/data/trips";
import { TRIPS } from "@/data/trips";
import { tierOf } from "./calc/cost";
import { travelHours } from "./calc/routing";

export type FilterKey =
  | "region"
  | "time"
  | "trav"
  | "wx"
  | "cost"
  | "type"
  | "length"
  | "cat"
  | "country";

export type FilterState = Record<FilterKey, Set<string>>;

export function emptyFilters(): FilterState {
  return {
    region: new Set(),
    time: new Set(),
    trav: new Set(),
    wx: new Set(),
    cost: new Set(),
    type: new Set(),
    length: new Set(),
    cat: new Set(),
    country: new Set(),
  };
}

export const lengthKey = (g: number) => (g === 0 ? "day" : g === 1 ? "1n" : g === 2 ? "2n" : "3n");
export const timeKey = (mo: number): string =>
  ({ 2: "feb", 3: "mar", 4: "apr", 5: "may" }[mo] || "may");
export const travKey = (hours: number) => (hours < 3 ? "t3" : hours < 6 ? "t6" : "t9");

export function tripMatches(
  t: Trip,
  filters: FilterState,
  query: string,
  homeCoord: [number, number],
  coordsOf: (tripId: string) => [number, number] | undefined
): boolean {
  if (query) {
    const q = query.toLowerCase();
    if (
      !(
        t.n.toLowerCase().includes(q) ||
        t.c.toLowerCase().includes(q) ||
        t.reg.toLowerCase().includes(q)
      )
    )
      return false;
  }
  if (filters.region.size && !filters.region.has(t.reg)) return false;
  if (filters.cost.size && !filters.cost.has(tierOf(t.ci))) return false;
  if (filters.type.size && !t.t.some((x) => filters.type.has(x))) return false;
  if (filters.country.size && !filters.country.has(t.c)) return false;
  if (filters.cat.size && !t.cats.some((x) => filters.cat.has(x))) return false;
  if (filters.length.size && !filters.length.has(lengthKey(t.g))) return false;
  if (filters.time.size && !t.m.some((mo) => filters.time.has(timeKey(mo)))) return false;
  if (filters.wx.size && !filters.wx.has(t.wx)) return false;
  if (filters.trav.size) {
    const hours = travelHours(t.id, homeCoord, coordsOf);
    if (!filters.trav.has(travKey(hours))) return false;
  }
  return true;
}

export interface FilterOption {
  val: string;
  label: string;
}

export interface FilterGroup {
  key: FilterKey;
  label: string;
  opts: FilterOption[];
}

export function buildFilterGroups(trips: Trip[] = TRIPS): FilterGroup[] {
  return [
    {
      key: "region",
      label: "Region",
      opts: [...new Set(trips.map((t) => t.reg))].sort().map((r) => ({ val: r, label: r })),
    },
    {
      key: "time",
      label: "Best time of semester",
      opts: [
        { val: "feb", label: "Early · Feb" },
        { val: "mar", label: "Mid · Mar" },
        { val: "apr", label: "Late · Apr" },
        { val: "may", label: "May / post-finals" },
      ],
    },
    {
      key: "trav",
      label: "Travel time from home",
      opts: [
        { val: "t3", label: "Under 3h" },
        { val: "t6", label: "3–6h" },
        { val: "t9", label: "6h+" },
      ],
    },
    {
      key: "wx",
      label: "Weather",
      opts: [
        { val: "Warm", label: "☀ Warm" },
        { val: "Mild", label: "🌤 Mild" },
        { val: "Cool", label: "🍃 Cool" },
        { val: "Cold", label: "❄ Cold" },
        { val: "Rainy", label: "🌧 Rainy" },
      ],
    },
    {
      key: "cost",
      label: "Cost",
      opts: [
        { val: "b", label: "Budget $" },
        { val: "m", label: "Mid $$" },
        { val: "s", label: "Splurge $$$" },
      ],
    },
    {
      key: "type",
      label: "Trip type",
      opts: [
        { val: "history", label: "History" },
        { val: "scenic", label: "Scenic" },
        { val: "beach", label: "Beach" },
        { val: "nightlife", label: "Nightlife" },
      ],
    },
    {
      key: "length",
      label: "Suggested length",
      opts: [
        { val: "day", label: "Day trip" },
        { val: "1n", label: "1 night" },
        { val: "2n", label: "2 nights" },
        { val: "3n", label: "3+ nights" },
      ],
    },
    {
      key: "cat",
      label: "Activity type",
      opts: [...new Set(trips.flatMap((t) => t.cats))].sort().map((c) => ({ val: c, label: c })),
    },
    {
      key: "country",
      label: "Country",
      opts: [...new Set(trips.map((t) => t.c))].sort().map((c) => ({ val: c, label: c })),
    },
  ];
}

export function activeFilterCount(filters: FilterState, query: string): number {
  return (
    Object.values(filters).reduce((n, s) => n + s.size, 0) + (query ? 1 : 0)
  );
}
