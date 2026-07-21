"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/lib/store/plan";
import { useAuthStore } from "@/lib/store/auth";
import { downloadPlanJson, parsePlanFile } from "@/lib/planIO";
import { extractShareToken } from "@/lib/supabase/sharedLink";
import PlanCard from "@/components/plans/PlanCard";
import CompareTable from "@/components/plans/CompareTable";

export default function PlansPage() {
  const router = useRouter();
  const plans = usePlanStore((s) => s.plans);
  const activeId = usePlanStore((s) => s.activeId);
  const compareIds = usePlanStore((s) => s.compareIds);
  const newPlan = usePlanStore((s) => s.newPlan);
  const duplicatePlan = usePlanStore((s) => s.duplicatePlan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const deletePlan = usePlanStore((s) => s.deletePlan);
  const switchPlan = usePlanStore((s) => s.switchPlan);
  const importPlans = usePlanStore((s) => s.importPlans);
  const toggleCompare = usePlanStore((s) => s.toggleCompare);
  const compareAll = usePlanStore((s) => s.compareAll);
  const clearCompare = usePlanStore((s) => s.clearCompare);
  const removeSharedPlan = usePlanStore((s) => s.removeSharedPlan);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const fileInput = useRef<HTMLInputElement>(null);
  const [friendLink, setFriendLink] = useState("");

  const ids = Object.keys(plans).sort((a, b) => plans[b].updated - plans[a].updated);
  const validCompareIds = compareIds.filter((id) => plans[id]);

  const handleImport = (file: File) => {
    file
      .text()
      .then((text) => {
        const incoming = parsePlanFile(text);
        if (!incoming.length) throw new Error("empty");
        importPlans(incoming);
      })
      .catch(() => alert("Could not read that plan file."));
  };

  const handleDelete = (id: string) => {
    if (confirm(`Delete "${plans[id].name}"? This can't be undone.`)) deletePlan(id);
  };

  const handleOpenFriendLink = () => {
    const token = extractShareToken(friendLink);
    if (!token) {
      alert("That doesn't look like a share link — paste the full link a friend sent you.");
      return;
    }
    setFriendLink("");
    router.push(`/shared/${token}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-xl font-semibold text-zinc-50">Plans &amp; Compare</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Every change you make is saved automatically to this browser. Build multiple versions of
          your semester — a budget one, a bucket-list one — then tick <b className="text-zinc-200">compare</b>{" "}
          on two or more and see them side by side below. Share a plan as a .json to send it to a
          friend (import theirs to compare against yours).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => newPlan(prompt("Name this plan:", `Plan ${ids.length + 1}`) || undefined)}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950"
          >
            ＋ New plan
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500/50"
          >
            ⤒ Import plan file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={compareAll}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500/50"
          >
            Compare all
          </button>
          <button
            type="button"
            onClick={clearCompare}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500/50"
          >
            Clear comparison
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <span className="text-xs font-semibold text-zinc-400">🔗 Have a friend&apos;s share link?</span>
          <input
            type="text"
            value={friendLink}
            onChange={(e) => setFriendLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleOpenFriendLink()}
            placeholder="Paste the link they sent you"
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={handleOpenFriendLink}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500/50"
          >
            Open
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ids.map((id) => (
          <PlanCard
            key={id}
            plan={plans[id]}
            isActive={id === activeId}
            isCompared={validCompareIds.includes(id)}
            currentUserId={currentUserId}
            onOpen={() => switchPlan(id)}
            onDuplicate={() => duplicatePlan(id)}
            onRename={(name) => name.trim() && renamePlan(id, name)}
            onExport={() => downloadPlanJson(plans[id])}
            onDelete={() => handleDelete(id)}
            onToggleCompare={() => toggleCompare(id)}
            onRemoveShared={() => removeSharedPlan(id)}
          />
        ))}
      </div>

      <div className="mt-5">
        <CompareTable plans={plans} planIds={validCompareIds} activeId={activeId} />
      </div>
    </div>
  );
}
