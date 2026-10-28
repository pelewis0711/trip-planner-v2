"use client";
import { useState } from "react";
import { TRIPS } from "@/data/trips";
import type { GroupTrip, TripChange } from "@/lib/social/groups";
import { voteTimeLeft } from "@/lib/social/groups";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { useAuthStore } from "@/lib/store/auth";
import { useNow } from "./useNow";
import { groupsChanged } from "./useGroupData";
import { cardClass } from "@/components/social/controls";
function ChangeDescription({ change }: { change: TripChange }) {
  return (
    <ul className="list-inside list-disc text-sm">
      {change.start_date && (
        <li>
          Dates: {change.start_date} to {change.end_date}
        </li>
      )}
      {change.stops && (
        <li>
          Stops:{" "}
          {change.stops.length
            ? change.stops
                .map(
                  (s) =>
                    `${TRIPS.find((t) => t.id === s.tripId)?.n ?? s.tripId} (${s.nights} nights)`,
                )
                .join(" → ")
            : "No destinations yet"}
        </li>
      )}
      {change.max_per_room && (
        <li>Up to {change.max_per_room} people per room</li>
      )}
      {change.couples_share_bed !== undefined && (
        <li>Couples share a bed: {change.couples_share_bed ? "yes" : "no"}</li>
      )}
      {change.mixed_rooms !== undefined && (
        <li>Mixed-gender rooms: {change.mixed_rooms ? "OK" : "no"}</li>
      )}
    </ul>
  );
}
export default function ProposalCards({
  trip,
  onChange,
  openOnly = false,
}: {
  trip: GroupTrip;
  onChange: () => void;
  openOnly?: boolean;
}) {
  const now = useNow();
  const userId = useAuthStore((s) => s.user?.id);
  const going = trip.members.filter((m) => m.status === "going").length;
  const canVote = trip.members.some(
    (m) => m.user_id === userId && m.status === "going",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function vote(id: string, approve: boolean) {
    setBusy(true);
    setError("");
    try {
      await groupRpc(createClient(), "vote_trip_proposal", {
        p_proposal: id,
        p_approve: approve,
      });
      groupsChanged();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3" aria-label="Suggested edits">
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {trip.proposals
        .filter((p) => !openOnly || p.status === "open")
        .map((p) => (
          <article key={p.id} className={`${cardClass} space-y-3`}>
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-bold">Suggested edit · {p.status}</h3>
              <span className="text-sm text-muted">
                {p.status === "open" ? voteTimeLeft(p.closes_at, now) : ""}
              </span>
            </div>
            <ChangeDescription change={p.change} />
            <p className="text-xs text-muted">
              More than half of the {going} people Going must approve.
            </p>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-primary-soft"
              role="img"
              aria-label={`${p.approvals} approve, ${p.rejections} reject`}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${going ? (100 * p.approvals) / going : 0}%` }}
              />
              <div
                className="h-full bg-danger"
                style={{ width: `${going ? (100 * p.rejections) / going : 0}%` }}
              />
            </div>
            <p className="text-sm">
              {p.approvals} approve · {p.rejections} reject
            </p>
            {p.status === "open" && (
              <div className="flex gap-2">
                <button
                  disabled={
                    busy || !canVote || new Date(p.closes_at).getTime() <= now
                  }
                  aria-pressed={p.my_vote === true}
                  className={`btn btn-md ${p.my_vote === true ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void vote(p.id, true)}
                >
                  Approve
                </button>
                <button
                  disabled={
                    busy || !canVote || new Date(p.closes_at).getTime() <= now
                  }
                  aria-pressed={p.my_vote === false}
                  className={`btn btn-md ${p.my_vote === false ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void vote(p.id, false)}
                >
                  Reject
                </button>
              </div>
            )}
          </article>
        ))}
    </section>
  );
}
