"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { usePlanStore } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { isKnownCity } from "@/lib/resolveHome";
import { fetchUserSettings, saveUserSettings, rowToOnboardingValues } from "@/lib/supabase/settings";
import OnboardingFlow, { EMPTY_ONBOARDING_DEFAULTS, type OnboardingResult, type OnboardingValues } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const setOnboardingDefaults = usePlanStore((s) => s.setOnboardingDefaults);
  const addHome = useCustomHomesStore((s) => s.addHome);

  const [initial, setInitial] = useState<OnboardingValues | null>(null);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingResult, setPendingResult] = useState<OnboardingResult | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    (async () => {
      const supabase = createClient();
      const row = await fetchUserSettings(supabase, user.id);
      if (row) {
        setAlreadyOnboarded(!!row.onboarded_at);
        setInitial(rowToOnboardingValues(row));
      } else {
        setInitial(EMPTY_ONBOARDING_DEFAULTS);
      }
    })();
  }, [authLoading, user, router]);

  async function handleComplete(result: OnboardingResult) {
    if (!user) return;
    // Configure the local plan store first (this is what actually gets you
    // out of the "let's set up your trip first" loop) -- an account-sync
    // failure below shouldn't leave you stuck re-answering the wizard.
    if (!isKnownCity(result.host.city)) {
      addHome(result.host.city, { lat: result.host.lat, lon: result.host.lon, country: result.host.country });
    }
    setOnboardingDefaults(result.host.city, result.semester, result.studyingInEurope, result.currency);

    setSaving(true);
    setSaveError(false);
    setPendingResult(result);
    const supabase = createClient();
    const ok = await saveUserSettings(supabase, user.id, result, alreadyOnboarded);
    setSaving(false);
    if (!ok) {
      setSaveError(true);
      return;
    }
    setPendingResult(null);
    router.replace("/");
  }

  async function retrySave() {
    if (!user || !pendingResult) return;
    setSaving(true);
    setSaveError(false);
    const supabase = createClient();
    const ok = await saveUserSettings(supabase, user.id, pendingResult, alreadyOnboarded);
    setSaving(false);
    if (!ok) {
      setSaveError(true);
      return;
    }
    setPendingResult(null);
    router.replace("/");
  }

  if (!initial) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <h1 className="font-heading text-xl font-semibold text-ink">Set up your semester</h1>
      <p className="mt-2 text-sm text-muted">
        A few quick questions so the calendar and Schengen tracker match your actual program.
        Everything here is editable later from Settings.
      </p>
      {saveError && (
        <div className="mt-6 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <p className="font-semibold">Your setup was saved on this device, but syncing it to your account failed.</p>
          <p className="mt-1">
            Your calendar and plan already reflect what you just entered — this only affects seeing it on other
            devices. Check your connection and try again.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={retrySave} disabled={saving} className="btn btn-danger btn-sm">
              {saving ? "Retrying…" : "Retry sync"}
            </button>
            <button type="button" onClick={() => router.replace("/")} className="btn btn-ghost btn-sm">
              Continue anyway
            </button>
          </div>
        </div>
      )}
      <div className="mt-8 rounded-card border border-border bg-surface p-5">
        <OnboardingFlow initial={initial} onComplete={handleComplete} layout="wizard" />
      </div>
    </div>
  );
}
