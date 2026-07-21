// Direct port of v1's slot-span and per-stop date allocation
// (reference-v1-app.html:1117-1148). Dates assume departure on slot start.
import type { Slot } from "@/data/slots";
import type { Stop } from "./types";

export const MO_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

export function slotSpanDays(s: Slot): number {
  const a = new Date(2027, s.s[0] - 1, s.s[1]);
  const b = new Date(2027, s.e[0] - 1, s.e[1]);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export interface StopDates {
  in: Date;
  out: Date;
}

export function stopDates(slot: Slot, stops: Stop[]): StopDates[] {
  let cur = new Date(2027, slot.s[0] - 1, slot.s[1]);
  return stops.map((st) => {
    const inD = new Date(cur);
    const outD = new Date(cur);
    outD.setDate(outD.getDate() + Math.max(0, st.nights || 0));
    cur = new Date(outD);
    return { in: inD, out: outD };
  });
}

export const iso = (d: Date) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");

export const nice = (d: Date) =>
  `${MO_SHORT[d.getMonth() + 1]} ${d.getDate()}, ${d.getFullYear()}`;
