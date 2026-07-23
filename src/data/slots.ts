// Slot types, shared by every plan. The actual slot LIST used to live here
// as a hardcoded, single-semester (AAU Prague, Spring 2027) array with
// Parker's own personal notes baked in ("AAU Ball is Apr 16", etc.) -- that's
// been retired. Slots are now generated per-plan from that plan's own
// start/end/breaks (see src/lib/calc/semester.ts's generateSlots) and stored
// directly on Plan.slots, fully editable afterward (add/rename/delete/adjust
// dates, see the Calendar page's "Edit slots" mode).

export type SlotKind = "weekend" | "special" | "break" | "post";

export interface Slot {
  id: string;
  label: string;
  date: string;
  s: [number, number];
  e: [number, number];
  kind: SlotKind;
  // Optional, blank by default for everyone -- a personal reminder anyone
  // can type onto a slot (e.g. "AAU Ball is this weekend"), no longer a
  // hardcoded, non-editable field baked into the app's data.
  note?: string;
}

// The exact AAU Spring 2027 dates this app used to hardcode, kept ONLY as a
// reference for the one-time migration that moves any pre-existing plan
// (one that predates Plan.slots) onto the new dynamic system without losing
// its placed trips -- see migrate() in src/lib/store/plan.ts. Personal notes
// are stripped here on purpose; this is never imported as a live fallback
// anymore. Do not add new slots here -- this is historical data, not a
// template.
export const LEGACY_SLOTS: Slot[] = [
  { id: "s01", label: "Weekend 1", date: "Jan 30–31", s: [1, 30], e: [1, 31], kind: "weekend" },
  { id: "s02", label: "Weekend 2", date: "Feb 6–7", s: [2, 6], e: [2, 7], kind: "weekend" },
  { id: "s03", label: "Weekend 3", date: "Feb 13–14", s: [2, 13], e: [2, 14], kind: "weekend" },
  { id: "s04", label: "Weekend 4", date: "Feb 20–21", s: [2, 20], e: [2, 21], kind: "weekend" },
  { id: "s05", label: "Weekend 5", date: "Feb 27–28", s: [2, 27], e: [2, 28], kind: "weekend" },
  { id: "s06", label: "Weekend 6", date: "Mar 6–7", s: [3, 6], e: [3, 7], kind: "weekend" },
  { id: "s07", label: "Weekend 7", date: "Mar 13–14", s: [3, 13], e: [3, 14], kind: "weekend" },
  { id: "sSP", label: "St. Patrick's ☘", date: "Mar 16–18 (Tue–Thu)", s: [3, 16], e: [3, 18], kind: "special" },
  { id: "s08", label: "Weekend 8", date: "Mar 20–21", s: [3, 20], e: [3, 21], kind: "weekend" },
  { id: "sBRK", label: "SPRING BREAK", date: "Mar 26 – Apr 4 (9 days)", s: [3, 26], e: [4, 4], kind: "break" },
  { id: "s09", label: "Weekend 9", date: "Apr 10–11", s: [4, 10], e: [4, 11], kind: "weekend" },
  { id: "s10", label: "Weekend 10", date: "Apr 17–18", s: [4, 17], e: [4, 18], kind: "weekend" },
  { id: "s11", label: "Weekend 11", date: "Apr 24–25", s: [4, 24], e: [4, 25], kind: "weekend" },
  { id: "s12", label: "Weekend 12", date: "May 1–2", s: [5, 1], e: [5, 2], kind: "weekend" },
  { id: "s13", label: "Weekend 13", date: "May 8–9", s: [5, 8], e: [5, 9], kind: "weekend" },
  { id: "sPOST", label: "POST-FINALS", date: "May 15–24 (free)", s: [5, 15], e: [5, 24], kind: "post" },
];
