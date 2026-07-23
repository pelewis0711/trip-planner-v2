// Single shared "what do we know about this home city" resolver, replacing
// the `HOMES[home] || (customHome ? [...] : HOMES.Prague)` pattern that used
// to be repeated in several files -- and, with it, a literal fallback to
// Prague's coordinates for anyone with no home configured. resolveHome()
// never falls back to Prague: it returns null when a city can't be
// resolved, and callers decide what "unresolved" should look like (an
// unconfigured-state prompt, an honest placeholder, etc.) rather than
// silently borrowing someone else's city.
import { HOMES } from "@/data/homes";
import { HOME_COUNTRY } from "@/data/homeCountries";
import { EUROPEAN_CITIES } from "@/data/europeanCities";
import { useCustomHomesStore } from "@/lib/store/customHomes";

export interface ResolvedHome {
  lat: number;
  lon: number;
  country: string | undefined;
}

// Tier 1: the original 20 quick-pick cities. Tier 2: the ~130-city bundled
// dataset (instant, no network). Tier 3: a custom home this account/device
// already geocoded once (live, via /api/geocode) and cached locally.
export function resolveHome(city: string): ResolvedHome | null {
  if (!city) return null;
  if (HOMES[city]) return { lat: HOMES[city][0], lon: HOMES[city][1], country: HOME_COUNTRY[city] };
  if (EUROPEAN_CITIES[city]) return EUROPEAN_CITIES[city];
  const custom = useCustomHomesStore.getState().homes[city];
  if (custom) return custom;
  return null;
}

export function isKnownCity(city: string): boolean {
  return !!resolveHome(city);
}

export type CityLookupResult =
  | { city: string; country: string; lat: number; lon: number }
  | { error: string };

// Shared "type any European city" resolution, used by both the onboarding
// wizard and the Header's home-city picker (previously each had its own
// copy of this exact fetch-and-fall-back logic). Checks the bundled
// datasets first (instant, offline, case-insensitive) before making a live
// call to the free Nominatim proxy at /api/geocode -- only returns an error
// if both fail, which is the caller's signal to show the "pick the nearest
// city instead, or enter coordinates manually" fallback (never a silent
// Prague guess).
export async function lookupCity(query: string): Promise<CityLookupResult> {
  const q = query.trim();
  if (!q) return { error: "Type a city name" };

  const needle = q.toLowerCase();
  const bundledMatch =
    Object.keys(HOMES).find((c) => c.toLowerCase() === needle) ??
    Object.keys(EUROPEAN_CITIES).find((c) => c.toLowerCase() === needle);
  if (bundledMatch) {
    const resolved = resolveHome(bundledMatch)!;
    return { city: bundledMatch, country: resolved.country ?? "", lat: resolved.lat, lon: resolved.lon };
  }

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Couldn't find that city" };
    return { city: data.city, country: data.country, lat: data.lat, lon: data.lon };
  } catch {
    return { error: "Couldn't reach the geocoding service" };
  }
}
