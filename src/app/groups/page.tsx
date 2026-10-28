"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { useGroupData, groupsChanged } from "@/components/groups/useGroupData";
import { cardClass, inputClass } from "@/components/social/controls";
import CreateWeekend from "@/components/groups/CreateWeekend";
import type { TripSummary } from "@/lib/social/groups";
import { weekendLabel } from "@/lib/social/friends";
export default function GroupsPage() {
  const { data, loaded, error } =
    useGroupData<{ id: string; name: string }[]>("list_groups");
  const trips = useGroupData<TripSummary[]>("list_group_trips");
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [weekend, setWeekend] = useState(false);
  async function create() {
    setBusy(true);
    setFailure("");
    try {
      const id = await groupRpc<string>(createClient(), "create_group", {
        p_name: name,
      });
      groupsChanged();
      router.push(`/groups/${id}`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link href="/messages" className="btn btn-ghost btn-md">
        ← Messages
      </Link>
      <h1 className="font-heading text-3xl">Your groups</h1>
      <p className="text-muted">
        Keep a General chat and plan weekends together, with up to 10 people.
      </p>
      <form
        className={`${cardClass} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="block text-sm font-semibold">
          New group name
          <input
            required
            maxLength={100}
            className={inputClass}
            placeholder="Prague weekend crew"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !name.trim()}
          className="btn btn-primary btn-md"
        >
          {busy ? "Creating…" : "Create group"}
        </button>
        {failure && (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        )}
      </form>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {!loaded && <p role="status">Loading groups…</p>}
      {data?.map((g) => (
        <Link
          key={g.id}
          href={`/groups/${g.id}`}
          className={`${cardClass} block min-h-11 font-bold`}
        >
          {g.name} →
        </Link>
      ))}
      <h2 className="font-heading text-2xl">Your weekends</h2>
      {trips.error && (
        <p role="alert" className="text-danger">
          {trips.error}
        </p>
      )}
      {trips.data?.map((t) => (
        <Link
          key={t.id}
          href={`/weekends/${t.id}`}
          className={`${cardClass} block`}
        >
          <strong>{t.title}</strong>
          <p className="text-sm text-muted">
            {weekendLabel(t)} ·{" "}
            {t.my_status === "out" ? "Not going" : t.my_status}
          </p>
        </Link>
      ))}
      {weekend ? (
        <CreateWeekend onCancel={() => setWeekend(false)} />
      ) : (
        <button
          className="btn btn-secondary btn-md"
          onClick={() => setWeekend(true)}
        >
          New standalone weekend
        </button>
      )}
      <p className="text-sm text-muted">
        To start a weekend with available friends, use Who&apos;s free on
        Friends.
      </p>
    </main>
  );
}
