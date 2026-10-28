"use client";
import Link from "next/link";
import type { GroupTrip } from "@/lib/social/groups";
import { weekendLabel } from "@/lib/social/friends";
import { useGroupData } from "./useGroupData";
import ProposalCards from "./ProposalCards";
export default function WeekendChatCard({ id }: { id: string }) {
  const {
    data: trip,
    refresh,
    error,
  } = useGroupData<GroupTrip>("get_group_trip", { p_trip: id });
  if (error)
    return (
      <p role="alert" className="text-danger">
        {error}
      </p>
    );
  if (!trip) return null;
  return (
    <aside className="my-4 space-y-3">
      <Link
        href={`/weekends/${id}`}
        className="block rounded-card bg-primary-soft p-4"
      >
        <span className="text-xs font-semibold uppercase tracking-wide">
          Pinned weekend
        </span>
        <h2 className="font-heading text-xl">{trip.title}</h2>
        <p className="text-sm">
          {weekendLabel(trip)} ·{" "}
          {trip.members.filter((m) => m.status === "going").length} Going
        </p>
        <p className="mt-2 text-sm font-bold">Open plan, lodging and RSVPs →</p>
      </Link>
      <ProposalCards trip={trip} onChange={refresh} openOnly />
    </aside>
  );
}
