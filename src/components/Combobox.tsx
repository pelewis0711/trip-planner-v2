"use client";

// A styled, searchable dropdown replacing native <select> in places where
// the browser's own unstylable options popup would look jarringly out of
// place next to the rest of the app (Header's Home/Plan pickers -- see
// CLAUDE.md Phase 20 follow-up). Search-as-you-type matters here in
// particular for Home, which has 145+ cities -- scrolling a native list
// that long is a real usability cost a search box removes.
import { useEffect, useMemo, useRef, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

export default function Combobox({
  icon,
  label,
  value,
  options,
  onChange,
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  specialOption,
  className = "",
  panelWidth = "16rem",
}: {
  icon?: string;
  label: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  // an extra, non-searchable row pinned to the bottom (e.g. "Other city…")
  // that runs its own action instead of calling onChange
  specialOption?: { label: string; onSelect: () => void };
  className?: string;
  panelWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focusing the search input is a real side effect (imperative DOM
  // action, not derived state) -- fine inside an effect. Resetting
  // query/highlighted happens at the click handler that opens the panel
  // instead, since calling setState synchronously inside an effect body
  // just to reset local state causes an avoidable extra render.
  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setQuery("");
        setHighlighted(0);
      }
      return next;
    });
  }

  function commit(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1 + (specialOption ? 1 : 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (specialOption && highlighted === filtered.length) {
        specialOption.onSelect();
        setOpen(false);
      } else if (filtered[highlighted]) {
        commit(filtered[highlighted]);
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="pill-select-trigger"
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span className="text-muted">{label}</span>
        <span className="max-w-[140px] truncate font-bold text-ink">{selected?.label ?? placeholder}</span>
        <span aria-hidden className="text-muted">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{ width: panelWidth }}
          className="combobox-panel"
          onKeyDown={onKeyDown}
        >
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            placeholder={searchPlaceholder}
            className="combobox-search"
          />
          <div className="combobox-options">
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted">No matches</div>}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => commit(o)}
                onMouseEnter={() => setHighlighted(i)}
                className={`combobox-option ${i === highlighted ? "combobox-option-active" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <span aria-hidden>✓</span>}
              </button>
            ))}
            {specialOption && (
              <button
                type="button"
                onClick={() => {
                  specialOption.onSelect();
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlighted(filtered.length)}
                className={`combobox-option border-t border-border ${
                  highlighted === filtered.length ? "combobox-option-active" : ""
                }`}
              >
                {specialOption.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
