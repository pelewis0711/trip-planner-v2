// Phase 26 step 3: search, filters and sort behind the activity browser.
import { describe, expect, it } from "vitest";
import { TRIPS, type Trip } from "@/data/trips";
import DESCRIPTIONS from "@/data/activityDescriptions.json";
import { browserItems, categoryCounts, EMPTY_QUERY, queryItems, type BrowserQuery } from "@/lib/activityBrowser";
import type { ActivityDescriptions } from "@/lib/activityDescriptions";

const rome = TRIPS.find((t) => t.id === "rome")!;
const descs = DESCRIPTIONS as unknown as ActivityDescriptions;
const items = browserItems(rome, descs);
const q = (over: Partial<BrowserQuery>) => queryItems(items, { ...EMPTY_QUERY, ...over });

describe("activity browser: items", () => {
  it("has one item per activity, tagged, with its description", () => {
    expect(items).toHaveLength(rome.a.length);
    expect(items.every((it) => it.meta !== null)).toBe(true);
    expect(items.every((it) => it.description.length > 0)).toBe(true);
    expect(items.map((it) => it.id)).toEqual(rome.a.map(([, , id]) => id));
  });

  it("works without descriptions loaded yet", () => {
    const bare = browserItems(rome);
    expect(bare.every((it) => it.description === "")).toBe(true);
    expect(queryItems(bare, EMPTY_QUERY)).toHaveLength(rome.a.length);
  });

  it("an untagged trip still lists every activity and finds them by name", () => {
    const untagged: Trip = { ...rome, id: "not-tagged" };
    const list = browserItems(untagged);
    expect(list.every((it) => it.meta === null)).toBe(true);
    expect(queryItems(list, EMPTY_QUERY)).toHaveLength(rome.a.length);
    const first = rome.a[0][0].split(" ")[0];
    expect(queryItems(list, { ...EMPTY_QUERY, text: first }).length).toBeGreaterThan(0);
    // Tag filters can't match an untagged activity.
    expect(queryItems(list, { ...EMPTY_QUERY, quick: ["must"] })).toHaveLength(0);
    expect(categoryCounts(list)).toHaveLength(0);
  });
});

describe("activity browser: filters", () => {
  it("no query returns everything, must-dos first", () => {
    const all = q({});
    expect(all).toHaveLength(items.length);
    const firstNonMust = all.findIndex((it) => !it.meta?.mustDo);
    expect(all.slice(firstNonMust).some((it) => it.meta?.mustDo)).toBe(false);
  });

  it("search matches name, description or category, every word", () => {
    const food = q({ text: "food" });
    expect(food.length).toBeGreaterThan(0);
    for (const it of food) {
      expect([it.name, it.description, it.meta!.category === "food" ? "Food & markets" : ""].join(" ").toLowerCase()).toContain("food");
    }
    expect(q({ text: "  " })).toHaveLength(items.length);
    expect(q({ text: "zzzz-nothing" })).toHaveLength(0);
  });

  it("Free and Under $25 filter by USD price", () => {
    expect(q({ quick: ["free"] }).every((it) => it.price === 0)).toBe(true);
    expect(q({ quick: ["free"] }).length).toBe(items.filter((it) => it.price === 0).length);
    expect(q({ quick: ["under25"] }).every((it) => it.price < 25)).toBe(true);
  });

  it("length chips widen each other; other chips narrow", () => {
    const short = q({ quick: ["short"] }).length;
    const half = q({ quick: ["half"] }).length;
    expect(q({ quick: ["short", "half"] }).length).toBe(short + half);
    const mustShort = q({ quick: ["must", "short"] });
    expect(mustShort.every((it) => it.meta!.mustDo && it.meta!.duration === "short")).toBe(true);
    expect(mustShort.length).toBeLessThanOrEqual(short);
  });

  it("must-do, book-ahead and evening chips use the tags", () => {
    expect(q({ quick: ["must"] }).every((it) => it.meta!.mustDo)).toBe(true);
    expect(q({ quick: ["must"] }).length).toBeGreaterThanOrEqual(2);
    expect(q({ quick: ["book"] }).every((it) => it.meta!.bookAhead)).toBe(true);
    expect(q({ quick: ["evening"] }).every((it) => it.meta!.when === "night")).toBe(true);
  });

  it("categories combine with OR, and counts add up to the whole list", () => {
    const cats = categoryCounts(items);
    expect(cats.reduce((s, c) => s + c.count, 0)).toBe(items.length);
    const [a, b] = cats;
    expect(q({ categories: [a.key] })).toHaveLength(a.count);
    expect(q({ categories: [a.key, b.key] })).toHaveLength(a.count + b.count);
  });
});

describe("activity browser: sort", () => {
  it("price sorts low to high", () => {
    const prices = q({ sort: "price" }).map((it) => it.price);
    expect(prices).toEqual([...prices].sort((x, y) => x - y));
  });

  it("length sorts shortest first", () => {
    const rank = { short: 0, half: 1, full: 2, overnight: 3 } as const;
    const ranks = q({ sort: "length" }).map((it) => rank[it.meta!.duration]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  });

  it("ties keep the catalog's own order", () => {
    const free = q({ quick: ["free"], sort: "price" }).map((it) => it.index);
    expect(free).toEqual([...free].sort((x, y) => x - y));
  });
});
