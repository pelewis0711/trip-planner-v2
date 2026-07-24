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
      className={`flex flex-col rounded-card border p-4 ${
        approved ? "border-success bg-success/10" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-ink">{trip.n}</div>
          <div className="text-xs text-muted">
            {trip.c === trip.reg ? trip.c : `${trip.c} · ${trip.reg}`}
          </div>
        </div>
        {approved && (
          <span className="shrink-0 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">
            ADDED
          </span>
        )}
      </div>

      <p className="mt-2 flex-1 text-[12.5px] text-muted">{trip.w}</p>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-muted">
        <span>{trip.g === 0 ? "Day trip" : `${trip.g} night${trip.g > 1 ? "s" : ""}`}</span>
        <span>· {trip.m.map((m) => MO_SHORT[m]).join("/")}</span>
        <span>· cost tier {trip.ci}/5</span>
      </div>

      <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted">
        <div>🎟️ {trip.a.map(([n]) => n).join(", ")}</div>
        <div className="mt-0.5">🍜 {trip.f.map(([n]) => n).join(", ")}</div>
      </div>

      {!approved && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-md bg-success px-2.5 py-1.5 text-xs font-bold text-white"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-danger/50 hover:text-danger"
          >
            ✕ Reject
          </button>
        </div>
      )}
    </div>
  );
}
