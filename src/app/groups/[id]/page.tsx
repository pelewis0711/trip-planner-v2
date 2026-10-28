"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { listFriendships } from "@/lib/supabase/friends";
import type { Connection } from "@/lib/social/friends";
import { VOTE_WINDOWS, type Group, type VoteWindow } from "@/lib/social/groups";
import { useGroupData, groupsChanged } from "@/components/groups/useGroupData";
import CreateWeekend from "@/components/groups/CreateWeekend";
import Avatar from "@/components/social/Avatar";
import { cardClass, inputClass } from "@/components/social/controls";
export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const account = useAuthStore((s) => s.user?.id);
  return <GroupScreen key={`${id}:${account}`} id={id} />;
}
function GroupScreen({ id }: { id: string }) {
  const {
    data: group,
    error,
    loaded,
    refresh,
  } = useGroupData<Group>("get_group", { p_group: id });
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const [friends, setFriends] = useState<Connection[]>([]);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const [notice, setNotice] = useState("");
  const [weekend, setWeekend] = useState(false);
  useEffect(() => {
    let live = true;
    listFriendships(createClient())
      .then((rows) => {
        if (live)
          setFriends(rows.filter((r) => r.friendship_status === "friends"));
      })
      .catch(() => {
        if (live) setFailure("Could not load friends. Refresh to try again.");
      });
    return () => {
      live = false;
    };
  }, []);
  async function action(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setFailure("");
    try {
      await groupRpc(createClient(), name, args);
      refresh();
      groupsChanged();
      return true;
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function link(reset: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const token = await groupRpc<string>(
        createClient(),
        "group_invite_link",
        { p_group: id, p_reset: reset },
      );
      setInvite(`${window.location.origin}/groups/join/${token}`);
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "Could not create invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <p className="p-6" role="status">
        Loading group…
      </p>
    );
  if (!group)
    return (
      <div className="p-6">
        <Link href="/groups">← Groups</Link>
        <p role="alert">{error || "Group unavailable."}</p>
      </div>
    );
  const admin =
    group.members.find((m) => m.user_id === userId)?.role === "admin";
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link href="/groups" className="btn btn-ghost btn-md">
        ← Groups
      </Link>
      <h1 className="font-heading text-3xl">{group.name}</h1>
      {admin && (
        <GroupPreferences
          key={`${group.name}:${group.vote_window}`}
          group={group}
          busy={busy}
          save={(name, window) =>
            action("update_group", {
              p_group: id,
              p_name: name,
              p_window: window,
            })
          }
        />
      )}
      {failure && (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      )}
      <section className={cardClass}>
        <h2 className="font-heading text-xl">
          Members ({group.members.length}/10)
        </h2>
        {group.members.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <Avatar
              path={m.profile?.avatar_path}
              name={m.profile?.display_name ?? "Private profile"}
              size={40}
            />
            <div className="flex-1">
              <p className="font-semibold">
                {m.profile?.display_name ?? "Private profile"}
                {m.user_id === userId ? " (you)" : ""}
              </p>
              <p className="text-xs text-muted">{m.role}</p>
            </div>
            {admin && m.user_id !== userId && (
              <>
                <button
                  disabled={busy}
                  className="btn btn-ghost btn-md"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this person from the group and its chats?",
                      )
                    )
                      void action("group_member_action", {
                        p_group: id,
                        p_user: m.user_id,
                        p_action: "remove",
                      });
                  }}
                >
                  Remove
                </button>
                {m.role !== "admin" && (
                  <button
                    disabled={busy}
                    className="btn btn-secondary btn-md"
                    onClick={() =>
                      void action("group_member_action", {
                        p_group: id,
                        p_user: m.user_id,
                        p_action: "promote",
                      })
                    }
                  >
                    Make admin
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </section>
      <section className={cardClass}>
        <h2 className="font-heading text-xl">Add friends</h2>
        {friends
          .filter((f) => !group.members.some((m) => m.user_id === f.id))
          .map((f) => (
            <div
              key={f.id}
              className="flex min-h-11 items-center justify-between gap-2 py-1"
            >
              <span>{f.profile?.display_name ?? "Friend"}</span>
              <button
                disabled={busy || group.members.length >= 10}
                className="btn btn-secondary btn-md"
                onClick={() =>
                  void action("add_group_friend", { p_group: id, p_user: f.id })
                }
              >
                Add
              </button>
            </div>
          ))}
        <Link href="/people" className="btn btn-ghost btn-md">
          Find more friends
        </Link>
      </section>
      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-heading text-xl">Invite link</h2>
        <p className="text-sm text-muted">
          Anyone signed in with this link can join for seven days, subject to
          blocks and the 10-person limit. Reset invalidates the previous link.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            className="btn btn-secondary btn-md"
            onClick={() => void link(false)}
          >
            Get invite link
          </button>
          <button
            disabled={busy}
            className="btn btn-ghost btn-md"
            onClick={() => {
              if (window.confirm("Invalidate the previous invite link?"))
                void link(true);
            }}
          >
            Reset link
          </button>
        </div>
        {invite && (
          <>
            <input
              className={inputClass}
              readOnly
              value={invite}
              aria-label="Group invitation link"
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn btn-primary btn-md"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite);
                  setNotice("Link copied.");
                } catch {
                  setNotice("Select and copy the link above.");
                }
              }}
            >
              Copy link
            </button>
          </>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </section>
      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-heading text-xl">Chats in this group</h2>
        {group.chats.map((c) => (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className="btn btn-secondary btn-md flex"
          >
            {c.title} →
          </Link>
        ))}
        <button
          className="btn btn-primary btn-md"
          onClick={() => setWeekend((v) => !v)}
        >
          ＋ New weekend chat
        </button>
      </section>
      {weekend && (
        <CreateWeekend groupId={id} onCancel={() => setWeekend(false)} />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className="btn btn-secondary btn-md"
          onClick={() =>
            void action("mute_group", { p_group: id, p_muted: !group.muted })
          }
        >
          {group.muted ? "Unmute group" : "Mute group"}
        </button>
        <button
          disabled={busy}
          className="btn btn-ghost btn-md text-danger"
          onClick={async () => {
            if (
              window.confirm("Leave this group and all of its chats?") &&
              (await action("group_member_action", {
                p_group: id,
                p_user: userId,
                p_action: "leave",
              }))
            )
              router.push("/groups");
          }}
        >
          Leave group
        </button>
      </div>
      <p className="text-xs text-muted">
        If the last admin leaves, the longest-standing member becomes admin.
      </p>
    </main>
  );
}
function GroupPreferences({
  group,
  busy,
  save,
}: {
  group: Group;
  busy: boolean;
  save: (name: string, window: VoteWindow) => Promise<boolean>;
}) {
  const [name, setName] = useState(group.name),
    [window, setWindow] = useState(group.vote_window);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className={`${cardClass} space-y-3`}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(await save(name, window));
      }}
    >
      <label className="block text-sm">
        Group name
        <input
          required
          maxLength={100}
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label className="block text-sm">
        Votes stay open for
        <select
          className={inputClass}
          value={window}
          onChange={(e) => setWindow(e.target.value as VoteWindow)}
        >
          {VOTE_WINDOWS.map((v) => (
            <option key={v} value={v}>
              {v === "3d" ? "3 days" : `${v.slice(0, -1)} hours`}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">
        The timer applies to new suggestions. Existing timers keep their
        deadline.
      </p>
      <button
        disabled={busy || !name.trim()}
        className="btn btn-primary btn-md"
      >
        Save group settings
      </button>
      {saved && <p role="status">Saved.</p>}
    </form>
  );
}
