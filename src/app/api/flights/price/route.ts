import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-only proxy to Travelpayouts (the API token never reaches the
// browser). Prices are cached ~24h per origin+destination+date in Postgres
// (see supabase/migrations/0003_flight_prices.sql) so repeat views of the
// same trip don't burn API calls -- only a genuine cache miss or an
// explicit ?refresh=1 hits Travelpayouts.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CheapPriceEntry {
  price: number;
  airline?: string;
  departure_at?: string;
}

interface CacheRow {
  price: number | null;
  currency: string;
  airline: string | null;
  found_departure_at: string | null;
  checked_at: string;
}

function toResponse(row: CacheRow, cached: boolean) {
  return NextResponse.json({
    price: row.price,
    currency: row.currency,
    airline: row.airline,
    foundDepartureAt: row.found_departure_at,
    checkedAt: row.checked_at,
    cached,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = (searchParams.get("origin") || "").toUpperCase();
  const destination = (searchParams.get("destination") || "").toUpperCase();
  const date = searchParams.get("date") || "";
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "origin, destination (3-letter IATA codes) and date (YYYY-MM-DD) are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("flight_price_cache")
      .select("price, currency, airline, found_departure_at, checked_at")
      .eq("origin", origin)
      .eq("destination", destination)
      .eq("depart_date", date)
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_TTL_MS) {
      return toResponse(cached, true);
    }
  }

  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Live prices aren't configured" }, { status: 503 });
  }

  let price: number | null = null;
  let airline: string | null = null;
  let foundDepartureAt: string | null = null;

  try {
    const url = new URL("https://api.travelpayouts.com/v1/prices/cheap");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("depart_date", date);
    url.searchParams.set("currency", "usd");

    const res = await fetch(url, { headers: { "x-access-token": token } });
    if (res.ok) {
      const json = await res.json();
      const offers = json?.data?.[destination] as Record<string, CheapPriceEntry> | undefined;
      const cheapest = offers
        ? Object.values(offers).reduce<CheapPriceEntry | null>(
            (best, o) => (!best || o.price < best.price ? o : best),
            null
          )
        : null;
      if (cheapest) {
        price = cheapest.price;
        airline = cheapest.airline ?? null;
        foundDepartureAt = cheapest.departure_at ?? null;
      }
    } else {
      console.error("Travelpayouts request failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("Travelpayouts fetch failed", err);
  }

  // cache a miss (price: null) too, so a route with no data doesn't get
  // re-queried on every page view within the TTL window
  const { data: saved, error } = await supabase.rpc("upsert_flight_price", {
    p_origin: origin,
    p_destination: destination,
    p_depart_date: date,
    p_price: price,
    p_currency: "USD",
    p_airline: airline,
    p_found_departure_at: foundDepartureAt,
  });

  if (error || !saved) {
    console.error("Failed to cache flight price", error);
    return NextResponse.json({ error: "Failed to save price" }, { status: 500 });
  }

  const row = (Array.isArray(saved) ? saved[0] : saved) as CacheRow;
  return toResponse(row, false);
}
