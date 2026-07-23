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
        <label className="flex flex-col gap-1 text-zinc-400">
          Start
          <input
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-zinc-400">
          End
          <input
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </label>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-semibold text-zinc-300">Breaks / special windows</span>
          <button
            type="button"
            onClick={() => addBreak()}
            className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-500"
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
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {value.breaks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 p-2">
              <input
                type="text"
                value={b.label}
                onChange={(e) => updateBreak(b.id, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
              <input
                type="date"
                value={b.start}
                onChange={(e) => updateBreak(b.id, { start: e.target.value })}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
              <input
                type="date"
                value={b.end}
                onChange={(e) => updateBreak(b.id, { end: e.target.value })}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
              <select
                value={b.kind}
                onChange={(e) => updateBreak(b.id, { kind: e.target.value as CustomBreak["kind"] })}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-100"
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
                className="shrink-0 rounded-md bg-rose-500/20 px-2 py-1 font-bold text-rose-300 hover:bg-rose-500/30"
              >
                ✕
              </button>
            </div>
          ))}
          {!value.breaks.length && <div className="text-zinc-600">No breaks added — just weekends.</div>}
        </div>
      </div>
    </div>
  );
}
