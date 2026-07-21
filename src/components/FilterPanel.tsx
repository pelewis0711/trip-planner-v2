"use client";

import type { FilterGroup, FilterKey, FilterState } from "@/lib/filters";

export default function FilterPanel({
  groups,
  filters,
  onToggle,
  compact,
}: {
  groups: FilterGroup[];
  filters: FilterState;
  onToggle: (key: FilterKey, val: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 ${
        compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          <h5 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
            {g.label}
          </h5>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {g.opts.map((o) => {
              const on = filters[g.key].has(o.val);
              return (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => onToggle(g.key, o.val)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                    on
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-emerald-500/50 hover:text-zinc-100"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
