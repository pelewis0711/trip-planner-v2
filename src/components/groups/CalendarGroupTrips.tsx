"use client";
import Link from "next/link";
import { useActivePlan } from "@/lib/store/plan";
import { tripConflicts, type TripSummary } from "@/lib/social/groups";
import { weekendLabel } from "@/lib/social/friends";
import { useGroupData } from "./useGroupData";
export default function CalendarGroupTrips() {
  const plan = useActivePlan();
  const { data, error } = useGroupData<TripSummary[]>("list_group_trips");
  const going = data?.filter((t) => t.my_status === "going") ?? [];
  if (error)
    return (
      <p className="text-sm text-muted">
        Group weekends could not load.{" "}
        <Link className="underline" href="/groups">
          Open groups to retry.
        </Link>
      </p>
    );
  if (!going.length) return null;
  return (
    <section className="my-4 rounded-card border border-border bg-surface p-4">
      <h2 className="font-heading text-xl">
        Group weekends you&apos;re Going on
      </h2>
      <div className="mt-3 space-y-2">
        {going.map((t) => {
          const conflicts = tripConflicts(plan, t);
          return (
            <article
              key={t.id}
              className={
                conflicts.length
                  ? "rounded-xl border border-warning bg-warning/10 p-3"
                  : "py-2"
              }
            >
              <Link
                href={`/weekends/${t.id}`}
                className="inline-flex min-h-11 items-center font-bold underline"
              >
                {t.title} · {weekendLabel(t)}
              </Link>
              {!!conflicts.length && (
                <p className="text-sm">
                  Overlaps {conflicts.map((s) => s.label).join(", ")}. You can
                  still go; this warning never changes your personal plan.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
