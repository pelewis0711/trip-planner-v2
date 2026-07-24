"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { usePlanStore } from "@/lib/store/plan";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { isKnownCity } from "@/lib/resolveHome";
import { fetchUserSettings, saveUserSettings, rowToOnboardingValues } from "@/lib/supabase/settings";
import OnboardingFlow, { AAU_PRAGUE_DEFAULTS, type OnboardingResult, type OnboardingValues } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const setOnboardingDefaults = usePlanStore((s) => s.setOnboardingDefaults);
  const addHome = useCustomHomesStore((s) => s.addHome);

  const [initial, setInitial] = useState<OnboardingValues | null>(null);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);

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
        setInitial(AAU_PRAGUE_DEFAULTS);
      }
    })();
  }, [authLoading, user, router]);

  async function handleComplete(result: OnboardingResult) {
    if (!user) return;
    if (!isKnownCity(result.host.city)) {
      addHome(result.host.city, { lat: result.host.lat, lon: result.host.lon, country: result.host.country });
    }
    setOnboardingDefaults(result.host.city, result.semester, result.studyingInEurope, result.currency);

    const supabase = createClient();
    await saveUserSettings(supabase, user.id, result, alreadyOnboarded);
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
        A few quick questions so the calendar and Schengen tracker match your actual program — not just
        AAU Prague. Everything here is editable later from Settings.
      </p>
      <div className="mt-8 rounded-card border border-border bg-surface p-5">
        <OnboardingFlow initial={initial} onComplete={handleComplete} layout="wizard" />
      </div>
    </div>
  );
}
