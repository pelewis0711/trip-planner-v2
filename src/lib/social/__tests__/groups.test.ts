import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  groupLodging,
  voteOutcome,
  tripConflicts,
  safeListingUrl,
  GROUP_LIMIT,
  VOTE_WINDOWS,
  ROOM_SIZES,
} from "../groups";
import { lodgingTiers } from "@/lib/calc/cost";
import { bookingComUrl } from "@/lib/calc/booking";
import type { Plan } from "@/lib/store/plan";
const sql = readFileSync("supabase/migrations/0017_groups.sql", "utf8");
describe("group lodging", () => {
  for (let n = 1; n <= 10; n++)
    it(`sizes beds, bedrooms, rooms and booking links for ${n} Going`, () => {
      for (const max of ROOM_SIZES) {
        const [hostel, apt, hotel] = groupLodging(
          3,
          n,
          max,
          "Rome",
          "2027-03-05",
          "2027-03-07",
          2,
        );
        expect(hostel.units).toBe(n);
        expect(hostel.total).toBe(28 * n * 2);
        expect(apt.units).toBe(Math.ceil(n / max));
        expect(apt.total).toBe(lodgingTiers(3, n)[1][1] * n * 2);
        expect(hotel.units).toBe(Math.ceil(n / Math.min(max, 3)));
        expect(hotel.total).toBe(lodgingTiers(3, 1)[2][1] * hotel.units * 2);
        for (const value of [hostel, apt, hotel])
          expect(value.perPerson * n).toBeCloseTo(value.total);
        expect(new URL(hostel.url).searchParams.get("number_of_guests")).toBe(
          String(n),
        );
        expect(new URL(apt.url).searchParams.get("adults")).toBe(String(n));
        expect(new URL(hotel.url).searchParams.get("group_adults")).toBe(
          String(n),
        );
        expect(new URL(hotel.url).searchParams.get("no_rooms")).toBe(
          String(hotel.units),
        );
      }
    });
  it("preserves existing booking URLs and refuses empty estimates", () => {
    expect(bookingComUrl("Rome", "2027-03-05", "2027-03-07", 2)).not.toContain(
      "no_rooms",
    );
    expect(() => groupLodging(3, 0, 2, "Rome", "", "", 2)).toThrow();
  });
});
describe("votes and privacy-safe helpers", () => {
  it("requires a strict majority and re-evaluates the current Going count", () => {
    const deadline = "2027-01-01";
    const now = 0;
    expect(voteOutcome(4, 2, deadline, now)).toBe("open");
    expect(voteOutcome(3, 2, deadline, now)).toBe("passed");
    expect(voteOutcome(0, 0, deadline, now)).toBe("open");
    expect(voteOutcome(2, 2, deadline, new Date(deadline).getTime())).toBe(
      "failed",
    );
  });
  it("warns only about occupied slots with actual year boundaries", () => {
    const plan = {
      semester: { start: "2026-09-01", end: "2027-05-01" },
      slots: [
        { id: "x", s: [12, 31], e: [1, 2], label: "New year" },
        { id: "y", s: [1, 3], e: [1, 4] },
      ],
      placements: { x: { stops: [{ tripId: "rome" }] } },
    } as unknown as Plan;
    expect(
      tripConflicts(plan, {
        start_date: "2027-01-01",
        end_date: "2027-01-03",
      }).map((s) => s.id),
    ).toEqual(["x"]);
    expect(
      tripConflicts(plan, { start_date: "2026-01-01", end_date: "2026-01-03" }),
    ).toEqual([]);
  });
  it("only accepts HTTPS listing URLs without embedded credentials", () => {
    expect(safeListingUrl("javascript:alert(1)")).toBeNull();
    expect(safeListingUrl("https://user:pass@example.com")).toBeNull();
    expect(safeListingUrl("http://example.com")).toBeNull();
    expect(safeListingUrl("https://example.com/stay")).toBe(
      "https://example.com/stay",
    );
  });
  it("keeps SQL and TypeScript group limits, vote windows and room sizes aligned", () => {
    expect(Number(sql.match(/group_id=new.group_id\)>=(\d+)/)?.[1])).toBe(
      GROUP_LIMIT,
    );
    expect(
      sql
        .match(/vote_window in \(([^)]+)\)/)?.[1]
        .replaceAll("'", "")
        .split(","),
    ).toEqual([...VOTE_WINDOWS]);
    expect(
      sql
        .match(/max_per_room in \(([^)]+)\)/)?.[1]
        .split(",")
        .map(Number),
    ).toEqual([...ROOM_SIZES]);
  });
});
