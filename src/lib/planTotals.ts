import type { Plan } from "@/lib/store/plan";
import { makeCtx } from "@/lib/calc/context";
import { grandTotals, type GrandTotals } from "@/lib/calc/costs";
import { SLOTS } from "@/data/slots";

export interface PlanGrandTotals extends GrandTotals {
  nights: number;
}

export function planGrandTotals(plan: Plan): PlanGrandTotals {
  const ctx = makeCtx(plan.home, plan.bag);
  const g = grandTotals(plan.placements, ctx);
  let nights = 0;
  for (const sid in plan.placements) {
    for (const st of plan.placements[sid].stops) nights += st.nights || 0;
  }
  return { ...g, nights };
}

// "Rome 3n → Florence 2n" style summary for one slot in one plan, for the compare table.
export function planSlotSummary(plan: Plan, slotId: string): string | null {
  const stops = plan.placements[slotId]?.stops;
  if (!stops || !stops.length) return null;
  const ctx = makeCtx(plan.home, plan.bag);
  return stops
    .map((s) => {
      const t = ctx.tripOf(s.tripId);
      if (!t) return "?";
      return s.nights ? `${t.n} ${s.nights}n` : `${t.n} day`;
    })
    .join(" → ");
}

export const COMPARE_SLOTS = SLOTS;
