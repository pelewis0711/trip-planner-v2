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
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">{slot.label}</h2>
            <p className="text-xs text-zinc-500">{slot.date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
          <span className="text-zinc-500">👥 Travelers</span>
          <button
            type="button"
            onClick={() => setTravelersFor(slot.id, Math.max(1, travelers - 1))}
            className="rounded-md border border-zinc-800 px-2 py-0.5 font-bold text-zinc-300"
          >
            −
          </button>
          <span className="w-6 text-center font-bold text-emerald-400">{travelers}</span>
          <button
            type="button"
            onClick={() => setTravelersFor(slot.id, Math.min(20, travelers + 1))}
            className="rounded-md border border-zinc-800 px-2 py-0.5 font-bold text-zinc-300"
          >
            +
          </button>
          <span className="text-zinc-500">for this whole slot (all stops share the group)</span>
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
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <div className="flex items-center gap-2">
                  {stops.length > 1 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-zinc-950">
                      {i + 1}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-semibold text-zinc-100">
                    {t.n} <span className="font-normal text-zinc-500">· {t.c}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveStop(slot.id, i, i - 1)}
                      className="rounded-md border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === stops.length - 1}
                      onClick={() => moveStop(slot.id, i, i + 1)}
                      className="rounded-md border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStop(slot.id, i)}
                      className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 text-[11.5px]">
                  <span className="text-zinc-500">Range </span>
                  <span className="font-semibold text-zinc-300">
                    ${Math.round(range.floor)}–${Math.round(range.ceiling)}
                  </span>
                  <br />
                  <span className="text-zinc-500">Current </span>
                  <span className="font-semibold text-emerald-400">
                    ${Math.round(current)}
                    {travelers > 1 && (
                      <span className="font-normal text-zinc-500"> (${Math.round(current * travelers)} for {travelers})</span>
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
                  <span className="text-zinc-500">Nights</span>
                  <button
                    type="button"
                    onClick={() => updateStop(slot.id, i, { nights: Math.max(0, st.nights - 1) })}
                    className="rounded-md border border-zinc-800 px-2 py-0.5 font-bold text-zinc-300"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-emerald-400">{st.nights}</span>
                  <button
                    type="button"
                    onClick={() => updateStop(slot.id, i, { nights: Math.min(14, st.nights + 1) })}
                    className="rounded-md border border-zinc-800 px-2 py-0.5 font-bold text-zinc-300"
                  >
                    +
                  </button>
                  <span className="text-zinc-500">
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
                        <span className="text-[10.5px] text-zinc-600">
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
                />

                {t.a.length > 0 && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {PRESETS.map(([preset, label]) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyActivityPreset(slot.id, i, preset)}
                          className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300"
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
                  />
                )}
              </div>
            );
          })}
        </div>

        {costs && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-5">
            {[
              ["Travel", costs.travel, null],
              ["Lodging", costs.lodg, costs.lodg * travelers],
              ["Food", costs.food, null],
              ["Activities", costs.act, null],
              ["Total (per person)", costs.total, costs.total * travelers],
            ].map(([label, val, group]) => (
              <div key={label as string} className="rounded-lg bg-zinc-900/60 p-2 text-center">
                <b className="block text-sm text-emerald-400">${Math.round(val as number)}</b>
                {group !== null && travelers > 1 && (
                  <span className="block text-[10px] text-zinc-400">${Math.round(group as number)} for {travelers}</span>
                )}
                <span className="text-[10px] text-zinc-500">{label}</span>
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
}) {
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
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
                  ? "border-emerald-500 bg-emerald-500/10 text-zinc-100"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span className="block truncate font-medium">{name}</span>
              <span className="text-emerald-400">
                ${perPerson}
                {perNight ? "" : " total"}
              </span>
              {!!travelers && travelers > 1 && (
                <span className="block text-[10px] text-zinc-500">${perPerson * travelers} for {travelers}</span>
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
}: {
  label: string;
  items: [string, number][];
  checked: boolean[];
  onToggle: (idx: number) => void;
  // Phase 7: signature dishes are a $0 bucket list -- their price is shown
  // for reference only, not counted, so it renders greyed/labeled instead of
  // the normal counted-green style activities use.
  refOnly?: boolean;
}) {
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </h5>
      <div className="space-y-1">
        {items.map(([name, price], idx) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-zinc-900"
          >
            <input
              type="checkbox"
              checked={checked[idx] ?? false}
              onChange={() => onToggle(idx)}
              className="accent-emerald-500"
            />
            <span className="flex-1 text-zinc-300">{name}</span>
            <span className={refOnly ? "text-zinc-500" : "text-emerald-400"}>
              {refOnly ? (price ? `ref $${price}` : "free") : price ? `$${price}` : "free"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
