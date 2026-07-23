"use client";

import type { Slot } from "@/data/slots";
import type { Placement } from "@/lib/calc/types";
import type { PlannerCtx } from "@/lib/calc/context";
import { slotCosts } from "@/lib/calc/costs";
import { slotWarnings } from "@/lib/calc/warnings";
import { daysOf, foodTiers, lodgingTiers } from "@/lib/calc/cost";
import { iso, legDateFor, nice, stopDates } from "@/lib/calc/dates";
import {
  airbnbUrl,
  bookingComUrl,
  getYourGuideUrl,
  googleFlightsUrl,
  hostelworldUrl,
  mapsBestDishUrl,
  STATIC_LINKS,
  tiqetsUrl,
  timingTip,
  viatorUrl,
} from "@/lib/calc/booking";
import { usePlanStore } from "@/lib/store/plan";
import type { SlotActuals } from "@/lib/calc/types";
import { actualEntered, blendedSlot, hasVal, slotActuals, tripPriceRange, stopCurrentEstimate } from "@/lib/calc/costs";
import { liveSlotCosts } from "@/lib/calc/livePricing";
import { useLivePriceStore } from "@/lib/store/livePrices";
import LiveFlightPrice from "./LiveFlightPrice";
import LiveHotelPrice from "./LiveHotelPrice";
import { formatMoney } from "@/lib/calc/currency";

