"use client";

import { useState } from "react";
import type { Plan } from "@/lib/store/plan";
import { usePlanStore } from "@/lib/store/plan";
import { planGrandTotals } from "@/lib/planTotals";
import { exportPlanXlsx } from "@/lib/excel";
import { useLivePriceStore } from "@/lib/store/livePrices";
import { useLiveHotelPriceStore } from "@/lib/store/liveHotelPrices";
import { formatMoney } from "@/lib/calc/currency";
import SharePanel from "./SharePanel";
import SemesterPanel from "./SemesterPanel";

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
  const livePrices = useLivePriceStore((s) => s.prices);
  const liveHotelPrices = useLiveHotelPriceStore((s) => s.prices);
  const currency = usePlanStore((s) => s.defaultCurrency);
  const money = (n: number) => formatMoney(n, currency);

  const handleExportXlsx = async () => {
    setBuildingXlsx(true);
    try {
      await exportPlanXlsx(plan, livePrices, liveHotelPrices);
    } catch {
      alert("Something went wrong building the Excel file. Try again in a moment.");
    } finally {
      setBuildingXlsx(false);
    }
  };

  return (
    <div
      className={`rounded-card border bg-surface p-4 shadow-sm ${isActive ? "border-primary shadow-[0_0_0_1px_rgba(90,74,209,0.3)]" : "border-border"}`}
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
            className="min-w-0 flex-1 rounded-md border border-primary bg-surface-muted px-2 py-1 text-base font-semibold text-ink"
          />
        ) : (
          <h4 className="flex min-w-0 items-center gap-2 font-heading text-base font-semibold text-ink">
            <span className="truncate">{plan.name}</span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                EDITING
              </span>
            )}
            {plan.readOnly && (
              <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-muted">
                VIEW ONLY
              </span>
            )}
            {isCollaboration && (
              <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                COLLAB
              </span>
            )}
          </h4>
        )}
      </div>

      {(plan.readOnly || isCollaboration) && plan.lastEditedBy && (
        <div className="mt-0.5 text-[11px] text-muted">
          Last edited by {plan.lastEditedBy}
          {plan.lastEditedAt ? ` · ${new Date(plan.lastEditedAt).toLocaleDateString()}` : ""}
        </div>
      )}

      <div className="mt-1 text-[11.5px] text-muted">
        🏠 {plan.home} · {g.count} trip{g.count === 1 ? "" : "s"} · {g.stops} place
        {g.stops === 1 ? "" : "s"} · {g.nights} night{g.nights === 1 ? "" : "s"} · updated{" "}
        {new Date(plan.updated).toLocaleDateString()}
      </div>

      <div className="mt-2 text-xl font-extrabold text-accent">
        {money(g.total)}
        {plan.budget !== null && (
          <span className={`ml-2 text-xs font-semibold ${overBudget ? "text-danger" : "text-success"}`}>
            of {money(plan.budget)} budget
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {plan.readOnly ? (
          <button
            type="button"
            onClick={onRemoveShared}
            className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-danger/50 hover:text-danger"
          >
            Remove from my plans
          </button>
        ) : (
          <>
            {!isActive && (
              <button
                type="button"
                onClick={onOpen}
                className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-bold text-white hover:bg-primary-hover"
              >
                Open
              </button>
            )}
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setNameInput(plan.name);
                setRenaming(true);
              }}
              className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40"
            >
              Rename
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setSharing((s) => !s)}
                className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40"
              >
                🔗 Share
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setEditingSemester((s) => !s)}
                className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40"
              >
                📅 Semester
              </button>
            )}
            <button
              type="button"
              onClick={onExport}
              className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40"
            >
              Export .json
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={buildingXlsx}
              className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:border-primary/40 disabled:opacity-50"
            >
              {buildingXlsx ? "Building…" : "📊 Excel"}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md bg-danger/10 px-2.5 py-1 text-[11.5px] font-bold text-danger hover:bg-danger/20"
              >
                Delete
              </button>
            )}
          </>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted">
          <input
            type="checkbox"
            checked={isCompared}
            onChange={onToggleCompare}
            className="accent-primary"
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
