"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { DEFAULT_SEMESTER, type SemesterConfig } from "@/lib/calc/semester";
import SemesterDatesForm from "@/components/SemesterDatesForm";

export default function SemesterPanel({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const setSemesterFor = usePlanStore((s) => s.setSemesterFor);
  const isCustom = !!plan.semester;
  const [form, setForm] = useState<SemesterConfig>(plan.semester ?? DEFAULT_SEMESTER);

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

      <SemesterDatesForm value={form} onChange={setForm} />

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
