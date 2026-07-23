"use client";

import { useMemo, useState } from "react";
import { useActivePlan, usePlanStore } from "@/lib/store/plan";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { makeCtx } from "@/lib/calc/context";
import { travelersFor } from "@/lib/calc/costs";
import { schengenDays, schengenStatus } from "@/lib/calc/schengen";
import TripTray from "@/components/calendar/TripTray";
import SlotCard from "@/components/calendar/SlotCard";
import MonthGrid from "@/components/calendar/MonthGrid";
import EditModal from "@/components/calendar/EditModal";
import SetupWizardModal from "@/components/onboarding/SetupWizardModal";

export default function CalendarPage() {
  const activePlan = useActivePlan();
  const { home, bag, placements } = activePlan;
  const slots = useMemo(() => getSlotsForPlan(activePlan), [activePlan]);
  const semesterYear = activePlan.semester ? Number(activePlan.semester.start.slice(0, 4)) : 2027;
  const addStop = usePlanStore((s) => s.addStop);
  const removeStop = usePlanStore((s) => s.removeStop);
  const clearAll = usePlanStore((s) => s.clearAll);
  const addSlot = usePlanStore((s) => s.addSlot);
  const renameSlot = usePlanStore((s) => s.renameSlot);
  const updateSlotDates = usePlanStore((s) => s.updateSlotDates);
  const updateSlotNote = usePlanStore((s) => s.updateSlotNote);
  const deleteSlot = usePlanStore((s) => s.deleteSlot);
  const studyingInEurope = usePlanStore((s) => s.defaultStudyingInEurope);

  const [view, setView] = useState<"weekend" | "month">("weekend");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editSlotsMode, setEditSlotsMode] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("2001-01-01");
  const [newSlotEnd, setNewSlotEnd] = useState("2001-01-02");

  // Phase 9 step 3: a plan with no home AND no semester has never been
  // configured at all (true for every brand-new anonymous visitor's default
  // plan) -- getSlotsForPlan() would otherwise silently fall back to the
  // hardcoded AAU Prague SLOTS list for it. Any plan that already has a home
  // set (Parker's included) or an explicit semester keeps working exactly
  // as before -- this only changes the true "never touched" case.
  const isUnconfigured = !home && !activePlan.semester;

  const handleArm = (tripId: string) => {
    setArmedId((cur) => {
      const next = cur === tripId ? null : tripId;
      if (next) setTrayOpen(false); // just armed something — collapse the tray on mobile so the slots are visible
      return next;
    });
  };

  const ctx = useMemo(() => makeCtx(home, bag), [home, bag]);

  const filledCount = Object.keys(placements).length;
  const schD = schengenDays(placements, home, ctx.tripOf);
  const schStatus = schengenStatus(schD);

  const activate = (slotId: string) => {
    if (armedId) {
      addStop(slotId, armedId);
      setArmedId(null);
    } else if (placements[slotId]?.stops.length) {
      setEditingSlotId(slotId);
    }
  };

  const dropTrip = (slotId: string, tripId: string) => {
    addStop(slotId, tripId);
    setArmedId(null);
  };

  const editingSlot = editingSlotId ? slots.find((s) => s.id === editingSlotId) : undefined;

  if (isUnconfigured) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-card border-2 border-dashed border-border p-14 text-center">
          <h2 className="font-heading text-xl font-semibold text-ink">Let&apos;s set up your trip first</h2>
          <p className="mt-2 text-sm text-muted">
            Pick your host city and semester dates so your calendar shows your own program&apos;s
            weekends — not anyone else&apos;s.
          </p>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover"
          >
            Set up now
          </button>
        </div>
        {wizardOpen && <SetupWizardModal onClose={() => setWizardOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="font-heading text-xl font-semibold text-ink">My Calendar</h2>
        <p className="mt-1 text-sm text-muted">
          Tap a trip in the tray then tap a slot, or drag it onto one. Drop several trips on one slot
          for multi-city stretches like spring break — travel routes automatically from{" "}
          {home || "your home city (choose one in the header)"}.
        </p>
      </div>

      {armedId && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary">
          <span>✓ {ctx.tripOf(armedId)?.n} armed — tap a slot to add it</span>
          <button
            type="button"
            onClick={() => setArmedId(null)}
            className="ml-auto rounded-md border border-primary/50 px-2.5 py-1 text-xs font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setTrayOpen((o) => !o)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink lg:hidden"
      >
        <span>🧳 {trayOpen ? "Hide trip list" : "Browse trips to add"}</span>
        <span className="text-muted">{trayOpen ? "▲" : "▼"}</span>
      </button>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className={`${trayOpen ? "block" : "hidden"} lg:block`}>
          <TripTray home={home} armedId={armedId} onArm={handleArm} onDragStart={() => {}} />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {(["weekend", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-xs font-semibold ${
                    view === v ? "bg-primary text-white" : "bg-surface text-muted"
                  }`}
                >
                  {v === "weekend" ? "Weekend list" : "Month calendar"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => filledCount && confirm("Clear all placed trips?") && clearAll()}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-danger/50 hover:text-danger"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setEditSlotsMode((m) => !m)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                editSlotsMode
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-muted hover:border-primary/50"
              }`}
            >
              {editSlotsMode ? "Done editing" : "✏️ Edit slots"}
            </button>
            <span className="text-xs text-muted">
              {filledCount ? `${filledCount} of ${slots.length} slots filled` : "all slots empty — tap or drag to begin"}
              {filledCount > 0 && studyingInEurope && (
                <>
                  {" · "}
                  <span
                    className={
                      schStatus === "red"
                        ? "font-bold text-danger"
                        : schStatus === "amber"
                          ? "font-semibold text-warning"
                          : ""
                    }
                  >
                    🛂 {schD}/90 Schengen days
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="mt-4">
            {view === "weekend" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    placement={placements[slot.id]}
                    ctx={ctx}
                    travelers={travelersFor(placements[slot.id], activePlan.defaultTravelers ?? 1)}
                    armed={!!armedId}
                    editMode={editSlotsMode}
                    onActivate={() => activate(slot.id)}
                    onDropTrip={(tripId) => dropTrip(slot.id, tripId)}
                    onEdit={() => setEditingSlotId(slot.id)}
                    onRemoveStop={(idx) => removeStop(slot.id, idx)}
                    onRename={(label) => renameSlot(slot.id, label)}
                    onUpdateDates={(start, end) => updateSlotDates(slot.id, start, end)}
                    onUpdateNote={(note) => updateSlotNote(slot.id, note)}
                    onDelete={() => deleteSlot(slot.id)}
                  />
                ))}
                {editSlotsMode && (
                  <div className="rounded-card border-2 border-dashed border-border bg-surface p-3.5">
                    {addingSlot ? (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={newSlotLabel}
                          onChange={(e) => setNewSlotLabel(e.target.value)}
                          placeholder="Slot label…"
                          className="w-full rounded-md border border-border bg-surface-muted px-2 py-1 text-sm text-ink placeholder:text-muted"
                        />
                        <div className="flex items-center gap-1.5 text-[11px] text-muted">
                          <input
                            type="date"
                            value={newSlotStart}
                            onChange={(e) => setNewSlotStart(e.target.value)}
                            className="rounded-md border border-border bg-surface-muted px-1.5 py-1 text-ink"
                          />
                          <span>–</span>
                          <input
                            type="date"
                            value={newSlotEnd}
                            onChange={(e) => setNewSlotEnd(e.target.value)}
                            className="rounded-md border border-border bg-surface-muted px-1.5 py-1 text-ink"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const s = newSlotStart.split("-").map(Number);
                              const e = newSlotEnd.split("-").map(Number);
                              addSlot(newSlotLabel || "Untitled", [s[1], s[2]], [e[1], e[2]], "weekend");
                              setNewSlotLabel("");
                              setAddingSlot(false);
                            }}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingSlot(false)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingSlot(true)}
                        className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border py-6 text-sm font-semibold text-muted hover:border-primary/50 hover:text-primary"
                      >
                        + Add slot
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <MonthGrid
                slots={slots}
                placements={placements}
                armed={!!armedId}
                onActivate={activate}
                onDropTrip={dropTrip}
              />
            )}
          </div>
        </div>
      </div>

      {editingSlot && (
        <EditModal slot={editingSlot} ctx={ctx} year={semesterYear} onClose={() => setEditingSlotId(null)} />
      )}
    </div>
  );
}
