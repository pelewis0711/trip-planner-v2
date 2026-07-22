"use client";

// Phase 7: one-time notice that food totals changed (signature dishes used
// to double-count on top of the food tier -- now they're a $0 bucket list).
// Global, not per-plan, since it's the app's math changing, not any one
// plan's data. Same dismissible-banner pattern as InstallPrompt.tsx.
import { usePlanStore } from "@/lib/store/plan";

export default function FoodFixNotice() {
  const seen = usePlanStore((s) => s.foodFixNoticeSeen);
  const dismiss = usePlanStore((s) => s.dismissFoodFixNotice);

  if (seen) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[12.5px] text-amber-200">
        <span>
          🍽️ Food pricing was fixed: signature dishes used to add their price on top of your food
          tier — they&apos;re now a free bucket list (the tier already covers a day&apos;s eating). Your
          totals may have dropped slightly — that&apos;s correct.
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border border-amber-500/40 px-2 py-1 font-semibold text-amber-300"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
