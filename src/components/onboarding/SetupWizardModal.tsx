"use client";

// Phase 9 step 3: the local (no-account-required) setup wizard modal,
// shared by LocalSetupBanner (the dismissible header prompt) and Calendar's
// "set up your trip" empty state -- one modal, two entry points.
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { usePlanStore } from "@/lib/store/plan";
import { isKnownCity } from "@/lib/resolveHome";
import OnboardingFlow, {
  EMPTY_ONBOARDING_DEFAULTS,
  type OnboardingResult,
} from "@/components/onboarding/OnboardingFlow";

export default function SetupWizardModal({ onClose }: { onClose: () => void }) {
  const setOnboardingDefaults = usePlanStore((s) => s.setOnboardingDefaults);
  const addHome = useCustomHomesStore((s) => s.addHome);

  function handleComplete(result: OnboardingResult) {
    if (!isKnownCity(result.host.city)) {
      addHome(result.host.city, { lat: result.host.lat, lon: result.host.lon, country: result.host.country });
    }
    setOnboardingDefaults(result.host.city, result.semester, result.studyingInEurope, result.currency);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 px-4 py-10">
      <div className="w-full max-w-lg rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Set up your trip</h2>
            <p className="mt-1 text-xs text-muted">
              Saved on this device — sign in anytime to keep it with your account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">
          <OnboardingFlow initial={EMPTY_ONBOARDING_DEFAULTS} onComplete={handleComplete} layout="wizard" />
        </div>
      </div>
    </div>
  );
}
