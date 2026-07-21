"use client";

import { useRef } from "react";
import { usePlanStore } from "@/lib/store/plan";
import { downloadPlanJson, parsePlanFile } from "@/lib/planIO";
import PlanCard from "@/components/plans/PlanCard";
import CompareTable from "@/components/plans/CompareTable";

export default function PlansPage() {
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

  const fileInput = useRef<HTMLInputElement>(null);

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
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ids.map((id) => (
          <PlanCard
            key={id}
            plan={plans[id]}
            isActive={id === activeId}
            isCompared={validCompareIds.includes(id)}
            onOpen={() => switchPlan(id)}
            onDuplicate={() => duplicatePlan(id)}
            onRename={(name) => name.trim() && renamePlan(id, name)}
            onExport={() => downloadPlanJson(plans[id])}
            onDelete={() => handleDelete(id)}
            onToggleCompare={() => toggleCompare(id)}
          />
        ))}
      </div>

      <div className="mt-5">
        <CompareTable plans={plans} planIds={validCompareIds} activeId={activeId} />
      </div>
    </div>
  );
}
