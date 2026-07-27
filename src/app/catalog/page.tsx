"use client";

import { useMemo, useState } from "react";
import { TRIPS } from "@/data/trips";
import { useActivePlan } from "@/lib/store/plan";
import { resolveHome } from "@/lib/resolveHome";
import {
  activeFilterCount,
  buildFilterGroups,
  emptyFilters,
  tripMatches,
  type FilterKey,
} from "@/lib/filters";
import { tripPriceRange } from "@/lib/calc/costs";
import { makeCtx } from "@/lib/calc/context";
import FilterPanel from "@/components/FilterPanel";
import TripCard from "@/components/TripCard";
import SetupWizardModal from "@/components/onboarding/SetupWizardModal";

export default function CatalogPage() {
  const activePlan = useActivePlan();
  const { home } = activePlan;
  const [filters, setFilters] = useState(emptyFilters());
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // same "never configured at all" signal Calendar/Itinerary already use --
  // catalog never got this gate, so an unconfigured visitor's filters/prices
  // were silently computed as if their home were Prague (the actual bug
  // this task's requirement 3 flagged). Fixed here alongside the general
  // city-resolution work since it's the same root cause.
  const isUnconfigured = !home && !activePlan.semester;

  // [0, 0] (null island) for an unresolved home -- never Prague. Only
  // matters if isUnconfigured is somehow false with an unresolvable home
  // (e.g. a data inconsistency), since the gate below covers the normal case.
  const resolved = resolveHome(home);
  const homeCoord: [number, number] = resolved ? [resolved.lat, resolved.lon] : [0, 0];
  const ctx = useMemo(() => makeCtx(home), [home]);
  const tripById = useMemo(() => new Map(TRIPS.map((t) => [t.id, t])), []);
  const coordsOf = (id: string) => tripById.get(id)?.co;
  const groups = useMemo(() => buildFilterGroups(TRIPS), []);

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

  if (isUnconfigured) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-card border-2 border-dashed border-border p-14 text-center">
          <h2 className="font-heading text-xl font-semibold text-ink">Let&apos;s set up your trip first</h2>
          <p className="mt-2 text-sm text-muted">
            Pick your host city so trip distances and prices are calculated from your own program,
            not someone else&apos;s.
          </p>
          <button type="button" onClick={() => setWizardOpen(true)} className="btn btn-primary btn-lg mt-5">
            Set up now
          </button>
        </div>
        {wizardOpen && <SetupWizardModal onClose={() => setWizardOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="font-heading text-xl font-semibold text-ink">
          Trip Catalog <span className="font-sans text-sm font-normal text-muted">— {visible.length} of {TRIPS.length} options</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Prices are per person, round-trip from {home || "your home city (not set yet)"}, mid-range
          estimates. Head to{" "}
          <b className="text-ink">My Calendar</b> to drop a trip onto a slot.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 Search city, country, or region…"
          className="w-full min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted sm:w-auto"
        />
        <button type="button" onClick={() => setShowFilters((s) => !s)} className="btn btn-secondary btn-sm">
          ⚙ Filters {activeCount ? `(${activeCount})` : ""} {showFilters ? "▲" : "▼"}
        </button>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="btn btn-secondary btn-sm">
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-3">
          <FilterPanel groups={groups} filters={filters} onToggle={toggle} />
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-card border-2 border-dashed border-border p-10 text-center text-muted">
          No trips match those filters. Try clearing a few.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const { floor, ceiling } = tripPriceRange(t, ctx);
            return <TripCard key={t.id} trip={t} floor={floor} ceiling={ceiling} />;
          })}
        </div>
      )}
    </div>
  );
}
