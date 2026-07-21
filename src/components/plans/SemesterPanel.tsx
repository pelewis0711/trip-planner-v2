"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { DEFAULT_SEMESTER, type CustomBreak, type SemesterConfig } from "@/lib/calc/semester";

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

const KIND_LABEL: Record<CustomBreak["kind"], string> = {
  special: "Midweek / special",
  break: "Multi-day break",
  post: "Post-finals",
};

export default function SemesterPanel({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const setSemesterFor = usePlanStore((s) => s.setSemesterFor);
  const isCustom = !!plan.semester;
  const [form, setForm] = useState<SemesterConfig>(plan.semester ?? DEFAULT_SEMESTER);

  const updateBreak = (id: string, patch: Partial<CustomBreak>) =>
    setForm((f) => ({ ...f, breaks: f.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));

  const addBreak = () =>
    setForm((f) => ({
      ...f,
      breaks: [...f.breaks, { id: uid(), label: "New break", start: f.start, end: f.start, kind: "break" }],
    }));

  const removeBreak = (id: string) => setForm((f) => ({ ...f, breaks: f.breaks.filter((b) => b.id !== id) }));

  const handleSave = () => {
    if (form.start >= form.end) {
      alert("Semester end date must be after the start date.");
      return;
    }
    setSemesterFor(plan.id, form);
    onClose();
  };

  const handleReset = () => {
    setSemesterFor(plan.id, undefined);
    onClose();
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px]">
      <div className="flex items-center justify-between">
        <b className="text-zinc-200">Semester dates{isCustom ? "" : " (default: AAU Spring 2027)"}</b>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          ✕
        </button>
      </div>

      <p className="text-zinc-500">
        For a friend at a different school — sets which weekends this plan uses. If you&apos;ve already
        placed trips, changing dates can shift which weekend they land on; nothing gets deleted, just
        double-check the calendar after saving.
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-zinc-400">
          Start
          <input
            type="date"
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-zinc-400">
          End
          <input
            type="date"
            value={form.end}
            onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </label>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-semibold text-zinc-300">Custom breaks</span>
          <button
            type="button"
            onClick={addBreak}
            className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-500"
          >
            ＋ Add break
          </button>
        </div>
        <div className="space-y-2">
          {form.breaks.map((b) => (
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
          {!form.breaks.length && <div className="text-zinc-600">No breaks added — just weekends.</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-zinc-950"
        >
          Save semester
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] font-semibold text-zinc-300 hover:border-zinc-500"
          >
            Reset to AAU Spring 2027
          </button>
        )}
      </div>
    </div>
  );
}
