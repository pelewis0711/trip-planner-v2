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
import { actualEntered, blendedSlot, hasVal, slotActuals } from "@/lib/calc/costs";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function SlotItinerary({
  slot,
  placement,
  ctx,
  home,
}: {
  slot: Slot;
  placement: Placement;
  ctx: PlannerCtx;
  home: string;
}) {
  const setActual = usePlanStore((s) => s.setActual);

  const stops = placement.stops;
  const costs = slotCosts(slot.id, stops, ctx);
  const warnings = slotWarnings(slot, stops, costs.legs, ctx.tripOf);
  const sd = stopDates(slot, stops);
  const multi = stops.length > 1;
  const actuals = slotActuals(placement);
  const booked = actualEntered(placement);
  const blend = blendedSlot(slot.id, placement, ctx);

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-base font-semibold text-zinc-50">{title}</span>{" "}
          <span className="text-xs text-zinc-500">
            {slot.label} · {slot.date}
            {multi ? ` · ${stops.length} places` : ""}
          </span>
        </div>
        <span className="text-lg font-extrabold text-emerald-400">{money(costs.total)}</span>
      </div>

      <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[12.5px] text-zinc-400">
        🧭 {routeStr} <span className="text-zinc-600">— auto travel {money(costs.travel)}</span>
      </div>

      {warnings.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs leading-snug ${w.lv === "red" ? "text-rose-400" : "text-amber-400"}`}
            >
              {w.lv === "red" ? "⚠" : "◔"} {w.msg}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 text-[12.5px] sm:grid-cols-3">
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
            ✈️ Travel legs ({money(costs.travel)})
          </b>
          {costs.legs.map((l, i) => (
            <div key={i} className="py-0.5">
              <div className="flex justify-between text-zinc-300">
                <span>
                  {l.from} → {l.to}
                </span>
                <span className="text-zinc-500">
                  {l.mode} · {money(l.cost)}
                </span>
              </div>
              {l.note && <div className="text-[10.5px] text-zinc-600">↳ {l.note}</div>}
            </div>
          ))}
        </div>
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
            🛏️ Lodging ({money(costs.lodg)})
          </b>
          {stops.map((st, i) => {
            const t = ctx.tripOf(st.tripId);
            if (!t) return null;
            if (st.nights === 0)
              return (
                <div key={i} className="flex justify-between py-0.5 text-zinc-300">
                  <span>{multi ? `${t.n}: ` : ""}day trip</span>
                  <span className="text-zinc-500">$0</span>
                </div>
              );
            const lt = lodgingTiers(t.ci)[st.l];
            return (
              <div key={i} className="flex justify-between py-0.5 text-zinc-300">
                <span>
                  {multi ? `${t.n}: ` : ""}
                  {lt[0]} × {st.nights}n
                </span>
                <span className="text-zinc-500">{money(lt[1] * st.nights)}</span>
              </div>
            );
          })}
        </div>
        <div>
          <b className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
            💶 Category totals
          </b>
          <div className="flex justify-between py-0.5 text-zinc-300">
            <span>Food</span>
            <span className="text-zinc-500">{money(costs.food)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-zinc-300">
            <span>Activities</span>
            <span className="text-zinc-500">{money(costs.act)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-zinc-800 pt-1 font-bold text-zinc-100">
            <span>Slot total</span>
            <span className="text-emerald-400">{money(costs.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-dashed border-zinc-800 pt-3">
        {stops.map((st, i) => {
          const t = ctx.tripOf(st.tripId);
          if (!t) return null;
          const ft = foodTiers(t.ci)[st.fd];
          const dys = daysOf(st.nights);
          const checkedActs = t.a.filter((_, idx) => st.act[idx]);
          const checkedSig = t.f.filter((_, idx) => st.sig[idx]);
          return (
            <div key={i} className="text-[12.5px]">
              <div className="font-semibold text-zinc-200">
                {multi ? `${i + 1}. ` : ""}
                {t.n} <span className="font-normal text-zinc-500">· {t.c} · {st.nights === 0 ? "day trip" : `${st.nights}n`}</span>
              </div>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <b className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    🎟️ Activities
                  </b>
                  {checkedActs.length ? (
                    checkedActs.map(([name, price]) => (
                      <div key={name} className="flex justify-between text-zinc-400">
                        <span>{name}</span>
                        <span>{price ? money(price) : "free"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600">none selected</div>
                  )}
                </div>
                <div>
                  <b className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    🍽️ Food
                  </b>
                  <div className="flex justify-between text-zinc-400">
                    <span>{ft[0]} × {dys}d</span>
                    <span>{money(ft[1] * dys)}</span>
                  </div>
                  {checkedSig.map(([name, price]) => (
                    <div key={name} className="flex justify-between text-zinc-400">
                      <span>{name}</span>
                      <span>{money(price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3">
        <b className="text-xs text-zinc-300">💳 Booked actuals</b>{" "}
        <span className="text-[11px] text-zinc-500">— type the real price once you book; blank = still an estimate</span>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {ACTUAL_FIELDS.map(([key, label, est]) => (
            <label key={key} className="flex items-center gap-1.5 text-zinc-400">
              {label} <span className="text-[10.5px] text-zinc-600">est {money(est)}</span>
              <input
                type="number"
                min={0}
                value={hasVal(actuals[key]) ? String(actuals[key]) : ""}
                onChange={(e) =>
                  setActual(slot.id, key, e.target.value === "" ? null : Math.max(0, +e.target.value || 0))
                }
                placeholder="$"
                className="w-[70px] rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
            </label>
          ))}
          {booked && (
            <span className={`font-bold ${blend - costs.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {blend - costs.total >= 0 ? "+" : ""}
              {money(blend - costs.total)} vs estimate
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-3">
        <div className="text-sm font-semibold text-zinc-100">📅 Book this trip</div>
        <div className="mt-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
          {timingTip(slot)}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {flightLegs.length > 0 && (
            <BookCol title="✈️ Flights">
              {flightLegs.map((l, i) => (
                <BookLink
                  key={i}
                  label={`${l.from} → ${l.to}${l.d ? ` (${nice(l.d)})` : ""}`}
                  href={googleFlightsUrl(l.from, l.to, l.d)}
                />
              ))}
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                <a href={STATIC_LINKS.skyscanner} target="_blank" rel="noopener" className="text-blue-400">
                  Skyscanner
                </a>
                <a href={STATIC_LINKS.kiwi} target="_blank" rel="noopener" className="text-blue-400">
                  Kiwi
                </a>
                <a href={STATIC_LINKS.ryanair} target="_blank" rel="noopener" className="text-blue-400">
                  Ryanair
                </a>
                <a href={STATIC_LINKS.wizzair} target="_blank" rel="noopener" className="text-blue-400">
                  Wizz Air
                </a>
              </div>
            </BookCol>
          )}
          {railLegs.length > 0 && (
            <BookCol title="🚆 Trains & buses">
              {railLegs.map((l, i) => (
                <div key={i} className="text-[11.5px] text-zinc-400">
                  {l.from} → {l.to} <span className="text-zinc-600">{l.km ? `~${l.km} km` : ""}</span>
                </div>
              ))}
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                <a href={STATIC_LINKS.omio} target="_blank" rel="noopener" className="text-blue-400">
                  Omio
                </a>
                <a href={STATIC_LINKS.trainline} target="_blank" rel="noopener" className="text-blue-400">
                  Trainline
                </a>
                <a href={STATIC_LINKS.flixbus} target="_blank" rel="noopener" className="text-blue-400">
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
                    <div className="text-[11px] font-semibold text-zinc-300">
                      {t.n} <span className="font-normal text-zinc-600">{nice(d.in)} → {nice(d.out)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                      <a href={hostelworldUrl(t.n, ci, co)} target="_blank" rel="noopener" className="text-blue-400">
                        Hostelworld
                      </a>
                      <a href={bookingComUrl(t.n, ci, co)} target="_blank" rel="noopener" className="text-blue-400">
                        Booking
                      </a>
                      <a href={airbnbUrl(t.n, ci, co)} target="_blank" rel="noopener" className="text-blue-400">
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
                  <div className="text-[11px] font-semibold text-zinc-300">{t.n}</div>
                  <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                    <a href={getYourGuideUrl(t.n)} target="_blank" rel="noopener" className="text-blue-400">
                      GetYourGuide
                    </a>
                    <a href={viatorUrl(t.n)} target="_blank" rel="noopener" className="text-blue-400">
                      Viator
                    </a>
                    <a href={tiqetsUrl(t.n)} target="_blank" rel="noopener" className="text-blue-400">
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
            <b className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
              🍜 Find the signature food
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
                      className="text-blue-400"
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <b className="mb-1.5 block text-xs text-zinc-200">{title}</b>
      {children}
    </div>
  );
}

function BookLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="text-[11.5px] text-zinc-400">
      {label}:{" "}
      <a href={href} target="_blank" rel="noopener" className="font-medium text-blue-400">
        Google Flights ↗
      </a>
    </div>
  );
}
