"use client";

import { useMemo, useState } from "react";
import { useActivePlan, usePlanStore } from "@/lib/store/plan";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { makeCtx } from "@/lib/calc/context";
import { blendedTotals, grandTotals } from "@/lib/calc/costs";
import { liveAdjustedGrandTotals } from "@/lib/calc/livePricing";
import { useLivePriceStore } from "@/lib/store/livePrices";
import { schengenDays, schengenStatus } from "@/lib/calc/schengen";
import { BAGS, type BagOption } from "@/lib/calc/pricing";
import SummaryBar from "@/components/itinerary/SummaryBar";
import SlotItinerary from "@/components/itinerary/SlotItinerary";
import CheatSheet from "@/components/itinerary/CheatSheet";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function ItineraryPage() {
  const activePlan = useActivePlan();
  const { home, placements, bag, budget, useLivePrices } = activePlan;
  const setBag = usePlanStore((s) => s.setBag);
  const setBudget = usePlanStore((s) => s.setBudget);
  const setUseLivePrices = usePlanStore((s) => s.setUseLivePrices);
  const livePrices = useLivePriceStore((s) => s.prices);

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const ctx = useMemo(() => makeCtx(home, bag), [home, bag]);
  const slots = useMemo(() => getSlotsForPlan(activePlan), [activePlan]);
  const semesterYear = activePlan.semester ? Number(activePlan.semester.start.slice(0, 4)) : 2027;
  const g = useLivePrices
    ? liveAdjustedGrandTotals(placements, ctx, slots, semesterYear, livePrices)
    : grandTotals(placements, ctx);
  const bt = blendedTotals(placements, ctx);
  const schD = schengenDays(placements, home, ctx.tripOf);
  const schStatus = schengenStatus(schD);
  const ordered = slots.filter((s) => placements[s.id]?.stops.length);
  const contingency = g.total * 0.12;
  const remaining = budget !== null ? budget - bt.blend : null;

  if (g.count === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-dashed border-zinc-800 p-14 text-center">
          <h2 className="text-xl font-semibold text-zinc-50">No trips scheduled yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Head to the Trip Catalog and drag options onto your Calendar. Your live itinerary and
            category totals will build here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Itinerary &amp; Live Totals</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {g.count} trip{g.count > 1 ? "s" : ""} scheduled · per person, USD. Everything
              recomputes as you edit trips on the Calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500/50"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Travel", g.travel, "text-sky-400"],
            ["Lodging", g.lodg, "text-violet-400"],
            ["Food", g.food, "text-amber-400"],
            ["Activities", g.act, "text-emerald-400"],
            ["Trips subtotal", g.total, "text-zinc-100"],
          ].map(([label, val, cls]) => (
            <div key={label as string} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <b className={`block text-xl font-extrabold ${cls}`}>{money(val as number)}</b>
              <span className="text-[11px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        <SummaryBar travel={g.travel} lodg={g.lodg} food={g.food} act={g.act} total={g.total} />

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span
            className={
              schStatus === "red"
                ? "font-bold text-rose-400"
                : schStatus === "amber"
                  ? "font-semibold text-amber-400"
                  : "text-zinc-300"
            }
          >
            🛂 Schengen days: <b>{schD}</b> / 90 per 180
            {schStatus === "red" && " — OVER the limit. Swap a trip for a non-Schengen one."}
            {schStatus === "amber" && " — cutting it close, leave buffer for spontaneous trips."}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-zinc-400">
            🧳 Flight extras:
            <select
              value={bag}
              onChange={(e) => setBag(e.target.value as BagOption)}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
            >
              {(Object.entries(BAGS) as [BagOption, [string, number]][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[0]}
                  {v[1] ? ` (+$${v[1]}/flight)` : ""}
                </option>
              ))}
            </select>
          </label>

          {editingBudget ? (
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                autoFocus
                min={0}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setBudget(budgetInput === "" ? null : Math.max(0, +budgetInput || 0));
                    setEditingBudget(false);
                  }
                  if (e.key === "Escape") setEditingBudget(false);
                }}
                placeholder="USD"
                className="w-24 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
              <button
                type="button"
                onClick={() => {
                  setBudget(budgetInput === "" ? null : Math.max(0, +budgetInput || 0));
                  setEditingBudget(false);
                }}
                className="rounded-md bg-emerald-500 px-2 py-1 font-bold text-zinc-950"
              >
                Save
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBudgetInput(budget !== null ? String(budget) : "");
                setEditingBudget(true);
              }}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300 hover:border-emerald-500/50"
            >
              💰 {budget !== null ? `Budget: ${money(budget)}` : "Set travel budget"}
            </button>
          )}

          {bt.booked > 0 && (
            <span className="text-zinc-400">
              📌 {bt.booked} slot{bt.booked > 1 ? "s" : ""} with booked actuals → projected{" "}
              <b className="text-zinc-100">{money(bt.blend)}</b>{" "}
              <span className={bt.blend > bt.est ? "text-rose-400" : "text-emerald-400"}>
                ({bt.blend >= bt.est ? "+" : ""}
                {money(bt.blend - bt.est)} vs estimate)
              </span>
            </span>
          )}

          {budget !== null && remaining !== null && (
            <span className={`font-bold ${remaining < 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {remaining < 0 ? `OVER budget by ${money(-remaining)}` : `${money(remaining)} remaining`}
            </span>
          )}

          <label className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300">
            <input
              type="checkbox"
              checked={!!useLivePrices}
              onChange={(e) => setUseLivePrices(e.target.checked)}
              className="accent-sky-500"
            />
            ✈️ Use live flight prices
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[12.5px] text-amber-200">
          ➕ Eurail Global Pass (Youth, 10 days/2 mo) ≈ <b>$296</b> if you&apos;re doing the rail-heavy
          trips · +12% contingency buffer ≈ <b>{money(contingency)}</b> → <b>estimated grand total ≈{" "}
          {money(g.total + 296 + contingency)}</b>. Excludes normal {home} weekday living/housing.
        </div>
      </div>

      <div className="print:hidden">
        <div className="mt-4">
          <CheatSheet />
        </div>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-zinc-300">
        Your schedule &amp; booking links (chronological)
      </h3>
      <div className="space-y-4">
        {ordered.map((slot) => (
          <SlotItinerary
            key={slot.id}
            slot={slot}
            placement={placements[slot.id]}
            ctx={ctx}
            home={home}
            year={semesterYear}
          />
        ))}
      </div>
    </div>
  );
}
