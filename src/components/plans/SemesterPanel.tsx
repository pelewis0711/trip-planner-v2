"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore, slotsToBeLost } from "@/lib/store/plan";
import type { SemesterConfig } from "@/lib/calc/semester";
import { smartDefaultSemester } from "@/lib/calc/onboarding";
import SemesterDatesForm from "@/components/SemesterDatesForm";
import ProgramSearchPicker from "@/components/ProgramSearchPicker";

// Neutral, computed-from-today starting point (same helper onboarding uses)
// -- NOT a hardcoded date range, so this panel never surfaces one specific
// student's program as if it were everyone's default.
const BLANK_TEMPLATE = smartDefaultSemester("spring");

export default function SemesterPanel({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const regenerateSlotsFor = usePlanStore((s) => s.regenerateSlotsFor);
  const isCustom = !!plan.semester;
  const [form, setForm] = useState<SemesterConfig>(plan.semester ?? BLANK_TEMPLATE);
  const [pickerKey, setPickerKey] = useState(0);

  // "warn me first instead of silently deleting" -- named here, confirmed
  // before regenerateSlotsFor actually touches anything. Custom (hand-added)
  // slots are never affected, so they're never part of this check.
  function applyIfConfirmed(semester: SemesterConfig) {
    const lost = slotsToBeLost(plan, semester);
    if (lost.length) {
      const names = lost.map((s) => `${s.label} (${s.date})`).join(", ");
      if (!confirm(`These slots have trips placed and would be removed: ${names}. Continue anyway?`)) {
        return;
      }
    }
    regenerateSlotsFor(plan.id, semester);
    onClose();
  }

  const handleSave = () => {
    if (form.start >= form.end) {
      alert("Semester end date must be after the start date.");
      return;
    }
    applyIfConfirmed(form);
  };

  const handleReset = () => applyIfConfirmed(BLANK_TEMPLATE);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-muted p-3 text-[12px]">
      <div className="flex items-center justify-between">
        <b className="text-ink">Semester dates{isCustom ? "" : " (using a blank template — set your own below)"}</b>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink">
          ✕
        </button>
      </div>

      <p className="text-muted">
        For a friend at a different school — sets which weekends this plan uses. If you&apos;ve already
        placed trips, changing dates can shift which weekend they land on; anything that would be
        removed entirely gets called out before saving.
      </p>

      <ProgramSearchPicker key={pickerKey} onApply={(sem) => setForm(sem)} />

      <SemesterDatesForm
        value={form}
        onChange={(next) => {
          setPickerKey((k) => k + 1);
          setForm(next);
        }}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={handleSave} className="btn btn-primary btn-sm">
          Save semester
        </button>
        <button type="button" onClick={handleReset} className="btn btn-secondary btn-sm">
          Reset to blank template
        </button>
      </div>
    </div>
  );
}
