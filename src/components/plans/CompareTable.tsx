"use client";

import type { Plan } from "@/lib/store/plan";
import { planGrandTotals, planSlotSummary, COMPARE_SLOTS } from "@/lib/planTotals";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Row({
  label,
  values,
  fmt = money,
  lowerBetter = true,
}: {
  label: string;
  values: number[];
  fmt?: (n: number) => string;
  lowerBetter?: boolean;
}) {
  const valid = values.filter((v) => !Number.isNaN(v));
  const best = valid.length ? (lowerBetter ? Math.min(...valid) : Math.max(...valid)) : null;
  const worst = valid.length ? (lowerBetter ? Math.max(...valid) : Math.min(...valid)) : null;

  return (
    <tr className="border-b border-zinc-800/60">
      <td className="sticky left-0 w-[96px] shrink-0 bg-zinc-900 px-2.5 py-2 text-left text-zinc-400 sm:w-auto sm:px-3">
        {label}
      </td>
      {values.map((v, i) => {
        const cls =
          valid.length > 1 && v === best
            ? "text-emerald-400 font-bold"
            : valid.length > 1 && v === worst
              ? "text-rose-400"
              : "text-zinc-300";
        return (
          <td key={i} className={`min-w-[92px] px-2.5 py-2 text-right sm:px-3 ${cls}`}>
            {Number.isNaN(v) ? "—" : fmt(v)}
          </td>
        );
      })}
    </tr>
  );
}

export default function CompareTable({
  plans,
  planIds,
  activeId,
}: {
  plans: Record<string, Plan>;
  planIds: string[];
  activeId: string;
}) {
  if (planIds.length < 2) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-base font-semibold text-zinc-100">Side-by-side comparison</h3>
        <p className="mt-1.5 text-sm text-zinc-500">
          Tick <b className="text-zinc-300">compare</b> on at least two plans above to see them lined
          up — category totals, per-weekend trips, and where the money differs.
        </p>
      </div>
    );
  }

  const chosen = planIds.map((id) => plans[id]).filter(Boolean);
  const totals = chosen.map(planGrandTotals);

  const slotRows = COMPARE_SLOTS.map((s) => {
    const cells = chosen.map((p) => planSlotSummary(p, s.id));
    if (cells.every((c) => !c)) return null;
    return { slot: s, cells };
  }).filter(Boolean) as { slot: (typeof COMPARE_SLOTS)[number]; cells: (string | null)[] }[];

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 px-1 text-base font-semibold text-zinc-100">
        Side-by-side comparison{" "}
        <span className="text-xs font-normal text-zinc-500">— green = lowest, red = highest</span>
      </h3>
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-zinc-800">
            <th className="sticky left-0 w-[96px] shrink-0 bg-zinc-900 px-2.5 py-2 text-left text-sm text-zinc-200 sm:w-auto sm:px-3">
              Plan
            </th>
            {chosen.map((p) => (
              <th key={p.id} className="min-w-[92px] px-2.5 py-2 text-right text-sm text-zinc-200 sm:px-3">
                {p.name}
                {p.id === activeId && (
                  <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                    EDITING
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={chosen.length + 1} className="bg-zinc-950 px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-zinc-500 uppercase">
              Scope
            </td>
          </tr>
          <tr className="border-b border-zinc-800/60">
            <td className="sticky left-0 w-[96px] shrink-0 bg-zinc-900 px-2.5 py-2 text-left text-zinc-400 sm:w-auto sm:px-3">
              Home base
            </td>
            {chosen.map((p) => (
              <td key={p.id} className="min-w-[92px] px-2.5 py-2 text-right text-zinc-300 sm:px-3">
                {p.home}
              </td>
            ))}
          </tr>
          <Row label="Trips scheduled" values={totals.map((t) => t.count)} fmt={String} lowerBetter={false} />
          <Row label="Places visited" values={totals.map((t) => t.stops)} fmt={String} lowerBetter={false} />
          <Row label="Total nights away" values={totals.map((t) => t.nights)} fmt={String} lowerBetter={false} />

          <tr>
            <td colSpan={chosen.length + 1} className="bg-zinc-950 px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-zinc-500 uppercase">
              Cost by category
            </td>
          </tr>
          <Row label="✈️ Travel" values={totals.map((t) => t.travel)} />
          <Row label="🛏️ Lodging" values={totals.map((t) => t.lodg)} />
          <Row label="🍽️ Food" values={totals.map((t) => t.food)} />
          <Row label="🎟️ Activities" values={totals.map((t) => t.act)} />
          <Row label="Subtotal" values={totals.map((t) => t.total)} />
          <Row label="+12% buffer" values={totals.map((t) => t.total * 1.12)} />
          <Row
            label="Cost per night away"
            values={totals.map((t) => (t.nights ? t.total / t.nights : NaN))}
          />

          <tr>
            <td colSpan={chosen.length + 1} className="bg-zinc-950 px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-zinc-500 uppercase">
              What&apos;s booked each slot
            </td>
          </tr>
          {slotRows.length ? (
            slotRows.map(({ slot, cells }) => (
              <tr key={slot.id} className="border-b border-zinc-800/60">
                <td className="sticky left-0 w-[96px] shrink-0 bg-zinc-900 px-2.5 py-2 text-left text-zinc-400 sm:w-auto sm:px-3">
                  {slot.label} <span className="text-zinc-600">{slot.date}</span>
                </td>
                {cells.map((c, i) => (
                  <td key={i} className="min-w-[92px] px-2.5 py-2 text-left text-[11px] whitespace-normal text-zinc-300 sm:px-3">
                    {c ?? <span className="text-zinc-600">—</span>}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={chosen.length + 1} className="px-3 py-3 text-center text-zinc-600">
                No trips scheduled in any compared plan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
