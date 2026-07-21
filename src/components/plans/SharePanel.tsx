"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { createClient } from "@/lib/supabase/client";
import { enableViewShare, disableViewShare, enableCollabShare, disableCollabShare } from "@/lib/supabase/sharing";

function shareUrl(token: string) {
  return `${window.location.origin}/shared/${token}`;
}

export default function SharePanel({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const patchPlan = usePlanStore((s) => s.patchPlan);
  const [busy, setBusy] = useState<"view" | "collab" | null>(null);
  const [copied, setCopied] = useState<"view" | "collab" | null>(null);

  const toggle = async (kind: "view" | "collab") => {
    setBusy(kind);
    const supabase = createClient();
    const enabled = kind === "view" ? !!plan.shareViewToken : !!plan.shareCollabToken;
    const fn =
      kind === "view"
        ? enabled
          ? disableViewShare
          : enableViewShare
        : enabled
          ? disableCollabShare
          : enableCollabShare;
    const updated = await fn(supabase, plan.id);
    if (updated) {
      patchPlan(plan.id, {
        shareViewToken: updated.shareViewToken,
        shareCollabToken: updated.shareCollabToken,
        collaboratorIds: updated.collaboratorIds,
      });
    } else {
      alert("Couldn't update sharing — try again in a moment.");
    }
    setBusy(null);
  };

  const copy = (kind: "view" | "collab", token: string) => {
    navigator.clipboard.writeText(shareUrl(token));
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px]">
      <div className="flex items-center justify-between">
        <b className="text-zinc-200">Share this plan</b>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          ✕
        </button>
      </div>

      <div>
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={!!plan.shareViewToken}
            disabled={busy !== null}
            onChange={() => toggle("view")}
            className="accent-emerald-500"
          />
          Anyone with the link can view
        </label>
        {plan.shareViewToken && (
          <div className="mt-1 flex items-center gap-2">
            <input
              readOnly
              value={shareUrl(plan.shareViewToken)}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400"
            />
            <button
              type="button"
              onClick={() => copy("view", plan.shareViewToken!)}
              className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 font-semibold text-zinc-300"
            >
              {copied === "view" ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={!!plan.shareCollabToken}
            disabled={busy !== null}
            onChange={() => toggle("collab")}
            className="accent-emerald-500"
          />
          Anyone with the link (signed in) can edit
        </label>
        {plan.shareCollabToken && (
          <>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={shareUrl(plan.shareCollabToken)}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400"
              />
              <button
                type="button"
                onClick={() => copy("collab", plan.shareCollabToken!)}
                className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 font-semibold text-zinc-300"
              >
                {copied === "collab" ? "Copied!" : "Copy"}
              </button>
            </div>
            {!!plan.collaboratorIds?.length && (
              <div className="mt-1 text-zinc-500">
                {plan.collaboratorIds.length} collaborator{plan.collaboratorIds.length > 1 ? "s" : ""} joined
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
