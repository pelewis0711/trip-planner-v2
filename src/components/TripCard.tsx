"use client";

import type { Trip } from "@/data/trips";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";

const TYPE_LABEL: Record<string, string> = {
  history: "History & Culture",
  scenic: "Scenic & Nature",
  beach: "Beach & Islands",
  nightlife: "Nightlife & Cities",
};

const TYPE_STYLE: Record<string, string> = {
  history: "bg-violet-500/15 text-violet-300",
  scenic: "bg-emerald-500/15 text-emerald-300",
  beach: "bg-sky-500/15 text-sky-300",
  nightlife: "bg-pink-500/15 text-pink-300",
};

const TIER_LABEL: Record<string, string> = { b: "Budget", m: "Mid", s: "Splurge" };
const TIER_STYLE: Record<string, string> = {
  b: "text-emerald-400",
  m: "text-amber-400",
  s: "text-rose-400",
};

function tierOf(ci: number): "b" | "m" | "s" {
  return ci <= 2 ? "b" : ci === 3 ? "m" : "s";
}

const MO_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

export default function TripCard({
  trip,
  floor,
  ceiling,
}: {
  trip: Trip;
  floor: number;
  ceiling: number;
}) {
  const tier = tierOf(trip.ci);
  const currency = usePlanStore((s) => s.defaultCurrency);
  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-zinc-50">{trip.n}</div>
          <div className="text-xs text-zinc-500">
            {trip.c === trip.reg ? trip.c : `${trip.c} · ${trip.reg}`}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${TIER_STYLE[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {trip.t.map((ty) => (
          <span
            key={ty}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TYPE_STYLE[ty] ?? "bg-zinc-800 text-zinc-300"}`}
          >
            {TYPE_LABEL[ty] ?? ty}
          </span>
        ))}
      </div>

      <p className="mt-2 flex-1 text-[12.5px] text-zinc-400">{trip.w}</p>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5 text-xs text-zinc-500">
        <span>
          {trip.g === 0 ? "Day trip" : `${trip.g} night${trip.g > 1 ? "s" : ""}`} &middot;{" "}
          {trip.m.map((m) => MO_SHORT[m]).join("/")}
        </span>
        <span className="text-[15px] font-extrabold text-emerald-400">
          {formatMoney(floor, currency)}–{formatMoney(ceiling, currency)}
        </span>
      </div>
    </div>
  );
}
