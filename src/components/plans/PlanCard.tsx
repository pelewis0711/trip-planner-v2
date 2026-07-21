"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { planGrandTotals } from "@/lib/planTotals";
import { exportPlanXlsx } from "@/lib/excel";
import SharePanel from "./SharePanel";
import SemesterPanel from "./SemesterPanel";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PlanCard({
  plan,
  isActive,
  isCompared,
  currentUserId,
  onOpen,
  onDuplicate,
  onRename,
  onExport,
  onDelete,
  onToggleCompare,
  onRemoveShared,
}: {
  plan: Plan;
  isActive: boolean;
  isCompared: boolean;
  currentUserId?: string;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onExport: () => void;
  onDelete: () => void;
  onToggleCompare: () => void;
  onRemoveShared: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(plan.name);
  const [buildingXlsx, setBuildingXlsx] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editingSemester, setEditingSemester] = useState(false);
  const g = planGrandTotals(plan);
  const overBudget = plan.budget !== null && g.total > plan.budget;
  const isOwner = !plan.ownerId || plan.ownerId === currentUserId;
  const isCollaboration = !plan.readOnly && plan.ownerId && plan.ownerId !== currentUserId;

  const handleExportXlsx = async () => {
    setBuildingXlsx(true);
    try {
      await exportPlanXlsx(plan);
    } catch {
      alert("Something went wrong building the Excel file. Try again in a moment.");
    } finally {
      setBuildingXlsx(false);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-zinc-900/60 p-4 ${isActive ? "border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]" : "border-zinc-800"}`}
    >
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <input
            type="text"
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(nameInput);
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={() => {
              onRename(nameInput);
              setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded-md border border-emerald-500 bg-zinc-950 px-2 py-1 text-base font-semibold text-zinc-50"
          />
        ) : (
          <h4 className="flex min-w-0 items-center gap-2 text-base font-semibold text-zinc-50">
            <span className="truncate">{plan.name}</span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                EDITING
              </span>
            )}
            {plan.readOnly && (
              <span className="shrink-0 rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                VIEW ONLY
              </span>
            )}
            {isCollaboration && (
              <span className="shrink-0 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                COLLAB
              </span>
            )}
          </h4>
        )}
      </div>

      {(plan.readOnly || isCollaboration) && plan.lastEditedBy && (
        <div className="mt-0.5 text-[11px] text-zinc-500">
          Last edited by {plan.lastEditedBy}
          {plan.lastEditedAt ? ` · ${new Date(plan.lastEditedAt).toLocaleDateString()}` : ""}
        </div>
      )}

      <div className="mt-1 text-[11.5px] text-zinc-500">
        🏠 {plan.home} · {g.count} trip{g.count === 1 ? "" : "s"} · {g.stops} place
        {g.stops === 1 ? "" : "s"} · {g.nights} night{g.nights === 1 ? "" : "s"} · updated{" "}
        {new Date(plan.updated).toLocaleDateString()}
      </div>

      <div className="mt-2 text-xl font-extrabold text-emerald-400">
        {money(g.total)}
        {plan.budget !== null && (
          <span className={`ml-2 text-xs font-semibold ${overBudget ? "text-rose-400" : "text-emerald-400"}`}>
            of {money(plan.budget)} budget
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {plan.readOnly ? (
          <button
            type="button"
            onClick={onRemoveShared}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
          >
            Remove from my plans
          </button>
        ) : (
          <>
            {!isActive && (
              <button
                type="button"
                onClick={onOpen}
                className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11.5px] font-bold text-zinc-950"
              >
                Open
              </button>
            )}
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setNameInput(plan.name);
                setRenaming(true);
              }}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500"
            >
              Rename
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setSharing((s) => !s)}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500"
              >
                🔗 Share
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setEditingSemester((s) => !s)}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500"
              >
                📅 Semester
              </button>
            )}
            <button
              type="button"
              onClick={onExport}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500"
            >
              Export .json
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={buildingXlsx}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              {buildingXlsx ? "Building…" : "📊 Excel"}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md bg-rose-500/20 px-2.5 py-1 text-[11.5px] font-bold text-rose-300 hover:bg-rose-500/30"
              >
                Delete
              </button>
            )}
          </>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-zinc-400">
          <input
            type="checkbox"
            checked={isCompared}
            onChange={onToggleCompare}
            className="accent-emerald-500"
          />
          compare
        </label>
      </div>

      {sharing && !plan.readOnly && <SharePanel plan={plan} onClose={() => setSharing(false)} />}
      {editingSemester && !plan.readOnly && (
        <SemesterPanel plan={plan} onClose={() => setEditingSemester(false)} />
      )}
    </div>
  );
}
