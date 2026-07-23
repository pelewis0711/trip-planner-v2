"use client";

import type { Slot } from "@/data/slots";
import type { Placements } from "@/lib/calc/types";

const MONTH_NAMES: Record<number, string> = {
  1: "January 2027", 2: "February 2027", 3: "March 2027", 4: "April 2027", 5: "May 2027",
};
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function slotForDate(slots: Slot[], m: number, d: number): Slot | undefined {
  const date = new Date(2027, m - 1, d);
  return slots.find((s) => {
    const start = new Date(2027, s.s[0] - 1, s.s[1]);
    const end = new Date(2027, s.e[0] - 1, s.e[1]);
    return date >= start && date <= end;
  });
}

export default function MonthGrid({
  slots,
  placements,
  armed,
  onActivate,
  onDropTrip,
}: {
  slots: Slot[];
  placements: Placements;
  armed: boolean;
  onActivate: (slotId: string) => void;
  onDropTrip: (slotId: string, tripId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5].map((m) => {
        const daysInMonth = new Date(2027, m, 0).getDate();
        const firstDow = (new Date(2027, m - 1, 1).getDay() + 6) % 7; // Mon=0
        const cells: (number | null)[] = [
          ...Array(firstDow).fill(null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];

        return (
          <div key={m} className="rounded-card border border-border bg-surface p-3.5">
            <h3 className="text-center font-heading text-sm font-semibold text-ink">{MONTH_NAMES[m]}</h3>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {DOW.map((d) => (
                <div key={d} className="pb-1 text-center text-[9.5px] font-bold text-muted">
                  {d}
                </div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const slot = slotForDate(slots, m, d);
                const filled = slot ? (placements[slot.id]?.stops.length ?? 0) > 0 : false;
                return (
                  <div
                    key={i}
                    onDragOver={slot ? (e) => e.preventDefault() : undefined}
                    onDrop={
                      slot
                        ? (e) => {
                            e.preventDefault();
                            const tripId = e.dataTransfer.getData("text/trip-id");
                            if (tripId) onDropTrip(slot.id, tripId);
                          }
                        : undefined
                    }
                    onClick={slot ? () => onActivate(slot.id) : undefined}
                    title={slot ? `${slot.label} — ${slot.date}` : undefined}
                    className={`flex aspect-square items-center justify-center rounded-md text-[10.5px] ${
                      slot
                        ? filled
                          ? "cursor-pointer bg-primary font-bold text-white"
                          : armed
                            ? "cursor-pointer border border-dashed border-primary text-primary"
                            : "cursor-pointer border border-dashed border-border text-ink hover:border-primary/50"
                        : "bg-surface-muted/60 text-muted"
                    }`}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
