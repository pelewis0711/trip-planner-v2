"use client";

// Phase 26 step 3: the activity browser. Replaces the old checkbox list and
// the Highlights/Balanced/Everything/None presets. Used once per stop in the
// slot editor (EditModal) and once in the catalog's trip detail sheet.
//
// Layout: a "Your plan" tray (picks, running total, must-do shortcut), then a
// collapsible list with search, quick filters, category chips and a sort.
// The search/filter logic lives in src/lib/activityBrowser.ts.
import { useMemo, useState } from "react";
import type { Trip } from "@/data/trips";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import { formatMoney } from "@/lib/calc/currency";
import { pickedActivities } from "@/lib/calc/activities";
import { mustDoIds } from "@/lib/activityMeta";
import { useActivityDescriptions } from "@/lib/activityDescriptions";
import {
  EMPTY_QUERY,
  browserItems,
  categoryCounts,
  isFiltering,
  queryItems,
  type BrowserQuery,
} from "@/lib/activityBrowser";
import { ActivityRow, QueryControls } from "./parts";

export default function ActivityBrowser({
  trip,
  picked,
  onToggle,
  onAddMany,
  currency,
  defaultOpen = true,
  range,
  current,
  currentLabel = "Current",
}: {
  trip: Trip;
  /** The stop's picked activity ids (old position-based picks are read too). */
  picked: readonly unknown[];
  onToggle: (id: string) => void;
  onAddMany: (ids: string[]) => void;
  currency: Currency;
  /** Start with the list open. A weekend with several cities starts closed. */
  defaultOpen?: boolean;
  range?: { floor: number; ceiling: number };
  /** Per-person total with the current picks. */
  current?: number;
  currentLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pickedList = useMemo(() => pickedActivities(trip, picked), [trip, picked]);
  const pickedIds = useMemo(() => new Set(pickedList.map((p) => p.id)), [pickedList]);
  const activityTotal = pickedList.reduce((s, p) => s + p.price, 0);
  const missingMustDos = mustDoIds(trip).filter((id) => !pickedIds.has(id));

  if (trip.a.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h5 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">🎟️ Your activities</h5>
        <span className="text-[11.5px] text-muted">
          {pickedList.length === 0
            ? "None picked yet"
            : `${pickedList.length} picked · ${formatMoney(activityTotal, currency)} per person`}
        </span>
      </div>

      {(range || current !== undefined) && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px]">
          {range && (
            <span>
              <span className="text-muted">Range </span>
              <span className="font-semibold text-ink">
                {formatMoney(range.floor, currency)}–{formatMoney(range.ceiling, currency)}
              </span>
            </span>
          )}
          {current !== undefined && (
            <span>
              <span className="text-muted">{currentLabel} </span>
              <span className="font-semibold text-accent">{formatMoney(current, currency)}</span>
            </span>
          )}
        </div>
      )}

      {pickedList.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pickedList.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-primary-soft px-2 py-1 text-xs">
              <span className={`min-w-0 flex-1 ${p.listed ? "text-ink" : "italic text-muted"}`}>
                {p.name}
                {!p.listed && " (no longer listed, not counted)"}
              </span>
              {p.listed && <span className="shrink-0 text-accent">{p.price ? formatMoney(p.price, currency) : "free"}</span>}
              <button
                type="button"
                onClick={() => onToggle(p.id)}
                className="shrink-0 px-1 text-muted hover:text-danger"
                aria-label={`Remove ${p.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {missingMustDos.length > 0 && (
          <button type="button" onClick={() => onAddMany(missingMustDos)} className="btn btn-secondary btn-sm">
            ⭐ Add all must-dos ({missingMustDos.length})
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-secondary btn-sm" aria-expanded={open}>
          {open ? "Hide list" : `Browse ${trip.a.length} activities`}
        </button>
      </div>

      {open && <BrowserList trip={trip} pickedIds={pickedIds} onToggle={onToggle} currency={currency} />}
    </div>
  );
}

// Split out so the descriptions only start loading once a list is opened.
function BrowserList({
  trip,
  pickedIds,
  onToggle,
  currency,
}: {
  trip: Trip;
  pickedIds: Set<string>;
  onToggle: (id: string) => void;
  currency: Currency;
}) {
  const descriptions = useActivityDescriptions();
  const [query, setQuery] = useState<BrowserQuery>(EMPTY_QUERY);
  const items = useMemo(() => browserItems(trip, descriptions), [trip, descriptions]);
  const cats = useMemo(() => categoryCounts(items), [items]);
  const results = useMemo(() => queryItems(items, query), [items, query]);
  const filtered = isFiltering(query);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <QueryControls
        query={query}
        setQuery={setQuery}
        categories={cats}
        currency={currency}
        placeholder={`Search ${trip.n} activities`}
      />

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          {results.length} of {items.length}
        </span>
        {filtered && (
          <button type="button" onClick={() => setQuery((s) => ({ ...EMPTY_QUERY, sort: s.sort }))} className="font-semibold text-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="mt-2 rounded-lg bg-surface-muted px-3 py-4 text-center text-xs text-muted">
          Nothing matches. Try fewer filters.
        </p>
      ) : (
        <ul className="mt-1.5 divide-y divide-border">
          {results.map((it) => (
            <ActivityRow
              key={it.id}
              item={it}
              currency={currency}
              done={pickedIds.has(it.id)}
              onAction={() => onToggle(it.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
