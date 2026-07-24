"use client";

import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { planGrandTotals, planSlotSummary } from "@/lib/planTotals";
import { unionSlots } from "@/lib/calc/semester";
import { formatMoney } from "@/lib/calc/currency";

function Row({
  label,
  values,
  fmt,
  lowerBetter = true,
}: {
  label: string;
  values: number[];
  fmt: (n: number) => string;
  lowerBetter?: boolean;
}) {
  const valid = values.filter((v) => !Number.isNaN(v));
  const best = valid.length ? (lowerBetter ? Math.min(...valid) : Math.max(...valid)) : null;
  const worst = valid.length ? (lowerBetter ? Math.max(...valid) : Math.min(...valid)) : null;

  return (
    <tr className="border-b border-border/60">
      <td className="sticky left-0 w-[96px] shrink-0 bg-surface px-2.5 py-2 text-left text-muted sm:w-auto sm:px-3">
        {label}
      </td>
      {values.map((v, i) => {
        const cls =
          valid.length > 1 && v === best
            ? "text-success font-bold"
            : valid.length > 1 && v === worst
              ? "text-danger"
              : "text-ink";
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
  const currency = usePlanStore((s) => s.defaultCurrency);
  const money = (n: number) => formatMoney(n, currency);

  if (planIds.length < 2) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <h3 className="font-heading text-base font-semibold text-ink">Side-by-side comparison</h3>
        <p className="mt-1.5 text-sm text-muted">
          Tick <b className="text-ink">compare</b> on at least two plans above to see them lined
          up — category totals, per-weekend trips, and where the money differs.
        </p>
      </div>
    );
  }

  const chosen = planIds.map((id) => plans[id]).filter(Boolean);
  const totals = chosen.map(planGrandTotals);

  // plans being compared can have different semesters (a friend's custom
  // dates vs. the default AAU ones), so slot rows are the union across all
  // of them rather than one fixed list — for same-semester plans (the usual
  // case) this is exactly the same rows as before.
  const compareSlots = unionSlots(chosen);
  const slotRows = compareSlots.map((s) => {
    const cells = chosen.map((p) => planSlotSummary(p, s.id));
    if (cells.every((c) => !c)) return null;
    return { slot: s, cells };
  }).filter(Boolean) as { slot: (typeof compareSlots)[number]; cells: (string | null)[] }[];

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface p-4">
      <h3 className="mb-3 px-1 font-heading text-base font-semibold text-ink">
        Side-by-side comparison{" "}
        <span className="font-sans text-xs font-normal text-muted">— green = lowest, red = highest</span>
      </h3>
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="sticky left-0 w-[96px] shrink-0 bg-surface px-2.5 py-2 text-left text-sm text-ink sm:w-auto sm:px-3">
              Plan
            </th>
            {chosen.map((p) => (
              <th key={p.id} className="min-w-[92px] px-2.5 py-2 text-right text-sm text-ink sm:px-3">
                {p.name}
                {p.id === activeId && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    EDITING
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={chosen.length + 1} className="bg-surface-muted px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-muted uppercase">
              Scope
            </td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="sticky left-0 w-[96px] shrink-0 bg-surface px-2.5 py-2 text-left text-muted sm:w-auto sm:px-3">
              Home base
            </td>
            {chosen.map((p) => (
              <td key={p.id} className="min-w-[92px] px-2.5 py-2 text-right text-ink sm:px-3">
                {p.home}
              </td>
            ))}
          </tr>
          <Row label="Trips scheduled" values={totals.map((t) => t.count)} fmt={String} lowerBetter={false} />
          <Row label="Places visited" values={totals.map((t) => t.stops)} fmt={String} lowerBetter={false} />
          <Row label="Total nights away" values={totals.map((t) => t.nights)} fmt={String} lowerBetter={false} />

          <tr>
            <td colSpan={chosen.length + 1} className="bg-surface-muted px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-muted uppercase">
              Cost by category
            </td>
          </tr>
          <Row label="✈️ Travel" values={totals.map((t) => t.travel)} fmt={money} />
          <Row label="🛏️ Lodging (per person)" values={totals.map((t) => t.lodg)} fmt={money} />
          <Row label="🛏️ Lodging (group)" values={totals.map((t) => t.lodgGroup)} fmt={money} />
          <Row label="🍽️ Food" values={totals.map((t) => t.food)} fmt={money} />
          <Row label="🎟️ Activities" values={totals.map((t) => t.act)} fmt={money} />
          <Row label="Subtotal (per person)" values={totals.map((t) => t.total)} fmt={money} />
          <Row label="Subtotal (group)" values={totals.map((t) => t.totalGroup)} fmt={money} />
          <Row label="+12% buffer" values={totals.map((t) => t.total * 1.12)} fmt={money} />
          <Row
            label="Cost per night away"
            values={totals.map((t) => (t.nights ? t.total / t.nights : NaN))}
            fmt={money}
          />

          <tr>
            <td colSpan={chosen.length + 1} className="bg-surface-muted px-3 py-1.5 text-[10.5px] font-bold tracking-wide text-muted uppercase">
              What&apos;s booked each slot
            </td>
          </tr>
          {slotRows.length ? (
            slotRows.map(({ slot, cells }) => (
              <tr key={slot.id} className="border-b border-border/60">
                <td className="sticky left-0 w-[96px] shrink-0 bg-surface px-2.5 py-2 text-left text-muted sm:w-auto sm:px-3">
                  {slot.label} <span className="text-muted">{slot.date}</span>
                </td>
                {cells.map((c, i) => (
                  <td key={i} className="min-w-[92px] px-2.5 py-2 text-left text-[11px] whitespace-normal text-ink sm:px-3">
                    {c ?? <span className="text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={chosen.length + 1} className="px-3 py-3 text-center text-muted">
                No trips scheduled in any compared plan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
