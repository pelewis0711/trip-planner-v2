"use client";

import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";

const SEGMENTS: { key: "travel" | "lodg" | "food" | "act"; label: string; color: string }[] = [
  { key: "travel", label: "Travel", color: "#4bc4ff" },
  { key: "lodg", label: "Lodging", color: "#c48cff" },
  { key: "food", label: "Food", color: "#ffb547" },
  { key: "act", label: "Activities", color: "#39d0a8" },
];

export default function SummaryBar({
  travel,
  lodg,
  food,
  act,
  total,
}: {
  travel: number;
  lodg: number;
  food: number;
  act: number;
  total: number;
}) {
  const currency = usePlanStore((s) => s.defaultCurrency);
  const values = { travel, lodg, food, act };
  if (total <= 0) return null;

  return (
    <div className="mt-4 flex h-7 overflow-hidden rounded-lg bg-zinc-900">
      {SEGMENTS.map((s) => {
        const v = values[s.key];
        if (v <= 0) return null;
        const pct = (v / total) * 100;
        return (
          <div
            key={s.key}
            style={{ width: `${pct.toFixed(2)}%`, backgroundColor: s.color }}
            className="flex items-center justify-center overflow-hidden text-[11px] font-bold whitespace-nowrap text-zinc-950"
            title={`${s.label}: ${formatMoney(v, currency)}`}
          >
            {pct > 7 ? s.label : ""}
          </div>
        );
      })}
    </div>
  );
}
