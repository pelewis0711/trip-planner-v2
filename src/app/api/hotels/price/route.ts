import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mirrors src/app/api/flights/price/route.ts's pattern exactly: check a 24h
// Postgres cache before ever calling upstream; the upstream token never
// reaches the browser.
//
// IMPORTANT, read before touching this file (see CLAUDE.md's Phase 8
// section for the full story): the intended provider was Travelpayouts'
// Hotellook cache endpoint (same partner account as the flight Data API).
// During implementation, every documented path for that endpoint
// (engine.hotellook.com/api/v2/cache.json and variants) returned a genuine
// 404 from the real origin (confirmed via direct curl, not a network/DNS
// issue), and Travelpayouts' own API reference states cached hotel pricing
// "requires special access" beyond standard registration -- unlike the
// flight API, this isn't a same-day, no-approval self-serve product. So
// this route is real, complete, and ready, but its upstream call below is
// almost certainly hitting a stale/wrong path until that access is sorted
// out with Travelpayouts support. A non-2xx upstream response is treated as
// "provider unavailable" (502, NOT cached) rather than a fake "no price
// found" -- so the very next request will retry cleanly once the real
// endpoint/access is confirmed, instead of being stuck behind a cached
// false negative.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface HotelCacheRow {
  price: number | null;
  currency: string;
  hotel_name: string | null;
  checked_at: string;
}

function toResponse(row: HotelCacheRow, cached: boolean) {
  return NextResponse.json({
    price: row.price,
    currency: row.currency,
    hotelName: row.hotel_name,
    checkedAt: row.checked_at,
    cached,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const guests = Number(searchParams.get("guests") || "1");
  const tier = searchParams.get("tier") || "";
  const forceRefresh = searchParams.get("refresh") === "1";

  if (
    !city ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    (tier !== "private" && tier !== "boutique")
  ) {
    return NextResponse.json(
      { error: "city, checkIn/checkOut (YYYY-MM-DD), guests (>=1), and tier (private|boutique) are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("hotel_price_cache")
      .select("price, currency, hotel_name, checked_at")
      .eq("city", city)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .eq("guests", guests)
      .eq("tier", tier)
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_TTL_MS) {
      return toResponse(cached, true);
    }
  }

  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Live hotel prices aren't configured" }, { status: 503 });
  }

  try {
    const url = new URL("https://engine.hotellook.com/api/v2/cache.json");
    url.searchParams.set("location", city);
    url.searchParams.set("checkIn", checkIn);
    url.searchParams.set("checkOut", checkOut);
    url.searchParams.set("currency", "usd");
    url.searchParams.set("limit", "1");
    url.searchParams.set("token", token);

    const res = await fetch(url);
    if (!res.ok) {
      // Provider unavailable (see the file header) -- NOT cached, so the
      // next request retries cleanly once real access is confirmed.
      console.error(`Hotellook request failed: ${res.status}`);
      return NextResponse.json(
        { error: `Hotel live pricing isn't available right now (upstream ${res.status}) -- estimate only` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const cheapest = Array.isArray(json) && json.length ? json[0] : null;
    const price = cheapest?.priceFrom ?? null;
    const hotelName = cheapest?.hotelName ?? null;

    const { data: saved, error } = await supabase.rpc("upsert_hotel_price", {
      p_city: city,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
      p_tier: tier,
      p_price: price,
      p_currency: "USD",
      p_hotel_name: hotelName,
    });

    if (error || !saved) {
      console.error("Failed to cache hotel price", error);
      return NextResponse.json({ error: "Failed to save price" }, { status: 500 });
    }

    const row = (Array.isArray(saved) ? saved[0] : saved) as HotelCacheRow;
    return toResponse(row, false);
  } catch (err) {
    console.error("Hotellook fetch failed", err);
    return NextResponse.json(
      { error: "Hotel live pricing isn't available right now -- estimate only" },
      { status: 502 }
    );
  }
}
