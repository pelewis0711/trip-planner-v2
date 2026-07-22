import { NextResponse, type NextRequest } from "next/server";

// Server-only proxy to Nominatim (OpenStreetMap's free, keyless geocoder),
// used by onboarding's "Other city..." host-city option. A proxy is
// required, not optional: Nominatim's usage policy requires a descriptive
// User-Agent identifying the app, which browser fetch() can't set -- and
// this keeps the third-party endpoint and its rate limit off the client.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// A handful of spots where OSM's country naming differs from this app's
// existing convention (src/lib/calc/schengen.ts's SCHENGEN/HOME_COUNTRY
// strings, e.g. "Czechia" not "Czech Republic"). Empty today -- Nominatim
// already returns "Czechia" -- kept as an extension point per CLAUDE.md.
const COUNTRY_FIXUP: Record<string, string> = {};

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q (city name) is required" }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");

  let results: NominatimResult[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "trip-planner-v2 (study-abroad trip planner; contact via GitHub repo)" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
    }
    results = await res.json();
  } catch (err) {
    console.error("Nominatim request failed", err);
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const top = results[0];
  if (!top) {
    return NextResponse.json({ error: `No match found for "${q}"` }, { status: 404 });
  }

  const city =
    top.address?.city || top.address?.town || top.address?.village || top.address?.municipality || q;
  const rawCountry = top.address?.country;
  if (!rawCountry) {
    return NextResponse.json({ error: `Couldn't resolve a country for "${q}"` }, { status: 404 });
  }
  const country = COUNTRY_FIXUP[rawCountry] || rawCountry;

  const lat = Number(top.lat);
  const lon = Number(top.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "Malformed geocoding response" }, { status: 502 });
  }

  return NextResponse.json({ city, country, lat, lon });
}
