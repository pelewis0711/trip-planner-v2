"use client";

// Phase 9 step 3: lets an anonymous (not signed-in) visitor run the same
// onboarding wizard signed-in accounts get, saved locally on this device --
// no Supabase call, matching the app's local-first architecture (same spirit
// as useCustomHomesStore/useCustomTripsStore working fully offline). A
// dismissible banner rather than a forced takeover, so browsing without
// setup still works exactly as it does today. If they later sign in,
// AuthSync.tsx's checkOnboarding() picks these local answers up and pushes
// them to their new account instead of re-asking.
import { useState } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { usePlanStore } from "@/lib/store/plan";
import SetupWizardModal from "@/components/onboarding/SetupWizardModal";

export default function LocalSetupBanner() {
  const user = useAuthStore((s) => s.user);
  const defaultHome = usePlanStore((s) => s.defaultHome);
  const dismissed = usePlanStore((s) => s.setupPromptDismissed);
  const dismiss = usePlanStore((s) => s.dismissSetupPrompt);

  const [open, setOpen] = useState(false);

  if (user || defaultHome || dismissed) return null;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-[12.5px] text-emerald-200">
          <span>
            🧭 Set up your trip — pick your host city and semester dates so your calendar matches your
            program, not someone else&apos;s.
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border border-emerald-500/60 bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-100"
            >
              Set up now
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md border border-emerald-500/40 px-2 py-1 font-semibold text-emerald-300"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {open && <SetupWizardModal onClose={() => setOpen(false)} />}
    </>
  );
}
