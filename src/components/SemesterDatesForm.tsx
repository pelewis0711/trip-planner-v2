"use client";

// Shared start/end + custom-breaks editor, extracted from what was
// SemesterPanel.tsx (Phase 2) so both the per-plan "customize semester"
// panel and Phase 6 onboarding's date-confirmation step use one editor
// instead of two. Fully controlled -- no internal state -- so callers
// decide what "save" means (setSemesterFor a plan vs. building an
// onboarding SemesterConfig).
import type { CustomBreak, SemesterConfig } from "@/lib/calc/semester";

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

const KIND_LABEL: Record<CustomBreak["kind"], string> = {
  special: "Midweek / special",
  break: "Multi-day break",
  post: "Post-finals",
};

export default function SemesterDatesForm({
  value,
  onChange,
}: {
  value: SemesterConfig;
  onChange: (next: SemesterConfig) => void;
}) {
  const updateBreak = (id: string, patch: Partial<CustomBreak>) =>
    onChange({ ...value, breaks: value.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const addBreak = (label = "New break", kind: CustomBreak["kind"] = "break") =>
    onChange({
      ...value,
      breaks: [...value.breaks, { id: uid(), label, start: value.start, end: value.start, kind }],
    });

  const removeBreak = (id: string) => onChange({ ...value, breaks: value.breaks.filter((b) => b.id !== id) });

  // One-tap common presets -- still lands as a plain, fully-editable break
  // (dates default to the term start, same as "+ Add break"), just saves
  // typing out a label you'd type anyway.
  const PRESETS: { label: string; emoji: string; kind: CustomBreak["kind"] }[] = [
    { label: "Spring break", emoji: "🌴", kind: "break" },
    { label: "Reading week", emoji: "📖", kind: "break" },
    { label: "Fall break", emoji: "🍂", kind: "break" },
  ];

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-muted">
          Start
          <input
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-muted">
          End
          <input
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-ink"
          />
        </label>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-semibold text-ink">Breaks / special windows</span>
          <button
            type="button"
            onClick={() => addBreak()}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-muted hover:border-primary/40"
          >
            ＋ Add break
          </button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addBreak(p.label, p.kind)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted hover:border-primary/50 hover:text-primary"
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {value.breaks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2">
              <input
                type="text"
                value={b.label}
                onChange={(e) => updateBreak(b.id, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              />
              <input
                type="date"
                value={b.start}
                onChange={(e) => updateBreak(b.id, { start: e.target.value })}
                className="rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              />
              <input
                type="date"
                value={b.end}
                onChange={(e) => updateBreak(b.id, { end: e.target.value })}
                className="rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              />
              <select
                value={b.kind}
                onChange={(e) => updateBreak(b.id, { kind: e.target.value as CustomBreak["kind"] })}
                className="rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              >
                {(Object.entries(KIND_LABEL) as [CustomBreak["kind"], string][]).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeBreak(b.id)}
                className="shrink-0 rounded-md bg-danger/10 px-2 py-1 font-bold text-danger hover:bg-danger/20"
              >
                ✕
              </button>
            </div>
          ))}
          {!value.breaks.length && <div className="text-muted">No breaks added — just weekends.</div>}
        </div>
      </div>
    </div>
  );
}
