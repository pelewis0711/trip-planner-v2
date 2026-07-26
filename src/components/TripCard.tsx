"use client";

import { useState } from "react";
import type { Trip } from "@/data/trips";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";
import { TYPE_LABEL, TYPE_STYLE, TIER_LABEL, TIER_STYLE, tierOf, MO_SHORT } from "@/lib/tripDisplay";
import TripPhoto from "./TripPhoto";
import TripDetailSheet from "./TripDetailSheet";

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
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDetailOpen(true)}
        className="flex cursor-pointer flex-col rounded-card border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
      >
        <TripPhoto tripId={trip.id} name={trip.n} country={trip.c} />

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

      {detailOpen && (
        <TripDetailSheet trip={trip} floor={floor} ceiling={ceiling} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
