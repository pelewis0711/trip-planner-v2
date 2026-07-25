"use client";

import type { Trip } from "@/data/trips";
import { TRIP_PHOTOS } from "@/data/tripPhotos";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";
import { TYPE_LABEL, TYPE_STYLE, TIER_LABEL, TIER_STYLE, tierOf, MO_SHORT } from "@/lib/tripDisplay";
import TripPhoto from "./TripPhoto";

/** Minimal click-to-expand detail view for a trip -- photo, blurb, full
 * activity/food lists, price range. Read-only; placing a trip on the
 * calendar still happens from the Calendar tab, not from here. */
export default function TripDetailSheet({
  trip,
  floor,
  ceiling,
  onClose,
}: {
  trip: Trip;
  floor: number;
  ceiling: number;
  onClose: () => void;
}) {
  const currency = usePlanStore((s) => s.defaultCurrency);
  const tier = tierOf(trip.ci);
  const photo = TRIP_PHOTOS[trip.id];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">{trip.n}</h2>
            <p className="text-sm text-muted">
              {trip.c === trip.reg ? trip.c : `${trip.c} · ${trip.reg}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <TripPhoto tripId={trip.id} name={trip.n} country={trip.c} ratio="aspect-[16/9]" className="w-full" priority />
          {photo && (
            <p className="mt-1.5 text-[11px] text-muted">
              Photo by{" "}
              <a href={photo.photographerUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {photo.photographer}
              </a>{" "}
              on{" "}
              <a href={photo.unsplashUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Unsplash
              </a>
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TIER_STYLE[tier]}`}>{TIER_LABEL[tier]}</span>
          {trip.t.map((ty) => (
            <span key={ty} className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TYPE_STYLE[ty] ?? "bg-surface-muted text-muted"}`}>
              {TYPE_LABEL[ty] ?? ty}
            </span>
          ))}
          <span className="text-xs text-muted">
            {trip.g === 0 ? "Day trip" : `${trip.g} night${trip.g > 1 ? "s" : ""}`} · Best {trip.m.map((m) => MO_SHORT[m]).join("/")}
          </span>
        </div>

        <p className="mt-3 text-sm text-muted">{trip.w}</p>

        <div className="mt-3 border-t border-border pt-3">
          <span className="font-heading text-lg font-bold text-accent">
            {formatMoney(floor, currency)}–{formatMoney(ceiling, currency)}
          </span>
          <span className="ml-1.5 text-xs text-muted">per person, depending on activities picked</span>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">🎟️ Activities</h3>
          <ul className="mt-1.5 space-y-1 text-sm text-ink">
            {trip.a.map(([name, price]) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <span>{name}</span>
                <span className="shrink-0 text-muted">{formatMoney(price, currency)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">🍽️ Bucket list (free)</h3>
          <ul className="mt-1.5 space-y-1 text-sm text-ink">
            {trip.f.map(([name, price]) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <span>{name}</span>
                <span className="shrink-0 text-muted">ref {formatMoney(price, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
