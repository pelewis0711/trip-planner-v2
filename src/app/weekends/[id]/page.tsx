"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TRIPS } from "@/data/trips";
import { useAuthStore } from "@/lib/store/auth";
import { useActivePlan } from "@/lib/store/plan";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import {
  tripConflicts,
  voteTimeLeft,
  type GroupTrip,
  type Rsvp,
} from "@/lib/social/groups";
import { weekendLabel } from "@/lib/social/friends";
import { useGroupData, groupsChanged } from "@/components/groups/useGroupData";
import { useNow } from "@/components/groups/useNow";
import TripEditForm from "@/components/groups/TripEditForm";
import ProposalCards from "@/components/groups/ProposalCards";
import WeekendLodging from "@/components/groups/WeekendLodging";
import Avatar from "@/components/social/Avatar";
import { cardClass } from "@/components/social/controls";
export default function WeekendPage() {
  const { id } = useParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  return <Weekend key={`${id}:${userId}`} id={id} />;
}
function Weekend({ id }: { id: string }) {
  const router = useRouter();
  const now = useNow();
  const {
    data: trip,
    error,
    loaded,
    refresh,
  } = useGroupData<GroupTrip>("get_group_trip", { p_trip: id });
  const userId = useAuthStore((s) => s.user?.id);
  const plan = useActivePlan();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  async function rsvp(status: Rsvp) {
    setBusy(true);
    setFailure("");
    try {
      await groupRpc(createClient(), "set_trip_rsvp", {
        p_trip: id,
        p_status: status,
      });
      groupsChanged();
      refresh();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not save RSVP.");
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <p role="status" className="p-6">
        Loading weekend…
      </p>
    );
  if (!trip)
    return (
      <div className="p-6">
        <Link href="/groups">← Groups and weekends</Link>
        <p role="alert">
          {error ||
            "Weekend unavailable. If someone in the chat is blocked, you can still leave through group settings."}
        </p>
      </div>
    );
  const status = trip.members.find((m) => m.user_id === userId)?.status;
  const open = trip.proposals.filter((p) => p.status === "open");
  const conflicts = status === "going" ? tripConflicts(plan, trip) : [];
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/messages/${trip.conversation_id}`}
          className="btn btn-ghost btn-md"
        >
          ← Weekend chat
        </Link>
        {trip.group_id && (
          <Link
            href={`/groups/${trip.group_id}`}
            className="btn btn-ghost btn-md"
          >
            Group settings
          </Link>
        )}
      </div>
      <h1 className="font-heading text-3xl">{trip.title}</h1>
      <p className="text-muted">{weekendLabel(trip)}</p>
      {!!open.length && (
        <a
          href="#suggestions"
          className="block rounded-card border border-warning bg-warning/10 p-4 text-sm"
        >
          {open.length} suggested{" "}
          {open.length === 1 ? "edit needs" : "edits need"} your vote ·{" "}
          {voteTimeLeft(
            open.reduce((a, b) => (a.closes_at < b.closes_at ? a : b))
              .closes_at,
            now,
          )}
        </a>
      )}
      {!!conflicts.length && (
        <p
          role="status"
          className="rounded-card border border-warning bg-warning/10 p-4 text-sm"
        >
          This overlaps {conflicts.map((s) => s.label).join(", ")} in your
          active plan. You can still go; your personal plan stays as you saved
          it.
        </p>
      )}
      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-heading text-xl">Are you going?</h2>
        <div
          role="group"
          aria-label="Your RSVP"
          className="flex flex-wrap gap-2"
        >
          {(["going", "maybe", "out"] as const).map((s) => (
            <button
              key={s}
              disabled={busy}
              aria-pressed={status === s}
              className={`btn btn-md ${status === s ? "btn-primary" : "btn-secondary"}`}
              onClick={() => void rsvp(s)}
            >
              {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Not going"}
            </button>
          ))}
        </div>
        {failure && (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        )}
        {trip.members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 py-1">
            <Avatar
              path={m.profile?.avatar_path}
              name={m.profile?.display_name ?? "Private profile"}
              size={32}
            />
            <span className="flex-1 text-sm">
              {m.profile?.display_name ?? "Private profile"}
              {m.user_id === userId ? " (you)" : ""}
            </span>
            <span className="text-sm text-muted">
              {m.status === "out"
                ? "Not going"
                : m.status === "going"
                  ? "Going"
                  : "Maybe"}
            </span>
          </div>
        ))}
      </section>
      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-heading text-xl">The plan</h2>
        {trip.stops.length ? (
          <ol className="list-inside list-decimal">
            {trip.stops.map((s, i) => (
              <li key={i}>
                {TRIPS.find((t) => t.id === s.tripId)?.n ?? s.tripId} ·{" "}
                {s.nights} nights
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">
            No destinations yet. Suggest your first stop below.
          </p>
        )}
        <p className="text-sm">
          Up to {trip.max_per_room} people per room · Couples share a bed:{" "}
          {trip.couples_share_bed ? "yes" : "no"} · Mixed-gender rooms:{" "}
          {trip.mixed_rooms ? "OK" : "no"}
        </p>
        <button
          disabled={status !== "going"}
          className="btn btn-primary btn-md"
          onClick={() => setEditing((v) => !v)}
        >
          Suggest dates, stops or room setup
        </button>
        {status !== "going" && (
          <p className="text-xs text-muted">
            Choose Going to suggest changes and vote.
          </p>
        )}
      </section>
      {editing && (
        <TripEditForm
          trip={trip}
          onDone={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      <div id="suggestions" className="scroll-mt-24">
        <ProposalCards trip={trip} onChange={refresh} />
      </div>
      <WeekendLodging trip={trip} onChange={refresh} />
      <section className={cardClass}>
        <h2 className="font-heading text-xl">Split costs</h2>
        <p className="text-sm text-muted">Coming soon in Phase 30.</p>
      </section>
      {!trip.group_id && (
        <button
          disabled={busy}
          className="btn btn-ghost btn-md text-danger"
          onClick={async () => {
            if (!window.confirm("Leave this weekend and its chat?")) return;
            setBusy(true);
            try {
              await groupRpc(createClient(), "leave_weekend", { p_trip: id });
              groupsChanged();
              router.push("/groups");
            } catch (e) {
              setFailure(e instanceof Error ? e.message : "Could not leave.");
              setBusy(false);
            }
          }}
        >
          Leave weekend
        </button>
      )}
    </main>
  );
}
