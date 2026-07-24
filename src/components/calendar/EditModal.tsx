"use client";

import type { Slot } from "@/data/slots";
import { useActivePlan, usePlanStore, type ActivityPreset } from "@/lib/store/plan";
import { useAuthStore } from "@/lib/store/auth";
import type { PlannerCtx } from "@/lib/calc/context";
import { daysOf, foodTiers, lodgingTiers } from "@/lib/calc/cost";
import { slotCosts, tripPriceRange, stopCurrentEstimate, travelersFor } from "@/lib/calc/costs";
import { stopDates, iso } from "@/lib/calc/dates";
import LiveHotelPrice from "@/components/itinerary/LiveHotelPrice";
import SlotCollab from "./SlotCollab";
import { formatMoney } from "@/lib/calc/currency";
import type { Currency } from "@/components/onboarding/OnboardingFlow";

const PRESETS: [ActivityPreset, string][] = [
  ["none", "None"],
  ["highlights", "Highlights"],
  ["balanced", "Balanced"],
  ["everything", "Everything"],
];

export default function EditModal({
  slot,
  ctx,
  year = 2027,
  onClose,
}: {
  slot: Slot;
  ctx: PlannerCtx;
  year?: number;
  onClose: () => void;
}) {
  const plan = useActivePlan();
  const { placements } = plan;
  const userId = useAuthStore((s) => s.user?.id);
  const removeStop = usePlanStore((s) => s.removeStop);
  const updateStop = usePlanStore((s) => s.updateStop);
  const toggleAct = usePlanStore((s) => s.toggleAct);
  const toggleSig = usePlanStore((s) => s.toggleSig);
  const applyActivityPreset = usePlanStore((s) => s.applyActivityPreset);
  const moveStop = usePlanStore((s) => s.moveStop);
  const setTravelersFor = usePlanStore((s) => s.setTravelersFor);
  const currency = usePlanStore((s) => s.defaultCurrency);

  const stops = placements[slot.id]?.stops ?? [];
  const travelers = travelersFor(placements[slot.id], plan.defaultTravelers ?? 1);
  const costs = stops.length ? slotCosts(slot.id, stops, ctx, travelers) : null;
  const sd = stops.length ? stopDates(slot, stops, year) : [];

  if (!stops.length) {
    onClose();
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-card border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">{slot.label}</h2>
            <p className="text-xs text-muted">{slot.date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs">
          <span className="text-muted">👥 Travelers</span>
          <button
            type="button"
            onClick={() => setTravelersFor(slot.id, Math.max(1, travelers - 1))}
            className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
          >
            −
          </button>
          <span className="w-6 text-center font-bold text-primary">{travelers}</span>
          <button
            type="button"
            onClick={() => setTravelersFor(slot.id, Math.min(20, travelers + 1))}
            className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
          >
            +
          </button>
          <span className="text-muted">for this whole slot (all stops share the group)</span>
        </div>

        <div className="mt-4 space-y-4">
          {stops.map((st, i) => {
            const t = ctx.tripOf(st.tripId);
            if (!t) return null;
            const lTiers = lodgingTiers(t.ci, travelers);
            const fTiers = foodTiers(t.ci);
            const days = daysOf(st.nights);
            const range = tripPriceRange(t, ctx);
            const current = stopCurrentEstimate(t, st, ctx, travelers);

            return (
              <div key={i} className="rounded-card border border-border bg-surface-muted p-3.5">
                <div className="flex items-center gap-2">
                  {stops.length > 1 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-semibold text-ink">
                    {t.n} <span className="font-normal text-muted">· {t.c}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveStop(slot.id, i, i - 1)}
                      className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === stops.length - 1}
                      onClick={() => moveStop(slot.id, i, i + 1)}
                      className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStop(slot.id, i)}
                      className="rounded-md bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger hover:bg-danger/20"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 text-[11.5px]">
                  <span className="text-muted">Range </span>
                  <span className="font-semibold text-ink">
                    {formatMoney(range.floor, currency)}–{formatMoney(range.ceiling, currency)}
                  </span>
                  <br />
                  <span className="text-muted">Current </span>
                  <span className="font-semibold text-accent">
                    {formatMoney(current, currency)}
                    {travelers > 1 && (
                      <span className="font-normal text-muted"> ({formatMoney(current * travelers, currency)} for {travelers})</span>
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
                  <span className="text-muted">Nights</span>
                  <button
                    type="button"
                    onClick={() => updateStop(slot.id, i, { nights: Math.max(0, st.nights - 1) })}
                    className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-primary">{st.nights}</span>
                  <button
                    type="button"
                    onClick={() => updateStop(slot.id, i, { nights: Math.min(14, st.nights + 1) })}
                    className="rounded-md border border-border px-2 py-0.5 font-bold text-ink"
                  >
                    +
                  </button>
                  <span className="text-muted">
                    {st.nights === 0 ? "day trip" : `${days} day${days > 1 ? "s" : ""} of food`}
                  </span>
                </div>

                {st.nights > 0 && (
                  <>
                    <TierGroup
                      label="🛏️ Lodging (per person)"
                      tiers={lTiers}
                      perNight
                      nights={st.nights}
                      travelers={travelers}
                      value={st.l}
                      onChange={(idx) => updateStop(slot.id, i, { l: idx })}
                      currency={currency}
                    />
                    <div className="mt-1">
                      {st.l === 2 || st.l === 3 ? (
                        <LiveHotelPrice
                          city={t.n}
                          checkIn={sd[i] ? iso(sd[i].in) : null}
                          checkOut={sd[i] ? iso(sd[i].out) : null}
                          guests={travelers}
                          tier={st.l === 2 ? "private" : "boutique"}
                        />
                      ) : (
                        <span className="text-[10.5px] text-muted">
                          estimate only — no free live-price API for hostels/Airbnb
                        </span>
                      )}
                    </div>
                  </>
                )}
                <TierGroup
                  label="🍽️ Food tier"
                  tiers={fTiers}
                  perNight={false}
                  nights={days}
                  value={st.fd}
                  onChange={(idx) => updateStop(slot.id, i, { fd: idx })}
                  currency={currency}
                />

                {t.a.length > 0 && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {PRESETS.map(([preset, label]) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyActivityPreset(slot.id, i, preset)}
                          className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted hover:border-primary/50 hover:text-primary"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <CheckList
                      label="🎟️ Activities"
                      items={t.a}
                      checked={st.act}
                      onToggle={(idx) => toggleAct(slot.id, i, idx)}
                      currency={currency}
                    />
                  </>
                )}
                {t.f.length > 0 && (
                  <CheckList
                    label="🍜 Signature food (bucket list — free, doesn't count toward totals)"
                    items={t.f}
                    checked={st.sig}
                    onToggle={(idx) => toggleSig(slot.id, i, idx)}
                    refOnly
                    currency={currency}
                  />
                )}
              </div>
            );
          })}
        </div>

        {costs && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-5">
            {[
              ["Travel", costs.travel, null],
              ["Lodging", costs.lodg, costs.lodg * travelers],
              ["Food", costs.food, null],
              ["Activities", costs.act, null],
              ["Total (per person)", costs.total, costs.total * travelers],
            ].map(([label, val, group]) => (
              <div key={label as string} className="rounded-lg bg-surface-muted p-2 text-center">
                <b className="block text-sm text-accent">{formatMoney(val as number, currency)}</b>
                {group !== null && travelers > 1 && (
                  <span className="block text-[10px] text-muted">{formatMoney(group as number, currency)} for {travelers}</span>
                )}
                <span className="text-[10px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        )}

        {userId && plan.ownerId && (plan.ownerId === userId || plan.collaboratorIds?.includes(userId)) && (
          <SlotCollab planId={plan.id} slotId={slot.id} userId={userId} />
        )}
      </div>
    </div>
  );
}

function TierGroup({
  label,
  tiers,
  perNight,
  nights,
  value,
  onChange,
  travelers,
  currency,
}: {
  label: string;
  tiers: [string, number][];
  perNight: boolean;
  nights: number;
  value: number;
  onChange: (idx: number) => void;
  // Phase 8: when set (>1), shows the whole-group total alongside the
  // per-person price -- only lodging is group-aware, food/activities don't
  // split, so this is omitted for the food TierGroup.
  travelers?: number;
  currency: Currency;
}) {
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </h5>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {tiers.map(([name, price], idx) => {
          const perPerson = price * nights;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(idx)}
              className={`rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors ${
                value === idx
                  ? "border-primary bg-primary-soft text-ink"
                  : "border-border bg-surface text-muted hover:border-primary/40"
              }`}
            >
              <span className="block truncate font-medium">{name}</span>
              <span className="text-accent">
                {formatMoney(perPerson, currency)}
                {perNight ? "" : " total"}
              </span>
              {!!travelers && travelers > 1 && (
                <span className="block text-[10px] text-muted">{formatMoney(perPerson * travelers, currency)} for {travelers}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckList({
  label,
  items,
  checked,
  onToggle,
  refOnly = false,
  currency,
}: {
  label: string;
  items: [string, number][];
  checked: boolean[];
  onToggle: (idx: number) => void;
  // Phase 7: signature dishes are a $0 bucket list -- their price is shown
  // for reference only, not counted, so it renders greyed/labeled instead of
  // the normal counted-green style activities use.
  refOnly?: boolean;
  currency: Currency;
}) {
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </h5>
      <div className="space-y-1">
        {items.map(([name, price], idx) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-surface"
          >
            <input
              type="checkbox"
              checked={checked[idx] ?? false}
              onChange={() => onToggle(idx)}
              className="accent-primary"
            />
            <span className="flex-1 text-ink">{name}</span>
            <span className={refOnly ? "text-muted" : "text-accent"}>
              {refOnly ? (price ? `ref ${formatMoney(price, currency)}` : "free") : price ? formatMoney(price, currency) : "free"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
