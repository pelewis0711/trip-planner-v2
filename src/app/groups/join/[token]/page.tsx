"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { groupsChanged } from "@/components/groups/useGroupData";
export default function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function join() {
    setBusy(true);
    setError("");
    try {
      const id = await groupRpc<string>(createClient(), "join_group_by_token", {
        p_token: token,
      });
      groupsChanged();
      router.replace(`/groups/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation unavailable.");
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="font-heading text-3xl">You&apos;re invited</h1>
      <p>
        Join the group and its chats. You&apos;ll start as Going for its
        weekends and can change your answer any time.
      </p>
      <button
        disabled={busy}
        className="btn btn-primary btn-lg"
        onClick={() => void join()}
      >
        {busy ? "Joining…" : "Join group"}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Link href="/messages" className="btn btn-ghost btn-md">
        Back to messages
      </Link>
    </main>
  );
}
