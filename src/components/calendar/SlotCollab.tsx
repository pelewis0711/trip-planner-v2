"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProfileEmails } from "@/lib/supabase/profiles";
import {
  fetchVotes,
  setVote,
  removeVote,
  fetchComments,
  postComment,
  deleteComment,
  type VoteRow,
  type CommentRow,
} from "@/lib/supabase/collab";

const EMOJI = ["👍", "🔥", "🤔", "👎", "❤️"];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function SlotCollab({
  planId,
  slotId,
  userId,
}: {
  planId: string;
  slotId: string;
  userId: string;
}) {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([fetchVotes(supabase, planId, slotId), fetchComments(supabase, planId, slotId)]).then(
      async ([v, c]) => {
        if (cancelled) return;
        setVotes(v);
        setComments(c);
        const ids = [...v.map((x) => x.user_id), ...c.map((x) => x.user_id)];
        setEmails(await fetchProfileEmails(supabase, ids));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [planId, slotId]);

  const myVote = votes.find((v) => v.user_id === userId)?.emoji ?? null;
  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v.emoji, (counts.get(v.emoji) ?? 0) + 1));

  const handleVote = async (emoji: string) => {
    const supabase = createClient();
    if (myVote === emoji) {
      setVotes((v) => v.filter((x) => x.user_id !== userId));
      await removeVote(supabase, planId, slotId, userId);
    } else {
      setVotes((v) => [...v.filter((x) => x.user_id !== userId), { user_id: userId, emoji }]);
      await setVote(supabase, planId, slotId, userId, emoji);
    }
  };

  const handlePost = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    const supabase = createClient();
    const saved = await postComment(supabase, planId, slotId, userId, body);
    setPosting(false);
    if (saved) {
      setComments((c) => [...c, saved]);
      setDraft("");
      if (!emails.has(userId)) {
        const e = await fetchProfileEmails(supabase, [userId]);
        setEmails((prev) => new Map([...prev, ...e]));
      }
    }
  };

  const handleDelete = async (id: string) => {
    setComments((c) => c.filter((x) => x.id !== id));
    await deleteComment(createClient(), id);
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-muted p-3.5">
      <h5 className="mb-2 text-[10.5px] font-semibold tracking-wide text-muted uppercase">
        👥 Votes &amp; comments
      </h5>

      <div className="flex flex-wrap gap-1.5">
        {EMOJI.map((e) => {
          const n = counts.get(e) ?? 0;
          const mine = myVote === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => handleVote(e)}
              className={`rounded-full border px-2.5 py-1 text-sm transition-colors ${
                mine ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              {e} {n > 0 && <span className="text-[11px] text-muted">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 text-[12px]">
            <div>
              <span className="font-semibold text-ink">{emails.get(c.user_id) ?? "someone"}</span>{" "}
              <span className="text-muted">{timeAgo(c.created_at)}</span>
              <div className="text-ink">{c.body}</div>
            </div>
            {c.user_id === userId && (
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="shrink-0 text-muted hover:text-danger"
                aria-label="Delete comment"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
          placeholder="Add a comment…"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink placeholder:text-muted"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !draft.trim()}
          className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-primary/50 disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  );
}
