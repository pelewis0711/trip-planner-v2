"use client";

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

export default function SlotCard({
  slot,
  placement,
  ctx,
  travelers,
  armed,
  onActivate,
  onDropTrip,
  onEdit,
  onRemoveStop,
}: {
  slot: Slot;
  placement: Placement | undefined;
  ctx: PlannerCtx;
  travelers: number;
  armed: boolean;
  onActivate: () => void;
  onDropTrip: (tripId: string) => void;
  onEdit: () => void;
  onRemoveStop: (stopIndex: number) => void;
}) {
  const stops = placement?.stops ?? [];
  const hasStops = stops.length > 0;
  const costs = hasStops ? slotCosts(slot.id, stops, ctx, travelers) : null;
  const warnings = hasStops ? slotWarnings(slot, stops, costs!.legs, ctx.tripOf) : [];

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
      {slot.note && <div className="mt-1 text-[10.5px] text-amber-400/80">{slot.note}</div>}

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
