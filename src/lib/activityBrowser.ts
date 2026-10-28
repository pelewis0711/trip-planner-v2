// Phase 26 step 3: search, filters and sort for the activity browser
// (src/components/activities/ActivityBrowser.tsx). Plain functions so they
// can be tested without React.
//
// An activity without tags (a trip not tagged yet) still shows up and still
// matches a text search on its name; it just can't match a tag filter or a
// category, and sorts last by length.
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

function matchesText(item: BrowserItem, text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return true;
  const hay = [item.name, item.description, item.meta ? categoryLabel(item.meta.category) : ""].join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
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

/** The items that match the query, in the query's sort order. */
export function queryItems(items: BrowserItem[], query: BrowserQuery): BrowserItem[] {
  const cats = new Set(query.categories);
  const hits = items.filter(
    (it) =>
      matchesText(it, query.text) &&
      matchesQuick(it, query.quick) &&
      (cats.size === 0 || (it.meta !== null && cats.has(it.meta.category)))
  );
  const byIndex = (a: BrowserItem, b: BrowserItem) => a.index - b.index;
  const sorters: Record<ActivitySort, (a: BrowserItem, b: BrowserItem) => number> = {
    must: (a, b) => Number(!!b.meta?.mustDo) - Number(!!a.meta?.mustDo) || byIndex(a, b),
    price: (a, b) => a.price - b.price || byIndex(a, b),
    length: (a, b) =>
      (a.meta ? LENGTH_RANK[a.meta.duration] : 99) - (b.meta ? LENGTH_RANK[b.meta.duration] : 99) || byIndex(a, b),
  };
  return [...hits].sort(sorters[query.sort]);
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
