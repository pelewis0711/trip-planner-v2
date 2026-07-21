// Direct port of v1's slot-span and per-stop date allocation
// (reference-v1-app.html:1117-1148). Dates assume departure on slot start.
import type { Slot } from "@/data/slots";
import type { Stop } from "./types";

export const MO_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

// A fixed year is fine here regardless of the plan's actual semester year --
// this only measures the span's length in days, and both endpoints use the
// same year so it cancels out (as long as the span doesn't cross Dec 31).
export function slotSpanDays(s: Slot): number {
  const a = new Date(2027, s.s[0] - 1, s.s[1]);
  const b = new Date(2027, s.e[0] - 1, s.e[1]);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export interface StopDates {
  in: Date;
  out: Date;
}

// `year` matters here -- these dates flow into real booking links (Google
// Flights, lodging check-in/out), so pass the plan's actual semester year
// for custom semesters. Defaults to 2027 (AAU Spring 2027, the only year
// plans without a custom `semester` ever need).
export function stopDates(slot: Slot, stops: Stop[], year = 2027): StopDates[] {
  let cur = new Date(year, slot.s[0] - 1, slot.s[1]);
  return stops.map((st) => {
    const inD = new Date(cur);
    const outD = new Date(cur);
    outD.setDate(outD.getDate() + Math.max(0, st.nights || 0));
    cur = new Date(outD);
    return { in: inD, out: outD };
  });
}

// Which date a leg "happens on", for dated booking links (reference-v1-app.html:1596).
// Out-leg -> first stop's check-in. Back-leg -> last stop's check-out.
// Inter-leg -> that stop's check-in.
export function legDateFor(sd: StopDates[], nStops: number, legCount: number, i: number): Date | null {
  if (!sd.length) return null;
  if (i === 0) return sd[0].in;
  if (i === legCount - 1) return sd[nStops - 1].out;
  return sd[Math.min(i, nStops - 1)].in;
}

export const iso = (d: Date) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");

export const nice = (d: Date) =>
  `${MO_SHORT[d.getMonth() + 1]} ${d.getDate()}, ${d.getFullYear()}`;
