// Per-plan semester config, for friends at other schools whose dates don't
// match AAU's. A plan with no `semester` set keeps using the exact
// hand-authored SLOTS list (zero behavior change for existing plans);
// setting one switches that plan over to slots generated from its own
// start/end + custom breaks.
import { SLOTS, type Slot, type SlotKind } from "@/data/slots";
import type { Plan } from "@/lib/store/plan";

export interface CustomBreak {
  id: string;
  label: string;
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd, inclusive
  kind: Exclude<SlotKind, "weekend">;
}

export interface SemesterConfig {
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
  breaks: CustomBreak[];
}

// AAU Spring 2027 dates, used to pre-fill the "customize semester" form —
// NOT consulted at slot-generation time (plans with no `semester` just use
// the static SLOTS array directly, see getSlotsForPlan below).
export const DEFAULT_SEMESTER: SemesterConfig = {
  start: "2027-01-24",
  end: "2027-05-24",
  breaks: [
    { id: "sp", label: "St. Patrick's ☘", start: "2027-03-16", end: "2027-03-18", kind: "special" },
    { id: "brk", label: "SPRING BREAK", start: "2027-03-26", end: "2027-04-04", kind: "break" },
    { id: "post", label: "POST-FINALS", start: "2027-05-15", end: "2027-05-24", kind: "post" },
  ],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtRange(a: Date, b: Date): string {
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  return `${left}–${right}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Weekend slots (every Sat–Sun in range, skipping ones inside a break) plus
 * one slot per custom break, all sorted chronologically. Assumes the
 * semester doesn't cross a Dec 31 -> Jan 1 boundary (fine for a single
 * study-abroad term). */
export function generateSlots(config: SemesterConfig): Slot[] {
  const start = parseISO(config.start);
  const end = parseISO(config.end);
  const breakRanges = config.breaks.map((b) => ({ ...b, s: parseISO(b.start), e: parseISO(b.end) }));

  const dated: { slot: Slot; sortDate: Date }[] = breakRanges.map((b) => ({
    slot: {
      id: `cb_${b.id}`,
      label: b.label,
      date: fmtRange(b.s, b.e),
      s: [b.s.getMonth() + 1, b.s.getDate()],
      e: [b.e.getMonth() + 1, b.e.getDate()],
      kind: b.kind,
    },
    sortDate: b.s,
  }));

  const cursor = new Date(start);
  while (cursor.getDay() !== 6) cursor.setDate(cursor.getDate() + 1);

  let weekendNum = 1;
  while (cursor <= end) {
    const sat = new Date(cursor);
    const sun = new Date(cursor);
    sun.setDate(sun.getDate() + 1);

    if (sun <= end && !breakRanges.some((b) => overlaps(sat, sun, b.s, b.e))) {
      dated.push({
        slot: {
          id: `w${weekendNum}`,
          label: `Weekend ${weekendNum}`,
          date: fmtRange(sat, sun),
          s: [sat.getMonth() + 1, sat.getDate()],
          e: [sun.getMonth() + 1, sun.getDate()],
          kind: "weekend",
        },
        sortDate: sat,
      });
      weekendNum++;
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  return dated.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime()).map((x) => x.slot);
}

export function getSlotsForPlan(plan: Plan): Slot[] {
  return plan.semester ? generateSlots(plan.semester) : SLOTS;
}

/** Union of slots across several plans (by id, first-seen wins), sorted by
 * month/day — used by Compare when the plans being compared have different
 * semesters and therefore different slot sets. */
export function unionSlots(plans: Plan[]): Slot[] {
  const seen = new Map<string, Slot>();
  plans.forEach((p) => getSlotsForPlan(p).forEach((s) => { if (!seen.has(s.id)) seen.set(s.id, s); }));
  return Array.from(seen.values()).sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1]);
}
