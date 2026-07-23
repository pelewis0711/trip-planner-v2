"use client";

import { useState } from "react";
import type { Slot } from "@/data/slots";
import type { Placement } from "@/lib/calc/types";
import type { PlannerCtx } from "@/lib/calc/context";
import { slotCosts } from "@/lib/calc/costs";
import { slotWarnings } from "@/lib/calc/warnings";

const KIND_STYLE: Record<string, string> = {
  weekend: "border-zinc-800",
  special: "border-amber-500/60",
  break: "border-amber-500/60",
  post: "border-emerald-500/60",
};

// a fixed, non-leap placeholder year -- Slot dates are month/day only (no
// year), so <input type="date"> just needs *some* real calendar year to
// render a picker; the year is discarded the moment a date is picked.
const PICKER_YEAR = 2001;
const toDateValue = (md: [number, number]) => `${PICKER_YEAR}-${String(md[0]).padStart(2, "0")}-${String(md[1]).padStart(2, "0")}`;
const fromDateValue = (v: string): [number, number] => {
  const [, m, d] = v.split("-").map(Number);
  return [m, d];
};

export default function SlotCard({
  slot,
  placement,
  ctx,
  travelers,
  armed,
  editMode,
  onActivate,
  onDropTrip,
  onEdit,
  onRemoveStop,
  onRename,
  onUpdateDates,
  onUpdateNote,
  onDelete,
}: {
  slot: Slot;
  placement: Placement | undefined;
  ctx: PlannerCtx;
  travelers: number;
  armed: boolean;
  editMode?: boolean;
  onActivate: () => void;
  onDropTrip: (tripId: string) => void;
  onEdit: () => void;
  onRemoveStop: (stopIndex: number) => void;
  onRename?: (label: string) => void;
  onUpdateDates?: (start: [number, number], end: [number, number]) => void;
  onUpdateNote?: (note: string) => void;
  onDelete?: () => void;
}) {
  const stops = placement?.stops ?? [];
  const hasStops = stops.length > 0;
  const costs = hasStops ? slotCosts(slot.id, stops, ctx, travelers) : null;
  const warnings = hasStops ? slotWarnings(slot, stops, costs!.legs, ctx.tripOf) : [];

  const [label, setLabel] = useState(slot.label);
  const [note, setNote] = useState(slot.note ?? "");

  if (editMode) {
    return (
      <div className={`rounded-xl border-2 border-dashed p-3.5 bg-zinc-900/40 ${KIND_STYLE[slot.kind] ?? "border-zinc-800"}`}>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => onRename?.(label)}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              if (hasStops && !confirm(`"${slot.label}" has ${stops.length} trip(s) placed — delete it anyway?`)) return;
              onDelete?.();
            }}
            className="shrink-0 rounded-md bg-rose-500/20 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
            aria-label={`Delete ${slot.label}`}
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <input
            type="date"
            defaultValue={toDateValue(slot.s)}
            onChange={(e) => onUpdateDates?.(fromDateValue(e.target.value), slot.e)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-100"
          />
          <span>–</span>
          <input
            type="date"
            defaultValue={toDateValue(slot.e)}
            onChange={(e) => onUpdateDates?.(slot.s, fromDateValue(e.target.value))}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-100"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onUpdateNote?.(note)}
          placeholder="Add a note (e.g. a reminder for yourself)…"
          className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600"
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const tripId = e.dataTransfer.getData("text/trip-id");
        if (tripId) onDropTrip(tripId);
      }}
      onClick={armed ? onActivate : undefined}
      className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
        KIND_STYLE[slot.kind] ?? "border-zinc-800"
      } ${armed ? "cursor-pointer border-emerald-500 bg-emerald-500/5" : "bg-zinc-900/40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{slot.label}</div>
          <div className="text-[11px] text-zinc-500">{slot.date}</div>
        </div>
        {costs && (
          <span className="shrink-0 text-right text-sm font-extrabold text-emerald-400">
            ${Math.round(costs.total)}
            {travelers > 1 && (
              <span className="block text-[10px] font-normal text-zinc-500">
                ${Math.round(costs.total * travelers)} · 👥{travelers}
              </span>
            )}
          </span>
        )}
      </div>
      {slot.note && <div className="mt-1 text-[10.5px] text-amber-400/80">📝 {slot.note}</div>}

      {hasStops ? (
        <div className="mt-2.5 space-y-1.5">
          {stops.map((st, i) => {
            const t = ctx.tripOf(st.tripId);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-xs font-medium text-zinc-100">
                  {t?.n ?? "?"}{" "}
                  <span className="text-zinc-500">
                    {st.nights === 0 ? "day" : `${st.nights}n`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveStop(i);
                  }}
                  className="shrink-0 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/30"
                  aria-label={`Remove ${t?.n}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {warnings.length > 0 && (
            <div className="space-y-0.5 pt-0.5">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={`text-[10.5px] leading-snug ${w.lv === "red" ? "text-rose-400" : "text-amber-400"}`}
                >
                  {w.lv === "red" ? "⚠" : "◔"} {w.msg}
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 text-[11.5px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-zinc-100"
          >
            Edit
          </button>
        </div>
      ) : (
        <div
          className={`mt-3 rounded-lg border border-dashed py-4 text-center text-[11.5px] font-medium ${
            armed ? "border-emerald-500/60 text-emerald-400" : "border-zinc-800 text-zinc-600"
          }`}
        >
          {armed ? "Tap to add here" : "Drag a trip here, or arm one in the tray"}
        </div>
      )}
    </div>
  );
}
