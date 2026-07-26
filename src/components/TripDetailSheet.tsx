"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Trip } from "@/data/trips";
import { TRIP_PHOTOS } from "@/data/tripPhotos";
import { useActivePlan, usePlanStore } from "@/lib/store/plan";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { formatMoney } from "@/lib/calc/currency";
import { TYPE_LABEL, TYPE_STYLE, TIER_LABEL, TIER_STYLE, tierOf, MO_SHORT } from "@/lib/tripDisplay";
import TripPhoto from "./TripPhoto";
import SetupWizardModal from "./onboarding/SetupWizardModal";

/** Click-to-expand detail view for a trip -- photo, blurb, full activity/
 * food lists, price range, and an "Add to weekend" picker so a trip can be
 * placed straight from the Catalog without going to Calendar first. Reads
 * trip data directly; the trip doesn't need to be placed anywhere yet. */
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

  const activePlan = useActivePlan();
  const addStop = usePlanStore((s) => s.addStop);
  const updateStop = usePlanStore((s) => s.updateStop);
  const slots = useMemo(() => getSlotsForPlan(activePlan), [activePlan]);

  const [nights, setNights] = useState(trip.g);
  const [addedTo, setAddedTo] = useState<{ slotId: string; label: string; date: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  function handleAddToSlot(slotId: string) {
    addStop(slotId, trip.id);
    // addStop always seeds the suggested nights via defaultStop() -- only
    // follow up with an extra store write if the picked nights differ from
    // that suggestion, reusing the existing updateStop action rather than
    // giving addStop a new parameter.
    if (nights !== trip.g) {
      const freshStops = usePlanStore.getState().plans[usePlanStore.getState().activeId]?.placements[slotId]?.stops ?? [];
      const newIndex = freshStops.length - 1;
      if (newIndex >= 0) updateStop(slotId, newIndex, { nights });
    }
    const slot = slots.find((s) => s.id === slotId);
    if (slot) setAddedTo({ slotId, label: slot.label, date: slot.date });
  }

  return (
    <>
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

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">📅 Add to weekend</h3>

          {slots.length === 0 ? (
            <div className="mt-2 rounded-md border-2 border-dashed border-border p-3 text-center text-xs text-muted">
              <p>Set up your host city and semester dates first so your calendar has real weekends to add trips to.</p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover"
              >
                Set up now
              </button>
            </div>
          ) : (
            <>
              {trip.g > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs">
                  <span className="text-muted">Nights</span>
                  <button
                    type="button"
                    onClick={() => setNights((n) => Math.max(0, n - 1))}
                    className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-primary">{nights}</span>
                  <button
                    type="button"
                    onClick={() => setNights((n) => Math.min(14, n + 1))}
                    className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
                  >
                    +
                  </button>
                  <span className="text-muted">(suggested: {trip.g})</span>
                </div>
              )}

              {addedTo && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-ink">
                  <span>
                    ✓ Added to <b>{addedTo.label}</b> — {addedTo.date}
                  </span>
                  <Link href={`/calendar?slot=${addedTo.slotId}`} className="font-semibold text-primary underline">
                    Open on calendar
                  </Link>
                </div>
              )}

              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {slots.map((slot) => {
                  const stopCount = activePlan.placements[slot.id]?.stops.length ?? 0;
                  const justAdded = addedTo?.slotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleAddToSlot(slot.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        justAdded ? "border-success bg-success/10" : "border-border bg-surface hover:border-primary/50"
                      }`}
                    >
                      <span className="block font-semibold text-ink">{slot.label}</span>
                      <span className="text-muted">
                        {slot.date}
                        {stopCount > 0 ? ` · ${stopCount} trip${stopCount > 1 ? "s" : ""} already` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    {wizardOpen && <SetupWizardModal onClose={() => setWizardOpen(false)} />}
    </>
  );
}
