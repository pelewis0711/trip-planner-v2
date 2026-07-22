// Direct port of v1's Schengen 90/180 tracker (reference-v1-app.html:1065-1083).
// Counts nights+1 per stop in a Schengen country other than the home country
// (the home country is exempt — covered by the study visa). Deliberately
// conservative: it over-counts on purpose.
import type { Placements } from "./types";
import type { Trip } from "@/data/trips";
import { useCustomHomesStore } from "@/lib/store/customHomes";

export const SCHENGEN = new Set([
  "Andorra", "Austria", "Belgium", "Bulgaria", "Croatia", "Czechia", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland",
  "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Monaco",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia",
  "Slovenia", "Spain", "Sweden", "Switzerland",
]);

export const HOME_COUNTRY: Record<string, string> = {
  Prague: "Czechia", Rome: "Italy", Florence: "Italy", Milan: "Italy",
  Barcelona: "Spain", Madrid: "Spain", Seville: "Spain", Paris: "France",
  London: "England", Dublin: "Ireland", Berlin: "Germany", Vienna: "Austria",
  Budapest: "Hungary", Amsterdam: "Netherlands", Brussels: "Belgium",
  Copenhagen: "Denmark", Stockholm: "Sweden", Lisbon: "Portugal",
  Porto: "Portugal", Athens: "Greece",
};

export function schengenDays(
  placements: Placements,
  home: string,
  tripOf: (tripId: string) => Trip | undefined
): number {
  const homeC = HOME_COUNTRY[home] ?? useCustomHomesStore.getState().homes[home]?.country;
  let d = 0;
  for (const sid in placements) {
    for (const st of placements[sid].stops || []) {
      const t = tripOf(st.tripId);
      if (t && SCHENGEN.has(t.c) && t.c !== homeC) d += (st.nights || 0) + 1;
    }
  }
  return d;
}

export function schengenStatus(days: number): "ok" | "amber" | "red" {
  return days > 90 ? "red" : days > 80 ? "amber" : "ok";
}
