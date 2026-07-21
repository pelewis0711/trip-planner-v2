"use client";

import { useEffect } from "react";
import { iataFor } from "@/lib/calc/livePricing";
import { useLivePriceStore, legKey } from "@/lib/store/livePrices";
import { iso } from "@/lib/calc/dates";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function timeAgo(checkedAtIso: string): string {
  const ms = Date.now() - new Date(checkedAtIso).getTime();
  const hr = Math.round(ms / 3_600_000);
  if (hr < 1) return "just now";
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/** Fetches (and displays) the live price for one flight leg. Renders
 * nothing but a subtle note when the leg's cities aren't mapped to an
 * airport -- the estimate stays as the only number in that case. */
export default function LiveFlightPrice({ from, to, date }: { from: string; to: string; date: Date | null }) {
  const origin = iataFor(from);
  const destination = iataFor(to);
  const dateStr = date ? iso(date) : null;
  const key = origin && destination && dateStr ? legKey(origin, destination, dateStr) : null;

  const fetchPrice = useLivePriceStore((s) => s.fetchPrice);
  const live = useLivePriceStore((s) => (key ? s.prices[key] : undefined));
  const loading = useLivePriceStore((s) => (key ? (s.loading[key] ?? false) : false));

  useEffect(() => {
    if (origin && destination && dateStr) fetchPrice(origin, destination, dateStr);
  }, [origin, destination, dateStr, fetchPrice]);

  if (!origin || !destination || !dateStr) {
    return <span className="text-[10.5px] text-zinc-600">no live price — city not mapped to an airport</span>;
  }

  if (loading && !live) {
    return <span className="text-[10.5px] text-zinc-600">checking live price…</span>;
  }

  if (!live) return null;

  return (
    <span className="flex flex-wrap items-center gap-1 text-[10.5px]">
      {live.price !== null ? (
        <span className="font-semibold text-emerald-400">Live: {money(live.price)}</span>
      ) : (
        <span className="text-zinc-600">no live fares found for this route</span>
      )}
      <span className="text-zinc-600">· checked {timeAgo(live.checkedAt)}</span>
      <button
        type="button"
        onClick={() => fetchPrice(origin, destination, dateStr, { refresh: true })}
        disabled={loading}
        className="text-zinc-500 hover:text-emerald-400 disabled:opacity-50"
        aria-label="Refresh live price"
        title="Refresh live price"
      >
        🔄
      </button>
    </span>
  );
}
