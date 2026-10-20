// Phase 26 step 2: activity tags -- the authoring rules, the compiled files,
// and the app-side readers.
import { describe, it, expect } from "vitest";
import { TRIPS, type Trip } from "@/data/trips";
import META from "@/data/activityMeta.json";
import DESCRIPTIONS from "@/data/activityDescriptions.json";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_DURATIONS,
  ACTIVITY_WHEN,
  activityMeta,
  activityMetaById,
  isTripTagged,
  mustDoIds,
} from "@/lib/activityMeta";
import { activityDescription, loadActivityDescriptions } from "@/lib/activityDescriptions";
import * as tagRules from "../../../scripts/activity-tags.mjs";

type Entry = [string, string, string, string, string];
const { CATEGORIES, DURATIONS, WHEN, validateTags, compileTags } = tagRules as unknown as {
  CATEGORIES: string[];
  DURATIONS: string[];
  WHEN: string[];
  validateTags: (trips: Trip[], sources: { file: string; tripId: string; tags: Record<string, Entry> }[]) => { errors: string[]; warnings: string[] };
  compileTags: (trips: Trip[], sources: { file: string; tripId: string; tags: Record<string, Entry> }[]) => {
    meta: Record<string, ([number, number, number, number] | null)[]>;
    descriptions: Record<string, string[]>;
  };
};

const compiledMeta = META as unknown as Record<string, ([number, number, number, number] | null)[]>;
const compiledDescriptions = DESCRIPTIONS as unknown as Record<string, string[]>;

// A small made-up trip so the rules can be tested without real data.
const fake: Trip = {
  ...TRIPS[0],
  id: "testville",
  a: [
    ["Old castle", 12, "testville.old-castle"],
    ["Wine bar crawl", 30, "testville.wine-bar-crawl"],
    ["River swim", 0, "testville.river-swim"],
  ],
};
const goodTags: Record<string, Entry> = {
  "old-castle": ["landmarks", "half", "day", "must book", "Hilltop fortress with a timed-entry tower climb"],
  "wine-bar-crawl": ["drink", "short", "night", "must", "Three cellar bars pouring local reds"],
  "river-swim": ["water", "short", "day", "", "Free swimming spot below the old bridge"],
};
const source = (tags: Record<string, Entry>) => [{ file: "test.json", tripId: "testville", tags }];

describe("tag lists", () => {
  it("the app's lists match the build script's, in the same order", () => {
    expect(ACTIVITY_CATEGORIES.map((c) => c.key)).toEqual(CATEGORIES);
    expect(ACTIVITY_DURATIONS.map((d) => d.key)).toEqual(DURATIONS);
    expect(ACTIVITY_WHEN.map((w) => w.key)).toEqual(WHEN);
    expect(ACTIVITY_CATEGORIES).toHaveLength(14);
  });
});

describe("authoring rules", () => {
  it("a complete, well-formed trip passes", () => {
    expect(validateTags([fake], source(goodTags)).errors).toEqual([]);
  });

  it("rejects a partly tagged trip, unknown values and a bad must-do count", () => {
    const { "river-swim": _omit, ...partial } = goodTags;
    void _omit;
    expect(validateTags([fake], source(partial)).errors.join("\n")).toMatch(/not tagged/);
    const bad = { ...goodTags, "river-swim": ["swimming", "ages", "dawn", "maybe", ""] as Entry };
    const errors = validateTags([fake], source(bad)).errors.join("\n");
    for (const m of [/unknown category/, /unknown duration/, /unknown when/, /bad flags/, /missing description/]) expect(errors).toMatch(m);
    const oneMust = { ...goodTags, "wine-bar-crawl": ["drink", "short", "night", "", "Three cellar bars"] as Entry };
    expect(validateTags([fake], source(oneMust)).errors.join("\n")).toMatch(/1 must-dos/);
  });

  it("rejects a description over 90 characters", () => {
    const long = { ...goodTags, "river-swim": ["water", "short", "day", "", "x".repeat(91)] as Entry };
    expect(validateTags([fake], source(long)).errors.join("\n")).toMatch(/91 chars/);
  });

  it("compiles to rows aligned with the activity order, flags as bits", () => {
    const { meta, descriptions } = compileTags([fake], source(goodTags));
    expect(meta.testville).toEqual([
      [0, 1, 0, 3],
      [4, 0, 1, 1],
      [7, 0, 0, 0],
    ]);
    expect(descriptions.testville[1]).toBe("Three cellar bars pouring local reds");
    expect(activityMeta(fake, 0, meta)).toEqual({ category: "landmarks", duration: "half", when: "day", mustDo: true, bookAhead: true });
    expect(activityMetaById(fake, "testville.river-swim", meta)).toMatchObject({ category: "water", mustDo: false, bookAhead: false });
    expect(mustDoIds(fake, meta)).toEqual(["testville.old-castle", "testville.wine-bar-crawl"]);
  });

  it("an untagged trip or activity reads as null, not an error", () => {
    expect(activityMeta(fake, 0, {})).toBeNull();
    expect(isTripTagged(fake, {})).toBe(false);
    expect(mustDoIds(fake, {})).toEqual([]);
  });
});

describe("the compiled data", () => {
  const tagged = TRIPS.filter((t) => isTripTagged(t));

  it("every tagged trip has tags and a description for every activity, in order", () => {
    for (const t of tagged) {
      expect(compiledMeta[t.id], t.id).toHaveLength(t.a.length);
      expect(compiledDescriptions[t.id], t.id).toHaveLength(t.a.length);
      t.a.forEach((_, i) => {
        expect(activityMeta(t, i), `${t.id} #${i}`).not.toBeNull();
        expect(compiledDescriptions[t.id][i].length, `${t.id} #${i}`).toBeGreaterThan(0);
      });
      const must = mustDoIds(t).length;
      expect(must >= 2 && must <= 4, `${t.id} has ${must} must-dos`).toBe(true);
    }
  });

  it("descriptions load on demand and match the compiled file", async () => {
    const loadedDescriptions = await loadActivityDescriptions();
    expect(loadedDescriptions).toEqual(compiledDescriptions);
    expect(await loadActivityDescriptions()).toBe(loadedDescriptions);
    for (const t of tagged.slice(0, 3)) {
      expect(activityDescription(loadedDescriptions, t, 0)).toBe(compiledDescriptions[t.id][0]);
    }
    expect(activityDescription(null, TRIPS[0], 0)).toBe("");
  });
});
