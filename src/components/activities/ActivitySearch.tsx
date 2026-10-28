"use client";

// Phase 26 step 4: search every city's activities at once (Catalog's
// "Activities" view). Results are grouped by city; "+ Add" opens that city's
// trip sheet with the activity already picked, where the existing "Add to
// weekend" flow places it (Parker's choices, Oct 28, 2026).
//
// The text comes from Catalog's own search box; the chips and sort live
// here. Catalog's city filters (region, cost, ...) decide which cities are
// searched. Everything runs over the bundled data -- no API, no table.
import { useMemo, useState } from "react";
import type { Trip } from "@/data/trips";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import TripDetailSheet from "@/components/TripDetailSheet";
import { formatMoney } from "@/lib/calc/currency";
import { ACTIVITY_CATEGORIES } from "@/lib/activityMeta";
import { useActivityDescriptions } from "@/lib/activityDescriptions";
import { EMPTY_QUERY, isFiltering, searchAcrossTrips, type BrowserQuery } from "@/lib/activityBrowser";
import { ActivityRow, Chip, QueryControls } from "./parts";

const CITY_PAGE = 25;
const ITEMS_SHOWN = 3;
const SUGGESTIONS = ["kayak", "cooking class", "wine", "sunset", "hike", "street art"];

export default function ActivitySearch({
  trips,
  text,
  onSuggest,
  priceRange,
  currency,
}: {
  /** Cities to search (already narrowed by Catalog's filters). */
  trips: readonly Trip[];
  /** Catalog's search box. */
  text: string;
  onSuggest: (text: string) => void;
  priceRange: (t: Trip) => { floor: number; ceiling: number };
  currency: Currency;
}) {
  const descriptions = useActivityDescriptions();
  const [controls, setControls] = useState<BrowserQuery>(EMPTY_QUERY);
  const query = useMemo(() => ({ ...controls, text }), [controls, text]);
  const groups = useMemo(() => searchAcrossTrips(trips, query, descriptions), [trips, query, descriptions]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const [cityLimit, setCityLimit] = useState(CITY_PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ trip: Trip; picked: string[] } | null>(null);
  // A new search starts back at the first page with every city collapsed.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setCityLimit(CITY_PAGE);
    setExpanded(new Set());
  }

  const chipsOn = controls.quick.length > 0 || controls.categories.length > 0;

  return (
    <div className="mt-3">
      <div className="rounded-card border border-border bg-surface p-3">
        <QueryControls
          query={query}
          setQuery={setControls}
          categories={ACTIVITY_CATEGORIES.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji }))}
          currency={currency}
          placeholder="Search activities"
          hideSearch
        />
      </div>

      {!isFiltering(query) ? (
        <div className="mt-4 rounded-card border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink">Search every city&apos;s activities at once.</p>
          <p className="mt-1 text-xs text-muted">Type above or pick a filter. Try:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} on={false} onClick={() => onSuggest(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {total === 0
                ? "No activities match"
                : `${total} ${total === 1 ? "activity" : "activities"} in ${groups.length} ${groups.length === 1 ? "city" : "cities"}`}
            </span>
            {chipsOn && (
              <button
                type="button"
                onClick={() => setControls((c) => ({ ...EMPTY_QUERY, sort: c.sort }))}
                className="font-semibold text-primary hover:underline"
              >
                Clear chips
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="mt-3 rounded-card border-2 border-dashed border-border p-8 text-center text-sm text-muted">
              Nothing matches. Try another word or fewer filters.
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              {groups.slice(0, cityLimit).map(({ trip, items }) => {
                const open = expanded.has(trip.id);
                const shown = open ? items : items.slice(0, ITEMS_SHOWN);
                const { floor, ceiling } = priceRange(trip);
                return (
                  <section key={trip.id} className="rounded-card border border-border bg-surface p-3">
                    <button
                      type="button"
                      onClick={() => setSheet({ trip, picked: [] })}
                      className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-left"
                    >
                      <span className="font-heading text-base font-semibold text-ink">
                        {trip.n} <span className="font-sans text-xs font-normal text-muted">· {trip.c}</span>
                      </span>
                      <span className="text-[11px] text-muted">
                        {items.length} {items.length === 1 ? "match" : "matches"} · trip{" "}
                        {formatMoney(floor, currency)}–{formatMoney(ceiling, currency)}
                      </span>
                    </button>
                    <ul className="mt-1 divide-y divide-border">
                      {shown.map((it) => (
                        <ActivityRow
                          key={it.id}
                          item={it}
                          currency={currency}
                          onAction={() => setSheet({ trip, picked: [it.id] })}
                        />
                      ))}
                    </ul>
                    {items.length > ITEMS_SHOWN && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((s) => {
                            const next = new Set(s);
                            if (open) next.delete(trip.id);
                            else next.add(trip.id);
                            return next;
                          })
                        }
                        className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        {open ? "Show fewer" : `Show all ${items.length} in ${trip.n}`}
                      </button>
                    )}
                  </section>
                );
              })}
              {groups.length > cityLimit && (
                <div className="text-center">
                  <button type="button" onClick={() => setCityLimit((n) => n + CITY_PAGE)} className="btn btn-secondary btn-sm">
                    Show more cities ({groups.length - cityLimit} left)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {sheet && (
        <TripDetailSheet
          key={`${sheet.trip.id}-${sheet.picked.join(",")}`}
          trip={sheet.trip}
          {...priceRange(sheet.trip)}
          initialPicked={sheet.picked}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
