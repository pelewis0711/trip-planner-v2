// Phase 26 steps 3-4: search, filters and sort behind the activity browser,
// the cross-city activity search and the catalog's activity matching.
import { describe, expect, it } from "vitest";
import { TRIPS, type Trip } from "@/data/trips";
import DESCRIPTIONS from "@/data/activityDescriptions.json";
import {
  activityMatchesFor,
  browserItems,
  categoryCounts,
  EMPTY_QUERY,
  matchesText,
  MIN_ACTIVITY_QUERY,
  queryItems,
  searchAcrossTrips,
  searchWords,
  type BrowserQuery,
} from "@/lib/activityBrowser";
import { emptyFilters, tripMatches } from "@/lib/filters";
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

// ---- Phase 26 step 4: search across the whole catalog ----

describe("activity search: word matching", () => {
  it("splits into lowercase words without accents", () => {
    expect(searchWords("Café-crawl in Kraków!")).toEqual(["cafe", "crawl", "in", "krakow"]);
    expect(searchWords("   ")).toEqual([]);
  });

  it("each query word must start a word (kayak finds kayaking; art doesn't find party)", () => {
    const item = { id: "x", index: 0, name: "Sunset kayaking party", price: 0, meta: null, description: "" };
    expect(matchesText(item, "kayak")).toBe(true);
    expect(matchesText(item, "KAYAK sun")).toBe(true);
    expect(matchesText(item, "art")).toBe(false);
    expect(matchesText(item, "kayak wine")).toBe(false);
    expect(matchesText(item, "")).toBe(true);
  });
});

describe("activity search: every city at once", () => {
  const all = (text: string, extra: Partial<BrowserQuery> = {}) =>
    searchAcrossTrips(TRIPS, { ...EMPTY_QUERY, text, ...extra }, descs);

  it("an empty query returns nothing (the page asks for a search instead)", () => {
    expect(all("")).toEqual([]);
  });

  it("kayak finds cities whose names don't mention it, grouped by city", () => {
    const groups = all("kayak");
    expect(groups.length).toBeGreaterThan(10);
    expect(new Set(groups.map((g) => g.trip.id)).size).toBe(groups.length);
    for (const g of groups) {
      expect(g.items.length).toBeGreaterThan(0);
      expect(g.items.every((it) => it.id.startsWith(`${g.trip.id}.`))).toBe(true);
    }
    expect(groups.some((g) => !g.trip.n.toLowerCase().includes("kayak"))).toBe(true);
  });

  it("chips alone work without text, and narrow every city", () => {
    const groups = all("", { quick: ["free", "evening"] });
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.items.every((it) => it.price === 0 && it.meta?.when === "night"))).toBe(true);
  });

  it("cities are ordered by their best match under the sort, then by match count", () => {
    const groups = all("wine", { sort: "price" });
    const firsts = groups.map((g) => g.items[0].price);
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    const byMust = all("food");
    for (let i = 1; i < byMust.length; i++) {
      const [a, b] = [byMust[i - 1], byMust[i]];
      const am = Number(!!a.items[0].meta?.mustDo), bm = Number(!!b.items[0].meta?.mustDo);
      expect(am >= bm).toBe(true);
      if (am === bm) expect(a.items.length).toBeGreaterThanOrEqual(b.items.length);
    }
  });

  it("only searches the cities it's given (Catalog's filters)", () => {
    const italy = TRIPS.filter((t) => t.c === "Italy");
    expect(searchAcrossTrips(italy, { ...EMPTY_QUERY, text: "wine" }, descs).every((g) => g.trip.c === "Italy")).toBe(true);
  });
});

describe("catalog city search matches activities", () => {
  const home: [number, number] = [50.08, 14.43];
  const coords = (id: string) => TRIPS.find((t) => t.id === id)?.co;
  const cities = (q: string) => TRIPS.filter((t) => tripMatches(t, emptyFilters(), q, home, coords, descs));

  it("kayak shows cities even though kayak isn't in their name", () => {
    const hits = cities("kayak");
    expect(hits.length).toBeGreaterThan(10);
    expect(hits.every((t) => activityMatchesFor(t, "kayak", descs).length > 0)).toBe(true);
  });

  it("a city still matches by its own name, country or region", () => {
    expect(cities("Rome").map((t) => t.id)).toContain("rome");
    expect(cities("Croatia").every((t) => t.c === "Croatia" || activityMatchesFor(t, "Croatia", descs).length > 0)).toBe(true);
  });

  it(`activity matching waits for ${MIN_ACTIVITY_QUERY}+ letters, so typing "r" doesn't match every city`, () => {
    expect(activityMatchesFor(rome, "co", descs)).toEqual([]);
    expect(cities("r").every((t) => [t.n, t.c, t.reg].join(" ").toLowerCase().includes("r"))).toBe(true);
    expect(activityMatchesFor(rome, "colosseum", descs)).toContain(rome.a[0][0]);
  });

  it("works before descriptions load (names and categories only)", () => {
    expect(activityMatchesFor(rome, "colosseum")).toContain(rome.a[0][0]);
  });
});
