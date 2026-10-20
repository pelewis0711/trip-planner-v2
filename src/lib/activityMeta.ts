// Phase 26 step 2: activity tags -- category, duration, time of day, must-do
// and book-ahead -- read from src/data/activityMeta.json, which
// scripts/extract-trips.mjs compiles from the hand-written files in
// src/data/activityTags/ (format and rules: scripts/activity-tags.mjs).
//
// The compiled file is aligned with each trip's current activity order and
// lists only trips that have been tagged so far. Everything here returns
// null for an untagged activity, so callers just show less until its batch
// is done. One-line descriptions live in a separate, on-demand file -- see
// src/lib/activityDescriptions.ts.
import type { Trip } from "@/data/trips";
import ACTIVITY_META from "@/data/activityMeta.json";

// Order must match CATEGORIES in scripts/activity-tags.mjs (the compiled
// file stores the index). A test checks the two lists agree.
export const ACTIVITY_CATEGORIES = [
  { key: "landmarks", label: "Landmarks & history", emoji: "🏛️" },
  { key: "museums", label: "Museums & art", emoji: "🖼️" },
  { key: "sacred", label: "Churches & sacred sites", emoji: "⛪" },
  { key: "food", label: "Food & markets", emoji: "🍝" },
  { key: "drink", label: "Wine, beer & drink", emoji: "🍷" },
  { key: "nightlife", label: "Nightlife & shows", emoji: "🎶" },
  { key: "nature", label: "Nature & hikes", emoji: "🥾" },
  { key: "water", label: "Beaches & water", emoji: "🌊" },
  { key: "adventure", label: "Adventure", emoji: "🪂" },
  { key: "views", label: "Views", emoji: "🌄" },
  { key: "walks", label: "Walks & tours", emoji: "🚶" },
  { key: "daytrips", label: "Day trips", emoji: "🚆" },
  { key: "classes", label: "Classes & experiences", emoji: "🧑‍🍳" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["key"];

export const ACTIVITY_DURATIONS = [
  { key: "short", label: "Under 2 hours" },
  { key: "half", label: "Half day" },
  { key: "full", label: "Full day" },
  { key: "overnight", label: "Overnight" },
] as const;
export type ActivityDuration = (typeof ACTIVITY_DURATIONS)[number]["key"];

export const ACTIVITY_WHEN = [
  { key: "day", label: "Daytime" },
  { key: "night", label: "Evening" },
  { key: "any", label: "Any time" },
] as const;
export type ActivityWhen = (typeof ACTIVITY_WHEN)[number]["key"];

const MUST = 1;
const BOOK = 2;

export interface ActivityMeta {
  category: ActivityCategory;
  duration: ActivityDuration;
  when: ActivityWhen;
  /** One of the city's 2-4 must-dos. */
  mustDo: boolean;
  /** Sells out or needs a timed slot -- book ahead. */
  bookAhead: boolean;
}

type CompiledMeta = Record<string, ([number, number, number, number] | null)[]>;
const META = ACTIVITY_META as unknown as CompiledMeta;

/** Tags for the activity at `index` in trip.a, or null if not tagged yet. */
export function activityMeta(t: Trip, index: number, meta: CompiledMeta = META): ActivityMeta | null {
  const row = meta[t.id]?.[index];
  if (!row) return null;
  const [c, d, w, bits] = row;
  const category = ACTIVITY_CATEGORIES[c]?.key;
  const duration = ACTIVITY_DURATIONS[d]?.key;
  const when = ACTIVITY_WHEN[w]?.key;
  if (!category || !duration || !when) return null;
  return { category, duration, when, mustDo: (bits & MUST) !== 0, bookAhead: (bits & BOOK) !== 0 };
}

/** Tags for an activity by id, or null if it isn't in this trip or isn't tagged. */
export function activityMetaById(t: Trip, id: string, meta: CompiledMeta = META): ActivityMeta | null {
  const index = t.a.findIndex(([, , aid]) => aid === id);
  return index < 0 ? null : activityMeta(t, index, meta);
}

/** True once a trip's activities have been tagged. */
export function isTripTagged(t: Trip, meta: CompiledMeta = META): boolean {
  return Array.isArray(meta[t.id]);
}

/** Ids of a trip's must-do activities, in catalog order (empty if untagged). */
export function mustDoIds(t: Trip, meta: CompiledMeta = META): string[] {
  return t.a.filter((_, i) => activityMeta(t, i, meta)?.mustDo).map(([, , id]) => id);
}

export function categoryLabel(key: ActivityCategory): string {
  return ACTIVITY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
