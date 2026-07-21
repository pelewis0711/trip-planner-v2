"use client";

import { useMemo, useState } from "react";
import { TRIPS } from "@/data/trips";
import { HOMES } from "@/data/homes";
import {
  activeFilterCount,
  buildFilterGroups,
  emptyFilters,
  tripMatches,
  type FilterKey,
} from "@/lib/filters";
import FilterPanel from "@/components/FilterPanel";

const GROUPS = buildFilterGroups();
const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));
const coordsOf = (id: string) => TRIP_BY_ID.get(id)?.co;

export default function TripTray({
  home,
  armedId,
  onArm,
  onDragStart,
}: {
  home: string;
  armedId: string | null;
  onArm: (tripId: string) => void;
  onDragStart: (tripId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);

  const homeCoord = HOMES[home] || HOMES.Prague;

  const toggle = (key: FilterKey, val: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(val)) next[key].delete(val);
      else next[key].add(val);
      return next;
    });
  };

  const visible = useMemo(
    () => TRIPS.filter((t) => tripMatches(t, filters, query, homeCoord, coordsOf)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, query, home]
  );

  const activeCount = activeFilterCount(filters, query);

  return (
    <aside className="flex max-h-[calc(100vh-6rem)] flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 lg:sticky lg:top-20">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">
        Trips <span className="font-normal text-zinc-500">— tap or drag ({visible.length})</span>
      </h3>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔎 Search…"
        className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
      />
      <button
        type="button"
        onClick={() => setShowFilters((s) => !s)}
        className="mt-2 self-start text-xs font-semibold text-zinc-500 hover:text-zinc-200"
      >
        ⚙ Filters {activeCount ? `(${activeCount})` : ""} {showFilters ? "▲" : "▼"}
      </button>
      {showFilters && (
        <div className="mt-2">
          <FilterPanel groups={GROUPS} filters={filters} onToggle={toggle} compact />
        </div>
      )}

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/trip-id", t.id);
              onDragStart(t.id);
            }}
            onClick={() => onArm(t.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
              armedId === t.id
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-zinc-800 bg-zinc-950 hover:border-emerald-500/40"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-zinc-100">{t.n}</span>
              <span className="block truncate text-[10.5px] text-zinc-500">{t.c}</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-emerald-400">
              {t.g === 0 ? "day" : `${t.g}n`}
            </span>
          </button>
        ))}
        {!visible.length && (
          <p className="p-3 text-center text-xs text-zinc-500">No trips match those filters.</p>
        )}
      </div>
    </aside>
  );
}
