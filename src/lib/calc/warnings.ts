// Direct port of v1's feasibility warnings — non-blocking, never delete user
// choices (reference-v1-app.html:1116-1135).
import type { Slot } from "@/data/slots";
import type { Trip } from "@/data/trips";
import type { Stop } from "./types";
import type { PricedLeg } from "./pricing";
import { slotSpanDays, MO_SHORT } from "./dates";

export interface Warning {
  lv: "red" | "amber";
  msg: string;
}

export function slotWarnings(
  slot: Slot,
  stops: Stop[],
  legs: PricedLeg[],
  tripOf: (tripId: string) => Trip | undefined
): Warning[] {
  if (!stops.length) return [];
  const days = slotSpanDays(slot);
  const out: Warning[] = [];

  const nights = stops.reduce((n, st) => n + (st.nights || 0), 0);
  if (nights > days) {
    out.push({
      lv: "red",
      msg: `${nights} nights can't fit — this window is only ${days} day${days > 1 ? "s" : ""} (${slot.date})`,
    });
  }

  const hrs = legs.reduce(
    (h, l) => h + (l.mode === "flight" ? 2 + l.km / 750 : l.mode === "train/bus" ? l.km / 75 : 0),
    0
  );
  if (hrs > days * 4) {
    out.push({
      lv: "red",
      msg: `~${Math.round(hrs)}h total transit in a ${days}-day window — mostly a travel day${days > 2 ? "s" : ""}, not a trip`,
    });
  }

  const mo = slot.s[0];
  stops.forEach((st) => {
    const t = tripOf(st.tripId);
    if (t && t.m && t.m.length && !t.m.includes(mo)) {
      out.push({
        lv: "amber",
        msg: `${t.n} is off-season in ${MO_SHORT[mo]} (best: ${t.m.map((m) => MO_SHORT[m]).join("/")})`,
      });
    }
  });

  return out;
}
