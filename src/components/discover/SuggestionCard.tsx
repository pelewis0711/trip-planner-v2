"use client";

import type { Trip } from "@/data/trips";

const MO_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

export default function SuggestionCard({
  trip,
  approved,
  onApprove,
  onReject,
}: {
  trip: Trip;
  approved: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 ${
        approved ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-zinc-50">{trip.n}</div>
          <div className="text-xs text-zinc-500">
            {trip.c === trip.reg ? trip.c : `${trip.c} · ${trip.reg}`}
          </div>
        </div>
        {approved && (
          <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
            ADDED
          </span>
        )}
      </div>

      <p className="mt-2 flex-1 text-[12.5px] text-zinc-400">{trip.w}</p>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-zinc-500">
        <span>{trip.g === 0 ? "Day trip" : `${trip.g} night${trip.g > 1 ? "s" : ""}`}</span>
        <span>· {trip.m.map((m) => MO_SHORT[m]).join("/")}</span>
        <span>· cost tier {trip.ci}/5</span>
      </div>

      <div className="mt-2 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
        <div>🎟️ {trip.a.map(([n]) => n).join(", ")}</div>
        <div className="mt-0.5">🍜 {trip.f.map(([n]) => n).join(", ")}</div>
      </div>

      {!approved && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-zinc-950"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:border-rose-500/50 hover:text-rose-300"
          >
            ✕ Reject
          </button>
        </div>
      )}
    </div>
  );
}
