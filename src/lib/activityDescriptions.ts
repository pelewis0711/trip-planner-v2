"use client";

// Phase 26 step 2: one-line activity descriptions, loaded on demand.
//
// Tags and prices ship with the app; descriptions are the bulky part (about
// 100 KB compressed now, ~210 KB once the catalog is full), so they live in
// src/data/activityDescriptions.json and load the first time something asks
// for them. The file becomes its own build chunk under /_next/static/, which
// the service worker caches forever (cache-first), so once loaded they work
// offline too.
//
// The compiled file is aligned with each trip's current activity order and
// lists only tagged trips; a missing description is just "".
import { useSyncExternalStore } from "react";
import type { Trip } from "@/data/trips";

export type ActivityDescriptions = Record<string, string[]>;

let loaded: ActivityDescriptions | null = null;
let pending: Promise<ActivityDescriptions> | null = null;
const listeners = new Set<() => void>();

/** Loads the descriptions once; later calls reuse the same result. If the
 * load fails (offline before it was ever cached), the next call retries. */
export function loadActivityDescriptions(): Promise<ActivityDescriptions> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) {
    pending = import("@/data/activityDescriptions.json")
      .then((m) => {
        loaded = (m.default ?? m) as unknown as ActivityDescriptions;
        listeners.forEach((l) => l());
        return loaded;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Start loading as soon as a component wants them; failures just leave
  // descriptions hidden (retried on the next subscribe).
  loadActivityDescriptions().catch(() => {});
  return () => listeners.delete(listener);
}

/** Descriptions for every tagged trip, or null while they're loading. */
export function useActivityDescriptions(): ActivityDescriptions | null {
  return useSyncExternalStore(subscribe, () => loaded, () => null);
}

/** The description for the activity at `index` in trip.a ("" if none). */
export function activityDescription(descriptions: ActivityDescriptions | null, t: Trip, index: number): string {
  return descriptions?.[t.id]?.[index] ?? "";
}
