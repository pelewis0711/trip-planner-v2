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

  const [view, setView] = useState<"weekend" | "month">("weekend");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

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
        <div className="rounded-2xl border border-dashed border-zinc-800 p-14 text-center">
          <h2 className="text-xl font-semibold text-zinc-50">Let&apos;s set up your trip first</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Pick your host city and semester dates so your calendar shows your own program&apos;s
            weekends — not anyone else&apos;s.
          </p>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950"
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-xl font-semibold text-zinc-50">My Calendar</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Tap a trip in the tray then tap a slot, or drag it onto one. Drop several trips on one slot
          for multi-city stretches like spring break — travel routes automatically from{" "}
          {home || "your home city (choose one in the header)"}.
        </p>
      </div>

      {armedId && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
          <span>✓ {ctx.tripOf(armedId)?.n} armed — tap a slot to add it</span>
          <button
            type="button"
            onClick={() => setArmedId(null)}
            className="ml-auto rounded-md border border-emerald-500/60 px-2.5 py-1 text-xs font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setTrayOpen((o) => !o)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 lg:hidden"
      >
        <span>🧳 {trayOpen ? "Hide trip list" : "Browse trips to add"}</span>
        <span className="text-zinc-500">{trayOpen ? "▲" : "▼"}</span>
      </button>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className={`${trayOpen ? "block" : "hidden"} lg:block`}>
          <TripTray home={home} armedId={armedId} onArm={handleArm} onDragStart={() => {}} />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-800">
              {(["weekend", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-xs font-semibold ${
                    view === v ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {v === "weekend" ? "Weekend list" : "Month calendar"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => filledCount && confirm("Clear all placed trips?") && clearAll()}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-rose-500/50 hover:text-rose-300"
            >
              Clear all
            </button>
            <span className="text-xs text-zinc-500">
              {filledCount ? `${filledCount} of ${slots.length} slots filled` : "all slots empty — tap or drag to begin"}
              {filledCount > 0 && (
                <>
                  {" · "}
                  <span
                    className={
                      schStatus === "red"
                        ? "font-bold text-rose-400"
                        : schStatus === "amber"
                          ? "font-semibold text-amber-400"
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
                    onActivate={() => activate(slot.id)}
                    onDropTrip={(tripId) => dropTrip(slot.id, tripId)}
                    onEdit={() => setEditingSlotId(slot.id)}
                    onRemoveStop={(idx) => removeStop(slot.id, idx)}
                  />
                ))}
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
