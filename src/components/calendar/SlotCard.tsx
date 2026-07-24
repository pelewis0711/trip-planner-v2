"use client";

import { useState } from "react";
import type { Slot } from "@/data/slots";
import type { Placement } from "@/lib/calc/types";
import type { PlannerCtx } from "@/lib/calc/context";
import { slotCosts } from "@/lib/calc/costs";
import { slotWarnings } from "@/lib/calc/warnings";
import { usePlanStore } from "@/lib/store/plan";
import { formatMoney } from "@/lib/calc/currency";

const KIND_STYLE: Record<string, string> = {
  weekend: "border-border",
  special: "border-warning/50",
  break: "border-warning/50",
  post: "border-success/50",
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
  const currency = usePlanStore((s) => s.defaultCurrency);

  if (editMode) {
    return (
      <div className={`rounded-card border-2 border-dashed bg-surface-muted p-3.5 ${KIND_STYLE[slot.kind] ?? "border-border"}`}>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => onRename?.(label)}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm font-semibold text-ink"
          />
          <button
            type="button"
            onClick={() => {
              if (hasStops && !confirm(`"${slot.label}" has ${stops.length} trip(s) placed — delete it anyway?`)) return;
              onDelete?.();
            }}
            className="shrink-0 rounded-md bg-danger/10 px-2 py-1 text-xs font-bold text-danger hover:bg-danger/20"
            aria-label={`Delete ${slot.label}`}
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <input
            type="date"
            defaultValue={toDateValue(slot.s)}
            onChange={(e) => onUpdateDates?.(fromDateValue(e.target.value), slot.e)}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-ink"
          />
          <span>–</span>
          <input
            type="date"
            defaultValue={toDateValue(slot.e)}
            onChange={(e) => onUpdateDates?.(slot.s, fromDateValue(e.target.value))}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-ink"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onUpdateNote?.(note)}
          placeholder="Add a note (e.g. a reminder for yourself)…"
          className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-ink placeholder:text-muted"
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
      className={`rounded-card border-2 border-dashed p-3.5 transition-colors ${
        KIND_STYLE[slot.kind] ?? "border-border"
      } ${armed ? "cursor-pointer border-primary bg-primary-soft" : "bg-surface"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{slot.label}</div>
          <div className="text-[11px] text-muted">{slot.date}</div>
        </div>
        {costs && (
          <span className="shrink-0 text-right text-sm font-extrabold text-accent">
            {formatMoney(costs.total, currency)}
            {travelers > 1 && (
              <span className="block text-[10px] font-normal text-muted">
                {formatMoney(costs.total * travelers, currency)} · 👥{travelers}
              </span>
            )}
          </span>
        )}
      </div>
      {slot.note && <div className="mt-1 text-[10.5px] text-warning">📝 {slot.note}</div>}

      {hasStops ? (
        <div className="mt-2.5 space-y-1.5">
          {stops.map((st, i) => {
            const t = ctx.tripOf(st.tripId);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-xs font-medium text-ink">
                  {t?.n ?? "?"}{" "}
                  <span className="text-muted">
                    {st.nights === 0 ? "day" : `${st.nights}n`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveStop(i);
                  }}
                  className="shrink-0 rounded-md bg-danger/10 px-1.5 py-0.5 text-[11px] font-bold text-danger hover:bg-danger/20"
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
                  className={`text-[10.5px] leading-snug ${w.lv === "red" ? "text-danger" : "text-warning"}`}
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
            className="mt-1 w-full rounded-lg border border-border bg-surface py-1.5 text-[11.5px] font-semibold text-muted hover:border-primary/50 hover:text-primary"
          >
            Edit
          </button>
        </div>
      ) : (
        <div
          className={`mt-3 rounded-lg border border-dashed py-4 text-center text-[11.5px] font-medium ${
            armed ? "border-primary text-primary" : "border-border text-muted"
          }`}
        >
          {armed ? "Tap to add here" : "Drag a trip here, or arm one in the tray"}
        </div>
      )}
    </div>
  );
}