export default function SlotItinerary({
  slot,
  placement,
  ctx,
  home,
  travelers,
  year = 2027,
  useLive = false,
}: {
  slot: Slot;
  placement: Placement;
  ctx: PlannerCtx;
  home: string;
  travelers: number;
  year?: number;
  useLive?: boolean;
}) {
  const setActual = usePlanStore((s) => s.setActual);
  const currency = usePlanStore((s) => s.defaultCurrency);
  const money = (n: number) => formatMoney(n, currency);
  const livePrices = useLivePriceStore((s) => s.prices);

  const stops = placement.stops;
  const costs = useLive
    ? liveSlotCosts(slot.id, slot, stops, ctx, year, livePrices, travelers)
    : { ...slotCosts(slot.id, stops, ctx, travelers), liveLegIndexes: new Set<number>() };
  const warnings = slotWarnings(slot, stops, costs.legs, ctx.tripOf);
  const sd = stopDates(slot, stops, year);
  const multi = stops.length > 1;
  const actuals = slotActuals(placement);
  const booked = actualEntered(placement);
  const blend = blendedSlot(slot.id, placement, ctx, travelers);

  const title = stops.map((st) => ctx.tripOf(st.tripId)?.n ?? "?").join(" → ");
  const routeStr = [home, ...stops.map((st) => ctx.tripOf(st.tripId)?.n ?? "?"), home].join(" → ");

  const flightLegs = costs.legs
    .map((l, i) => ({ ...l, d: legDateFor(sd, stops.length, costs.legs.length, i) }))
    .filter((l) => l.mode === "flight");
  const railLegs = costs.legs
    .map((l, i) => ({ ...l, d: legDateFor(sd, stops.length, costs.legs.length, i) }))
    .filter((l) => l.mode === "train/bus");
  const lodgStops = stops.map((st, i) => ({ st, t: ctx.tripOf(st.tripId), d: sd[i] })).filter((x) => x.st.nights > 0);

  const ACTUAL_FIELDS: [keyof SlotActuals, string, number][] = [
    ["tr", "✈️ Travel", costs.travel],
    ["lo", "🛏️ Lodging", costs.lodg],
    ["fo", "🍽️ Food", costs.food],
    ["ac", "🎟️ Activities", costs.act],
  ];

  return (
    <div className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-base font-semibold text-ink">{title}</span>{" "}
          <span className="text-xs text-muted">
            {slot.label} · {slot.date}
            {multi ? ` · ${stops.length} places` : ""}
            {travelers > 1 ? ` · 👥 ${travelers} travelers` : ""}
          </span>
        </div>
        <span className="text-right">
          <span className="text-lg font-extrabold text-accent">
            {money(costs.total)}
            {costs.liveLegIndexes.size > 0 && (
              <span className="ml-1.5 align-middle text-[10px] font-bold text-sky-600">LIVE</span>
            )}
          </span>
          {travelers > 1 && (
            <span className="block text-[11px] text-muted">{money(costs.total * travelers)} for {travelers}</span>
          )}
        </span>
      </div>

      <div className="mt-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-[12.5px] text-muted">
        🧭 {routeStr} <span className="text-muted">— auto travel {money(costs.travel)}</span>
      </div>

      {warnings.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs leading-snug ${w.lv === "red" ? "text-danger" : "text-warning"}`}
            >
              {w.lv === "red" ? "⚠" : "◔"} {w.msg}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 text-[12.5px] sm:grid-cols-3">
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            ✈️ Travel legs ({money(costs.travel)})
          </b>
          {costs.legs.map((l, i) => (
            <div key={i} className="py-0.5">
              <div className="flex justify-between text-ink">
                <span>
                  {l.from} → {l.to}
                </span>
                <span className="text-muted">
                  {l.mode} · {money(l.cost)}
                </span>
              </div>
              {l.note && <div className="text-[10.5px] text-muted">↳ {l.note}</div>}
            </div>
          ))}
        </div>
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            🛏️ Lodging ({money(costs.lodg)} per person{travelers > 1 ? `, ${money(costs.lodg * travelers)} for ${travelers}` : ""})
          </b>
          {stops.map((st, i) => {
            const t = ctx.tripOf(st.tripId);
            if (!t) return null;
            if (st.nights === 0)
              return (
                <div key={i} className="flex justify-between py-0.5 text-ink">
                  <span>{multi ? `${t.n}: ` : ""}day trip</span>
                  <span className="text-muted">$0</span>
                </div>
              );
            const lt = lodgingTiers(t.ci, travelers)[st.l];
            const perPerson = lt[1] * st.nights;
            return (
              <div key={i} className="py-0.5">
                <div className="flex justify-between text-ink">
                  <span>
                    {multi ? `${t.n}: ` : ""}
                    {lt[0]} × {st.nights}n
                  </span>
                  <span className="text-muted">
                    {money(perPerson)}
                    {travelers > 1 && ` (${money(perPerson * travelers)} for ${travelers})`}
                  </span>
                </div>
                {st.l === 2 || st.l === 3 ? (
                  <LiveHotelPrice
                    city={t.n}
                    checkIn={sd[i] ? iso(sd[i].in) : null}
                    checkOut={sd[i] ? iso(sd[i].out) : null}
                    guests={travelers}
                    tier={st.l === 2 ? "private" : "boutique"}
                  />
                ) : (
                  <span className="text-[10px] text-muted">estimate only — no free live-price API for this tier</span>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            💶 Category totals
          </b>
          <div className="flex justify-between py-0.5 text-ink">
            <span>Food</span>
            <span className="text-muted">{money(costs.food)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-ink">
            <span>Activities</span>
            <span className="text-muted">{money(costs.act)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold text-ink">
            <span>Slot total</span>
            <span className="text-accent">
              {money(costs.total)}
              {travelers > 1 && (
                <span className="ml-1 font-normal text-muted">({money(costs.total * travelers)} for {travelers})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3">
        {stops.map((st, i) => {
          const t = ctx.tripOf(st.tripId);
          if (!t) return null;
          const ft = foodTiers(t.ci)[st.fd];
          const dys = daysOf(st.nights);
          const checkedActs = t.a.filter((_, idx) => st.act[idx]);
          const checkedSig = t.f.filter((_, idx) => st.sig[idx]);
          const range = tripPriceRange(t, ctx);
          const current = stopCurrentEstimate(t, st, ctx, travelers);
          return (
            <div key={i} className="text-[12.5px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <div className="font-semibold text-ink">
                  {multi ? `${i + 1}. ` : ""}
                  {t.n} <span className="font-normal text-muted">· {t.c} · {st.nights === 0 ? "day trip" : `${st.nights}n`}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted">{money(range.floor)}–{money(range.ceiling)} </span>
                  <span className="font-semibold text-accent">· Current {money(current)}</span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <b className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                    🎟️ Activities
                  </b>
                  {checkedActs.length ? (
                    checkedActs.map(([name, price]) => (
                      <div key={name} className="flex justify-between text-muted">
                        <span>{name}</span>
                        <span>{price ? money(price) : "free"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted">none selected</div>
                  )}
                </div>
                <div>
                  <b className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                    🍽️ Food
                  </b>
                  <div className="flex justify-between text-muted">
                    <span>{ft[0]} × {dys}d</span>
                    <span>{money(ft[1] * dys)}</span>
                  </div>
                  {checkedSig.length > 0 && (
                    <div className="mt-1.5 text-muted">
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Bucket list (free)</span>
                      {checkedSig.map(([name, price]) => (
                        <div key={name} className="flex justify-between">
                          <span>{name}</span>
                          <span>{price ? `ref ${money(price)}` : "free"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-border p-3">
        <b className="text-xs text-ink">💳 Booked actuals</b>{" "}
        <span className="text-[11px] text-muted">— type the real price once you book; blank = still an estimate</span>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {ACTUAL_FIELDS.map(([key, label, est]) => (
            <label key={key} className="flex items-center gap-1.5 text-muted">
              {label} <span className="text-[10.5px] text-muted">est {money(est)}</span>
              <input
                type="number"
                min={0}
                value={hasVal(actuals[key]) ? String(actuals[key]) : ""}
                onChange={(e) =>
                  setActual(slot.id, key, e.target.value === "" ? null : Math.max(0, +e.target.value || 0))
                }
                placeholder="$"
                className="w-[70px] rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              />
            </label>
          ))}
          {booked && (
            <span className={`font-bold ${blend - costs.total > 0 ? "text-danger" : "text-success"}`}>
              {blend - costs.total >= 0 ? "+" : ""}
              {money(blend - costs.total)} vs estimate
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="font-heading text-sm font-semibold text-ink">📅 Book this trip</div>
        <div className="mt-1.5 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-[12px] text-ink">
          {timingTip(slot)}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {flightLegs.length > 0 && (
            <BookCol title="✈️ Flights">
              {flightLegs.map((l, i) => (
                <div key={i} className="mb-1.5">
                  <BookLink
                    label={`${l.from} → ${l.to}${l.d ? ` (${nice(l.d)})` : ""}`}
                    href={googleFlightsUrl(l.from, l.to, l.d)}
                  />
                  <LiveFlightPrice from={l.from} to={l.to} date={l.d} />
                </div>
              ))}
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                <a href={STATIC_LINKS.skyscanner} target="_blank" rel="noopener" className="text-primary">
                  Skyscanner
                </a>
                <a href={STATIC_LINKS.kiwi} target="_blank" rel="noopener" className="text-primary">
                  Kiwi
                </a>
                <a href={STATIC_LINKS.ryanair} target="_blank" rel="noopener" className="text-primary">
                  Ryanair
                </a>
                <a href={STATIC_LINKS.wizzair} target="_blank" rel="noopener" className="text-primary">
                  Wizz Air
                </a>
              </div>
            </BookCol>
          )}
          {railLegs.length > 0 && (
            <BookCol title="🚆 Trains & buses">
              {railLegs.map((l, i) => (
                <div key={i} className="text-[11.5px] text-muted">
                  {l.from} → {l.to} <span className="text-muted">{l.km ? `~${l.km} km` : ""}</span>
                </div>
              ))}
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                <a href={STATIC_LINKS.omio} target="_blank" rel="noopener" className="text-primary">
                  Omio
                </a>
                <a href={STATIC_LINKS.trainline} target="_blank" rel="noopener" className="text-primary">
                  Trainline
                </a>
                <a href={STATIC_LINKS.flixbus} target="_blank" rel="noopener" className="text-primary">
                  FlixBus
                </a>
              </div>
            </BookCol>
          )}
          {lodgStops.length > 0 && (
            <BookCol title="🛏️ Stays">
              {lodgStops.map(({ t, d }, i) => {
                if (!t) return null;
                const ci = iso(d.in);
                const co = iso(d.out);
                return (
                  <div key={i} className="mb-1.5">
                    <div className="text-[11px] font-semibold text-ink">
                      {t.n} <span className="font-normal text-muted">{nice(d.in)} → {nice(d.out)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                      <a href={hostelworldUrl(t.n, ci, co, travelers)} target="_blank" rel="noopener" className="text-primary">
                        Hostelworld
                      </a>
                      <a href={bookingComUrl(t.n, ci, co, travelers)} target="_blank" rel="noopener" className="text-primary">
                        Booking
                      </a>
                      <a href={airbnbUrl(t.n, ci, co, travelers)} target="_blank" rel="noopener" className="text-primary">
                        Airbnb
                      </a>
                    </div>
                  </div>
                );
              })}
            </BookCol>
          )}
          <BookCol title="🎟️ Activities & tickets">
            {stops.map((st, i) => {
              const t = ctx.tripOf(st.tripId);
              if (!t) return null;
              return (
                <div key={i} className="mb-1">
                  <div className="text-[11px] font-semibold text-ink">{t.n}</div>
                  <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                    <a href={getYourGuideUrl(t.n)} target="_blank" rel="noopener" className="text-primary">
                      GetYourGuide
                    </a>
                    <a href={viatorUrl(t.n)} target="_blank" rel="noopener" className="text-primary">
                      Viator
                    </a>
                    <a href={tiqetsUrl(t.n)} target="_blank" rel="noopener" className="text-primary">
                      Tiqets
                    </a>
                  </div>
                </div>
              );
            })}
          </BookCol>
        </div>
        {stops.some((st) => stopHasSigFood(ctx, st)) && (
          <div className="mt-2">
            <b className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
              🍜 Find your bucket-list dishes
            </b>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {stops.flatMap((st) => {
                const t = ctx.tripOf(st.tripId);
                if (!t) return [];
                return t.f
                  .filter((_, idx) => st.sig[idx])
                  .map(([name]) => (
                    <a
                      key={`${st.tripId}-${name}`}
                      href={mapsBestDishUrl(name, t.n)}
                      target="_blank"
                      rel="noopener"
                      className="text-primary"
                    >
                      {name} in {t.n}
                    </a>
                  ));
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function stopHasSigFood(ctx: PlannerCtx, st: Placement["stops"][number]) {
  const t = ctx.tripOf(st.tripId);
  return !!t && t.f.some((_, idx) => st.sig[idx]);
}

function BookCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <b className="mb-1.5 block text-xs text-ink">{title}</b>
      {children}
    </div>
  );
}

function BookLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="text-[11.5px] text-muted">
      {label}:{" "}
      <a href={href} target="_blank" rel="noopener" className="font-medium text-primary">
        Google Flights ↗
      </a>
    </div>
  );
}
