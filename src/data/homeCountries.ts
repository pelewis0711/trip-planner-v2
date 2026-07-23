// The 20 cities in src/data/homes.ts, mapped to their country -- kept as its
// OWN file (not inside homes.ts, which is auto-generated and gets wiped on
// every re-run of scripts/extract-trips.mjs) so it survives regeneration.
// Was previously exported from src/lib/calc/schengen.ts; moved here so both
// schengen.ts and src/lib/resolveHome.ts can read it without a circular
// import (resolveHome.ts is what schengen.ts now calls to derive its home
// country -- see CLAUDE.md).
export const HOME_COUNTRY: Record<string, string> = {
  Prague: "Czechia", Rome: "Italy", Florence: "Italy", Milan: "Italy",
  Barcelona: "Spain", Madrid: "Spain", Seville: "Spain", Paris: "France",
  London: "England", Dublin: "Ireland", Berlin: "Germany", Vienna: "Austria",
  Budapest: "Hungary", Amsterdam: "Netherlands", Brussels: "Belgium",
  Copenhagen: "Denmark", Stockholm: "Sweden", Lisbon: "Portugal",
  Porto: "Portugal", Athens: "Greece",
};
