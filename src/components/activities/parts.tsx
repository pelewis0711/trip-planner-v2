"use client";

// Pieces shared by the per-city activity browser (ActivityBrowser.tsx) and
// the cross-city search in Catalog (ActivitySearch.tsx): the search box +
// sort + filter chips, and one activity row.
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Currency } from "@/components/onboarding/OnboardingFlow";
import { formatMoney } from "@/lib/calc/currency";
import { ACTIVITY_CATEGORIES, ACTIVITY_DURATIONS, type ActivityCategory } from "@/lib/activityMeta";
import {
  QUICK_FILTERS,
  UNDER_PRICE,
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

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        on ? "border-primary bg-primary text-white" : "border-border text-muted hover:border-primary/50 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** Search box, sort, quick chips and (when given) category chips. */
export function QueryControls({
  query,
  setQuery,
  categories,
  currency,
  placeholder,
  hideSearch = false,
}: {
  query: BrowserQuery;
  setQuery: Dispatch<SetStateAction<BrowserQuery>>;
  /** Category chips to offer; counts are optional. Fewer than 2 hides the row. */
  categories: { key: ActivityCategory; label: string; emoji: string; count?: number }[];
  currency: Currency;
  placeholder: string;
  /** Catalog has its own search box above; only the sort shows here. */
  hideSearch?: boolean;
}) {
  const toggleQuick = (q: QuickFilter) =>
    setQuery((s) => ({ ...s, quick: s.quick.includes(q) ? s.quick.filter((x) => x !== q) : [...s.quick, q] }));
  const toggleCat = (c: ActivityCategory) =>
    setQuery((s) => ({
      ...s,
      categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c],
    }));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!hideSearch && (
          <input
            type="search"
            value={query.text}
            onChange={(e) => setQuery((s) => ({ ...s, text: e.target.value }))}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
        )}
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

      {categories.length > 1 && (
        // One swipeable row on phones; wraps on wider screens.
        <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {categories.map((c) => (
            <Chip key={c.key} on={query.categories.includes(c.key)} onClick={() => toggleCat(c.key)}>
              {c.emoji} {c.label}
              {c.count !== undefined && <span className="opacity-60"> {c.count}</span>}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}

/** One activity: name, badges, category · length · time, description,
 * price and an action button. `done` shows the button as "✓ Added". */
export function ActivityRow({
  item,
  currency,
  done = false,
  onAction,
  actionLabel = "+ Add",
}: {
  item: BrowserItem;
  currency: Currency;
  done?: boolean;
  onAction: () => void;
  actionLabel?: string;
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
          onClick={onAction}
          aria-pressed={done}
          className={`btn btn-sm ${done ? "btn-primary" : "btn-secondary"}`}
        >
          {done ? "✓ Added" : actionLabel}
        </button>
      </div>
    </li>
  );
}
