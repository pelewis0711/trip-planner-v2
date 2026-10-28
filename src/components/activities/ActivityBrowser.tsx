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
import { ACTIVITY_CATEGORIES, ACTIVITY_DURATIONS, mustDoIds, type ActivityCategory } from "@/lib/activityMeta";
import { useActivityDescriptions } from "@/lib/activityDescriptions";
import {
  EMPTY_QUERY,
  QUICK_FILTERS,
  UNDER_PRICE,
  browserItems,
  categoryCounts,
  queryItems,
  type ActivitySort,
  type BrowserItem,
  type BrowserQuery,
  type QuickFilter,
} from "@/lib/activityBrowser";

const SORT_LABEL: Record<ActivitySort, string> = {
  must: "Must-dos first",
  price: "Price: low to high",
  length: "Shortest first",
};

function quickLabel(q: QuickFilter, currency: Currency): string {
  switch (q) {
    case "must": return "⭐ Must-do";
    case "book": return "📅 Book ahead";
    case "free": return "Free";
    case "under25": return `Under ${formatMoney(UNDER_PRICE, currency)}`;
    case "evening": return "🌙 Evening";
    case "short": return "Under 2 h";
    case "half": return "Half day";
    case "full": return "Full day";
  }
}

const CATEGORY = new Map(ACTIVITY_CATEGORIES.map((c) => [c.key, c] as const));
const DURATION = new Map(ACTIVITY_DURATIONS.map((d) => [d.key, d.label] as const));

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
  const filtered = query.text.trim() !== "" || query.quick.length > 0 || query.categories.length > 0;

  const toggleQuick = (q: QuickFilter) =>
    setQuery((s) => ({ ...s, quick: s.quick.includes(q) ? s.quick.filter((x) => x !== q) : [...s.quick, q] }));
  const toggleCat = (c: ActivityCategory) =>
    setQuery((s) => ({
      ...s,
      categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c],
    }));

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query.text}
          onChange={(e) => setQuery((s) => ({ ...s, text: e.target.value }))}
          placeholder={`Search ${trip.n} activities`}
          aria-label={`Search ${trip.n} activities`}
          className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <select
          value={query.sort}
          onChange={(e) => setQuery((s) => ({ ...s, sort: e.target.value as ActivitySort }))}
          aria-label="Sort activities"
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
        >
          {(Object.keys(SORT_LABEL) as ActivitySort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((q) => (
          <Chip key={q} on={query.quick.includes(q)} onClick={() => toggleQuick(q)}>
            {quickLabel(q, currency)}
          </Chip>
        ))}
      </div>

      {cats.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <Chip key={c.key} on={query.categories.includes(c.key)} onClick={() => toggleCat(c.key)}>
              {c.emoji} {c.label} <span className="opacity-60">{c.count}</span>
            </Chip>
          ))}
        </div>
      )}

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
            <Row key={it.id} item={it} added={pickedIds.has(it.id)} onToggle={onToggle} currency={currency} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        on ? "border-primary bg-primary text-white" : "border-border text-muted hover:border-primary/50 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  item,
  added,
  onToggle,
  currency,
}: {
  item: BrowserItem;
  added: boolean;
  onToggle: (id: string) => void;
  currency: Currency;
}) {
  const m = item.meta;
  const cat = m ? CATEGORY.get(m.category) : undefined;
  return (
    <li className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink">{item.name}</span>
          {m?.mustDo && <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-bold text-accent">Must-do</span>}
          {m?.bookAhead && <span className="rounded-full bg-primary-soft px-1.5 py-px text-[10px] font-bold text-primary">Book ahead</span>}
        </div>
        {m && (
          <div className="mt-0.5 text-[10.5px] text-muted">
            {cat ? `${cat.emoji} ${cat.label}` : ""} · {DURATION.get(m.duration)}
            {m.when === "night" ? " · Evening" : m.when === "day" ? " · Daytime" : ""}
          </div>
        )}
        {item.description && <p className="mt-0.5 text-[11px] text-muted">{item.description}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-semibold text-accent">{item.price ? formatMoney(item.price, currency) : "Free"}</span>
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-pressed={added}
          className={`btn btn-sm ${added ? "btn-primary" : "btn-secondary"}`}
        >
          {added ? "✓ Added" : "+ Add"}
        </button>
      </div>
    </li>
  );
}
