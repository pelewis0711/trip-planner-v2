"use client";

import type { Trip } from "@/data/trips";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";
import ImagePlaceholder from "./ImagePlaceholder";

const TYPE_LABEL: Record<string, string> = {
  history: "History & Culture",
  scenic: "Scenic & Nature",
  beach: "Beach & Islands",
  nightlife: "Nightlife & Cities",
};

const TYPE_STYLE: Record<string, string> = {
  history: "bg-violet-100 text-violet-700",
  scenic: "bg-teal-100 text-teal-700",
  beach: "bg-sky-100 text-sky-700",
  nightlife: "bg-pink-100 text-pink-700",
};

const TIER_LABEL: Record<string, string> = { b: "Budget", m: "Mid", s: "Splurge" };
// Semantic status colors (not the primary/accent brand pair) -- these
// communicate a fact about the trip's cost tier, not a brand decoration.
const TIER_STYLE: Record<string, string> = {
  b: "bg-success/10 text-success",
  m: "bg-warning/10 text-warning",
  s: "bg-danger/10 text-danger",
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
    <div className="flex flex-col rounded-card border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md">
      <ImagePlaceholder />

      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <div className="font-heading text-base font-semibold text-ink">{trip.n}</div>
          <div className="text-xs text-muted">
            {trip.c === trip.reg ? trip.c : `${trip.c} · ${trip.reg}`}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TIER_STYLE[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {trip.t.map((ty) => (
          <span
            key={ty}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TYPE_STYLE[ty] ?? "bg-surface-muted text-muted"}`}
          >
            {TYPE_LABEL[ty] ?? ty}
          </span>
        ))}
      </div>

      <p className="mt-2 flex-1 text-[12.5px] text-muted">{trip.w}</p>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted">
        <span>
          {trip.g === 0 ? "Day trip" : `${trip.g} night${trip.g > 1 ? "s" : ""}`} &middot;{" "}
          {trip.m.map((m) => MO_SHORT[m]).join("/")}
        </span>
        <span className="font-heading text-[15px] font-bold text-accent">
          {formatMoney(floor, currency)}–{formatMoney(ceiling, currency)}
        </span>
      </div>
    </div>
  );
}
