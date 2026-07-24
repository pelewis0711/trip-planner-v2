"use client";

import { useMemo, useState } from "react";
import { TRIPS } from "@/data/trips";
import { useCustomTripsStore } from "@/lib/store/customTrips";
import { resolveHome } from "@/lib/resolveHome";
import {
  activeFilterCount,
  buildFilterGroups,
  emptyFilters,
  tripMatches,
  type FilterKey,
} from "@/lib/filters";
import FilterPanel from "@/components/FilterPanel";

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
  const customTrips = useCustomTripsStore((s) => s.trips);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);

  // [0, 0] (null island) for an unresolved home -- never Prague. Calendar's
  // own isUnconfigured check already keeps this page from being shown at
  // all when there's no real home set, so this is a safety net only.
  const resolved = resolveHome(home);
  const homeCoord: [number, number] = resolved ? [resolved.lat, resolved.lon] : [0, 0];
  const allTrips = useMemo(
    () => (Object.keys(customTrips).length ? [...TRIPS, ...Object.values(customTrips)] : TRIPS),
    [customTrips]
  );
  const tripById = useMemo(() => new Map(allTrips.map((t) => [t.id, t])), [allTrips]);
  const coordsOf = (id: string) => tripById.get(id)?.co;
  const groups = useMemo(() => buildFilterGroups(allTrips), [allTrips]);

  const toggle = (key: FilterKey, val: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(val)) next[key].delete(val);
      else next[key].add(val);
      return next;
    });
  };

  const visible = useMemo(
    () => allTrips.filter((t) => tripMatches(t, filters, query, homeCoord, coordsOf)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTrips, filters, query, home]
  );

  const activeCount = activeFilterCount(filters, query);

  return (
    <aside className="flex max-h-[calc(100vh-6rem)] flex-col rounded-card border border-border bg-surface p-3 lg:sticky lg:top-24">
      <h3 className="mb-2 font-heading text-sm font-semibold text-ink">
        Trips <span className="font-sans font-normal text-muted">— tap or drag ({visible.length})</span>
      </h3>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔎 Search…"
        className="rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-xs text-ink placeholder:text-muted"
      />
      <button
        type="button"
        onClick={() => setShowFilters((s) => !s)}
        className="mt-2 self-start text-xs font-semibold text-muted hover:text-primary"
      >
        ⚙ Filters {activeCount ? `(${activeCount})` : ""} {showFilters ? "▲" : "▼"}
      </button>
      {showFilters && (
        <div className="mt-2">
          <FilterPanel groups={groups} filters={filters} onToggle={toggle} compact />
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
                ? "border-primary bg-primary-soft"
                : "border-border bg-surface-muted hover:border-primary/40"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{t.n}</span>
              <span className="block truncate text-[10.5px] text-muted">{t.c}</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-accent">
              {t.g === 0 ? "day" : `${t.g}n`}
            </span>
          </button>
        ))}
        {!visible.length && (
          <p className="p-3 text-center text-xs text-muted">No trips match those filters.</p>
        )}
      </div>
    </aside>
  );
}
