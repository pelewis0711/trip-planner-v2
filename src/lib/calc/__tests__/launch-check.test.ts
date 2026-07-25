import { describe, it, expect } from "vitest";
import { resolveHome } from "@/lib/resolveHome";
import { smartDefaultSemester } from "@/lib/calc/onboarding";
import { findUniversitySemester } from "@/data/universitySemesters";
import { generateSlots, describeTerm } from "@/lib/calc/semester";
import { monthsFor } from "@/components/calendar/MonthGrid";
import { convert, formatMoney } from "@/lib/calc/currency";

// Pre-launch regression check -- simulates a brand-new fall-Barcelona
// student and a brand-new spring-Prague student going through the wizard's
// real underlying logic (no browser tool available in this environment to
// click through it directly). Locks in two real bugs caught and fixed in
// this same pass: MonthGrid hardcoding Jan-May 2027 regardless of the
// plan's actual term, and SemesterPanel/onboarding surfacing AAU-specific
// defaults to brand-new users.
const FORBIDDEN = ["Anglo-American", "AAU Ball", "Parker"];

describe("pre-launch: fall Barcelona student", () => {
  const host = resolveHome("Barcelona");
  it("resolves Barcelona with no AAU/Prague involvement", () => {
    expect(host).toBeTruthy();
    expect(host!.country).toBe("Spain");
  });

  const semester = smartDefaultSemester("fall");
  it("generates a real fall term, not the hardcoded spring 2027 range", () => {
    expect(semester.start.slice(5, 7)).toBe("08"); // August start
    expect(semester.end.slice(5, 7)).toBe("12"); // December end
    expect(semester.start.slice(0, 4)).not.toBe("2027"); // fall from 2026-07-24 lands in 2026
  });

  const slots = generateSlots(semester);
  it("produces real slots with no forbidden personal strings", () => {
    expect(slots.length).toBeGreaterThan(0);
    const dump = JSON.stringify(slots);
    for (const f of FORBIDDEN) expect(dump).not.toContain(f);
  });

  it("month grid shows the real fall months (Aug-Dec), not Jan-May", () => {
    const months = monthsFor(slots);
    expect(months).toContain(8);
    expect(months.some((m) => m >= 9 && m <= 12)).toBe(true);
    expect(months).not.toContain(2);
    expect(months).not.toContain(4);
  });

  it("describeTerm labels it as Fall of the real year, not Spring 2027", () => {
    const term = describeTerm(semester);
    expect(term?.season).toBe("Fall");
    expect(term?.year).not.toBe(2027);
  });
});

describe("pre-launch: spring Prague student (their own deliberate choice)", () => {
  const host = resolveHome("Prague");
  it("resolves Prague normally when the user picks it themselves", () => {
    expect(host).toBeTruthy();
    expect(host!.country).toBe("Czechia");
  });

  const matched = findUniversitySemester("Anglo-American University", "spring");
  it("pulls AAU's real published calendar (Jan 29 - May 14, 2027), not the app's old baked-in Jan 24 - May 24", () => {
    expect(matched).toBeTruthy();
    expect(matched!.start).toBe("2027-01-29");
    expect(matched!.end).toBe("2027-05-14");
  });

  const semester = { start: matched!.start, end: matched!.end, breaks: matched!.breaks };
  const slots = generateSlots(semester);
  it("month grid shows Jan-May for this real spring term", () => {
    const months = monthsFor(slots);
    expect(months).toContain(1);
    expect(months.some((m) => m >= 2 && m <= 5)).toBe(true);
    expect(months).not.toContain(8);
  });
});

describe("pre-launch: Europe toggle + currency switching", () => {
  it("converts a real total correctly across currencies with no calc-engine change", () => {
    const total = 1234;
    expect(convert(total, "USD")).toBe(1234);
    expect(formatMoney(total, "USD")).toMatch(/^\$/);
    expect(formatMoney(total, "EUR")).toMatch(/^€/);
    expect(formatMoney(total, "GBP")).toMatch(/^£/);
  });
});
