"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { groupRpc } from "@/lib/supabase/groups";
import { inputClass, cardClass } from "@/components/social/controls";
import { groupsChanged } from "./useGroupData";
export default function CreateWeekend({
  groupId,
  friends = [],
  start = "",
  end = "",
  onCancel,
}: {
  groupId?: string;
  friends?: { id: string; name: string }[];
  start?: string;
  end?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Weekend together");
  const [first, setFirst] = useState(start);
  const [last, setLast] = useState(end);
  const [selected, setSelected] = useState<string[]>(
    friends.slice(0, 9).map((f) => f.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      const id = await groupRpc<string>(createClient(), "create_group_trip", {
        p_title: title,
        p_start: first,
        p_end: last,
        p_group: groupId ?? null,
        p_friends: groupId ? [] : selected,
      });
      groupsChanged();
      router.push(`/weekends/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create weekend.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`${cardClass} space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="font-heading text-xl">New weekend chat</h2>
      <label className="block text-sm">
        Weekend name
        <input
          required
          maxLength={100}
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Starts
          <input
            required
            type="date"
            className={inputClass}
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Ends
          <input
            required
            type="date"
            min={first}
            className={inputClass}
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </label>
      </div>
      {groupId ? (
        <p className="text-sm text-muted">
          Everyone in the group starts as Going and can change their answer.
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm">
            Friends to include ({selected.length}/9)
          </legend>
          {friends.map((f) => (
            <label key={f.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                disabled={!selected.includes(f.id) && selected.length >= 9}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked
                      ? [...ids, f.id]
                      : ids.filter((id) => id !== f.id),
                  )
                }
              />
              {f.name}
            </label>
          ))}
          <p className="text-xs text-muted">
            This creates a standalone weekend chat. Everyone selected starts as
            Going.
          </p>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy || !title.trim()}
          className="btn btn-primary btn-md"
        >
          {busy ? "Creating…" : "Create weekend"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
