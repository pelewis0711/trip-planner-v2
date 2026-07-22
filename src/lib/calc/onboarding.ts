// Phase 6: term-based smart defaults for onboarding's dates-confirmation
// step, used whenever the chosen host university isn't in the seed database
// (src/data/universitySemesters.ts) -- or wasn't matched yet because the
// user skipped that field. Every date produced here is still fully editable
// (see src/components/SemesterDatesForm.tsx), this just gives a reasonable
// starting point instead of a blank form.
import type { CustomBreak, SemesterConfig } from "./semester";

export type Term = "fall" | "spring" | "winter";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The next upcoming calendar year in which `term` would run, relative to
 * `today` -- e.g. asking for "fall" in July 2026 returns 2026 (Aug-Dec 2026
 * hasn't happened yet), but asking in October 2026 returns 2027. */
function nextYearFor(term: Term, today: Date): number {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (term === "fall") return m <= 8 ? y : y + 1;
  // spring/winter run Jan-May of a year; once March passes, the next
  // instance is next year's
  return m <= 3 ? y : y + 1;
}

/** Typical late-Jan-late-May spring / late-Aug-mid-Dec fall / short January
 * winter window, for the nearest upcoming instance of that term. A
 * post-finals break (last ~9 days before `end`) is always included, since
 * every plan gets one regardless of source. */
export function smartDefaultSemester(term: Term, today: Date = new Date()): SemesterConfig {
  const y = nextYearFor(term, today);

  let start: string;
  let end: string;
  if (term === "fall") {
    start = iso(y, 8, 25);
    end = iso(y, 12, 12);
  } else if (term === "spring") {
    start = iso(y, 1, 24);
    end = iso(y, 5, 24);
  } else {
    start = iso(y, 1, 8);
    end = iso(y, 1, 31);
  }

  const breaks: CustomBreak[] = [postFinalsBreak(end)];
  return { start, end, breaks };
}

/** Computed, not researched: the last ~9 days before a program's official
 * end date, matching the AAU Spring 2027 calendar's own POST-FINALS window
 * shape (May 15-24). Known simplification -- see CLAUDE.md. */
export function postFinalsBreak(end: string, days = 9): CustomBreak {
  const [y, m, d] = end.split("-").map(Number);
  const endDate = new Date(y, m - 1, d);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return {
    id: "post",
    label: "POST-FINALS",
    start: iso(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
    end,
    kind: "post",
  };
}
