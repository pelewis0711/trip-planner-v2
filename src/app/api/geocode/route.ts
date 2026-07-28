import { NextResponse, type NextRequest } from "next/server";
import {
  GEOCODE_IP_LIMITER,
  GEOCODE_GLOBAL_LIMITER,
  GLOBAL_KEY,
  clientIp,
  tooManyRequests,
} from "@/lib/rateLimit";

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
  // Two limiters, and both are needed. Nominatim's usage policy limits *our
  // server's* IP, not the visitor's -- so a per-IP cap alone wouldn't bound
  // what Nominatim actually sees (twenty visitors at 6/min each is 120/min
  // from one address, well over their ~1/second ceiling). The per-IP limiter
  // stops one caller looping; the global one keeps our total outbound rate
  // inside their policy. Per-IP is checked first so a single abuser is
  // rejected without consuming the shared budget everyone else depends on.
  const perIp = GEOCODE_IP_LIMITER.check(clientIp(request));
  if (!perIp.allowed) return tooManyRequests(perIp);

  const global = GEOCODE_GLOBAL_LIMITER.check(GLOBAL_KEY);
  if (!global.allowed) return tooManyRequests(global);

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
