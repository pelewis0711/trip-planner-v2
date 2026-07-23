"use client";

import { useEffect } from "react";
import { useLiveHotelPriceStore, hotelKey } from "@/lib/store/liveHotelPrices";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";

function timeAgo(checkedAtIso: string): string {
  const ms = Date.now() - new Date(checkedAtIso).getTime();
  const hr = Math.round(ms / 3_600_000);
  if (hr < 1) return "just now";
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/** Mirrors LiveFlightPrice.tsx exactly. Only shown for the private-room and
 * boutique tiers (see EditModal/SlotItinerary) -- hostel/Airbnb have no free
 * live-price API and stay estimate-only, labeled as such at the call site. */
export default function LiveHotelPrice({
  city,
  checkIn,
  checkOut,
  guests,
  tier,
}: {
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  tier: "private" | "boutique";
}) {
  const key = checkIn && checkOut ? hotelKey(city, checkIn, checkOut, guests, tier) : null;

  const fetchPrice = useLiveHotelPriceStore((s) => s.fetchPrice);
  const live = useLiveHotelPriceStore((s) => (key ? s.prices[key] : undefined));
  const loading = useLiveHotelPriceStore((s) => (key ? (s.loading[key] ?? false) : false));
  const currency = usePlanStore((s) => s.defaultCurrency);
  const money = (n: number) => formatMoney(n, currency);

  useEffect(() => {
    if (checkIn && checkOut) fetchPrice(city, checkIn, checkOut, guests, tier);
  }, [city, checkIn, checkOut, guests, tier, fetchPrice]);

  if (!checkIn || !checkOut) {
    return <span className="text-[10.5px] text-zinc-600">estimate only — no dates yet</span>;
  }

  if (loading && !live) {
    return <span className="text-[10.5px] text-zinc-600">checking live price…</span>;
  }

  if (!live) return null;

  if (live.unavailable) {
    return <span className="text-[10.5px] text-zinc-600">live pricing unavailable right now — estimate only</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1 text-[10.5px]">
      {live.price !== null ? (
        <span className="font-semibold text-emerald-400">Live: {money(live.price)}{live.hotelName ? ` (${live.hotelName})` : ""}</span>
      ) : (
        <span className="text-zinc-600">no live prices found — estimate only</span>
      )}
      <span className="text-zinc-600">· checked {timeAgo(live.checkedAt)}</span>
      <button
        type="button"
        onClick={() => fetchPrice(city, checkIn, checkOut, guests, tier, { refresh: true })}
        disabled={loading}
        className="text-zinc-500 hover:text-emerald-400 disabled:opacity-50"
        aria-label="Refresh live hotel price"
        title="Refresh live hotel price"
      >
        🔄
      </button>
    </span>
  );
}
