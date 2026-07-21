"use client";

import { useMemo, useState } from "react";
import { TRIPS } from "@/data/trips";
import { HOMES } from "@/data/homes";
import { useHomeStore } from "@/lib/store/home";
import {
  activeFilterCount,
  buildFilterGroups,
  emptyFilters,
  tripMatches,
  type FilterKey,
} from "@/lib/filters";
import { tripBaseTotal } from "@/lib/calc/costs";
import { makeCtx } from "@/lib/calc/context";
import FilterPanel from "@/components/FilterPanel";
import TripCard from "@/components/TripCard";

const GROUPS = buildFilterGroups();
const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));
const coordsOf = (id: string) => TRIP_BY_ID.get(id)?.co;

export default function CatalogPage() {
  const home = useHomeStore((s) => s.home);
  const [filters, setFilters] = useState(emptyFilters());
  const [query, setQuery] = useState("");

  const homeCoord = HOMES[home] || HOMES.Prague;
  const ctx = useMemo(() => makeCtx(home), [home]);

  const toggle = (key: FilterKey, val: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(val)) next[key].delete(val);
      else next[key].add(val);
      return next;
    });
  };

  const clearAll = () => {
    setFilters(emptyFilters());
    setQuery("");
  };

  const visible = useMemo(
    () => TRIPS.filter((t) => tripMatches(t, filters, query, homeCoord, coordsOf)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, query, home]
  );

  const activeCount = activeFilterCount(filters, query);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-xl font-semibold text-zinc-50">
          Trip Catalog <span className="text-sm font-normal text-zinc-500">— {visible.length} of {TRIPS.length} options</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Prices are per person, round-trip from {home}, mid-range estimates. Add-to-calendar arrives
          in the next stage.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 Search city, country, or region…"
          className="min-w-[220px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-emerald-500/50 hover:text-zinc-100"
        >
          Clear all filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className="mt-3">
        <FilterPanel groups={GROUPS} filters={filters} onToggle={toggle} />
      </div>

      {visible.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
          No trips match those filters. Try clearing a few.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TripCard key={t.id} trip={t} price={tripBaseTotal(t, ctx)} />
          ))}
        </div>
      )}
    </div>
  );
}
