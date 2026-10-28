// Phase 26 step 3: search, filters and sort for the activity browser
// (src/components/activities/ActivityBrowser.tsx). Plain functions so they
// can be tested without React.
//
// An activity without tags (a trip not tagged yet) still shows up and still
// matches a text search on its name; it just can't match a tag filter or a
// category, and sorts last by length.
//
// Step 4 adds the cross-city search (searchAcrossTrips) and the activity
// matching behind the catalog's city search (activityMatchesFor).
import type { Trip } from "@/data/trips";
import {
  ACTIVITY_CATEGORIES,
  activityMeta,
  type ActivityCategory,
  type ActivityDuration,
  type ActivityMeta,
} from "@/lib/activityMeta";
import type { ActivityDescriptions } from "@/lib/activityDescriptions";

export interface BrowserItem {
  id: string;
  /** Position in trip.a (the catalog's own order). */
  index: number;
  name: string;
  /** USD per person. */
  price: number;
  meta: ActivityMeta | null;
  description: string;
}

export type QuickFilter = "must" | "book" | "free" | "under25" | "evening" | "short" | "half" | "full";
export type ActivitySort = "must" | "price" | "length";

export interface BrowserQuery {
  text: string;
  quick: QuickFilter[];
  categories: ActivityCategory[];
  sort: ActivitySort;
}

export const EMPTY_QUERY: BrowserQuery = { text: "", quick: [], categories: [], sort: "must" };

/** Order the quick-filter chips appear in. Labels are set by the component
 * (the "Under $25" chip shows the user's currency). */
export const QUICK_FILTERS: QuickFilter[] = ["must", "book", "free", "under25", "evening", "short", "half", "full"];

/** USD threshold for the "Under $25" chip. */
export const UNDER_PRICE = 25;

const DURATION_FILTERS: Partial<Record<QuickFilter, ActivityDuration>> = { short: "short", half: "half", full: "full" };
const LENGTH_RANK: Record<ActivityDuration, number> = { short: 0, half: 1, full: 2, overnight: 3 };

export function browserItems(t: Trip, descriptions: ActivityDescriptions | null = null): BrowserItem[] {
  return t.a.map(([name, price, id], index) => ({
    id,
    index,
    name,
    price,
    meta: activityMeta(t, index),
    description: descriptions?.[t.id]?.[index] ?? "",
  }));
}

function categoryLabel(key: ActivityCategory): string {
  return ACTIVITY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Lowercase words with accents removed ("Café-crawl" -> ["cafe", "crawl"]). */
export function searchWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** True if every query word starts some word of the activity's name,
 * description or category ("kayak" finds "Kayaking"; "art" finds "Museums
 * & art" but not "party"). An empty query matches everything. */
export function matchesText(item: BrowserItem, text: string): boolean {
  const q = searchWords(text);
  if (!q.length) return true;
  const hay = searchWords([item.name, item.description, item.meta ? categoryLabel(item.meta.category) : ""].join(" "));
  return q.every((w) => hay.some((h) => h.startsWith(w)));
}

function matchesQuick(item: BrowserItem, quick: QuickFilter[]): boolean {
  // Length chips widen each other (Under 2 h OR Half day); every other chip
  // narrows the list.
  const lengths = quick.map((q) => DURATION_FILTERS[q]).filter((d): d is ActivityDuration => !!d);
  if (lengths.length && (!item.meta || !lengths.includes(item.meta.duration))) return false;
  for (const q of quick) {
    if (DURATION_FILTERS[q]) continue;
    if (q === "free" && item.price !== 0) return false;
    if (q === "under25" && !(item.price < UNDER_PRICE)) return false;
    if (q === "must" && !item.meta?.mustDo) return false;
    if (q === "book" && !item.meta?.bookAhead) return false;
    if (q === "evening" && item.meta?.when !== "night") return false;
  }
  return true;
}

// Sort order without the catalog-order tiebreak (shared with the
// cross-city search, where items from different cities are compared).
const SORT_KEY: Record<ActivitySort, (a: BrowserItem, b: BrowserItem) => number> = {
  must: (a, b) => Number(!!b.meta?.mustDo) - Number(!!a.meta?.mustDo),
  price: (a, b) => a.price - b.price,
  length: (a, b) => (a.meta ? LENGTH_RANK[a.meta.duration] : 99) - (b.meta ? LENGTH_RANK[b.meta.duration] : 99),
};

/** True when the query narrows anything (text, a chip or a category). */
export function isFiltering(query: BrowserQuery): boolean {
  return searchWords(query.text).length > 0 || query.quick.length > 0 || query.categories.length > 0;
}

/** The items that match the query, in the query's sort order. */
export function queryItems(items: BrowserItem[], query: BrowserQuery): BrowserItem[] {
  const cats = new Set(query.categories);
  const hits = items.filter(
    (it) =>
      matchesText(it, query.text) &&
      matchesQuick(it, query.quick) &&
      (cats.size === 0 || (it.meta !== null && cats.has(it.meta.category)))
  );
  return [...hits].sort((a, b) => SORT_KEY[query.sort](a, b) || a.index - b.index);
}

export interface TripActivityGroup {
  trip: Trip;
  /** Matching activities, in the query's sort order. */
  items: BrowserItem[];
}

/** Step 4: the same query run over every trip, grouped by city. Cities are
 * ordered by their best match under the query's sort, then by number of
 * matches, then catalog order. A query that narrows nothing returns no
 * groups (the UI asks for a search instead of listing all ~3,200). */
export function searchAcrossTrips(
  trips: readonly Trip[],
  query: BrowserQuery,
  descriptions: ActivityDescriptions | null = null
): TripActivityGroup[] {
  if (!isFiltering(query)) return [];
  const groups = trips
    .map((trip, order) => ({ trip, order, items: queryItems(browserItems(trip, descriptions), query) }))
    .filter((g) => g.items.length > 0);
  groups.sort(
    (a, b) => SORT_KEY[query.sort](a.items[0], b.items[0]) || b.items.length - a.items.length || a.order - b.order
  );
  return groups.map(({ trip, items }) => ({ trip, items }));
}

/** Shortest catalog search that also looks inside activities; shorter text
 * ("r" while typing "Rome") would match nearly every city. */
export const MIN_ACTIVITY_QUERY = 3;

/** Names of a trip's activities that match a catalog search (name,
 * description or category; same word matching as above), in catalog order.
 * Empty for a query under MIN_ACTIVITY_QUERY letters. */
export function activityMatchesFor(t: Trip, text: string, descriptions: ActivityDescriptions | null = null): string[] {
  if (searchWords(text).join("").length < MIN_ACTIVITY_QUERY) return [];
  return browserItems(t, descriptions)
    .filter((it) => matchesText(it, text))
    .map((it) => it.name);
}

/** Categories present in this trip, in the standard order, with counts. */
export function categoryCounts(items: BrowserItem[]): { key: ActivityCategory; label: string; emoji: string; count: number }[] {
  const counts = new Map<ActivityCategory, number>();
  for (const it of items) if (it.meta) counts.set(it.meta.category, (counts.get(it.meta.category) ?? 0) + 1);
  return ACTIVITY_CATEGORIES.filter((c) => counts.has(c.key)).map((c) => ({
    key: c.key,
    label: c.label,
    emoji: c.emoji,
    count: counts.get(c.key)!,
  }));
}
