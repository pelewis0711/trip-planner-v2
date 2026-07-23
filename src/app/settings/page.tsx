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

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const setOnboardingDefaults = usePlanStore((s) => s.setOnboardingDefaults);
  const addHome = useCustomHomesStore((s) => s.addHome);

  const [initial, setInitial] = useState<OnboardingValues | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    (async () => {
      const supabase = createClient();
      const row = await fetchUserSettings(supabase, user.id);
      setInitial(row ? rowToOnboardingValues(row) : AAU_PRAGUE_DEFAULTS);
    })();
  }, [authLoading, user, router]);

  async function handleSave(result: OnboardingResult) {
    if (!user) return;
    if (!isKnownCity(result.host.city)) {
      addHome(result.host.city, { lat: result.host.lat, lon: result.host.lon, country: result.host.country });
    }
    setOnboardingDefaults(result.host.city, result.semester, result.studyingInEurope, result.currency);

    const supabase = createClient();
    // this account has necessarily been through onboarding already to reach
    // Settings (redirected there otherwise) -- always preserve onboarded_at
    await saveUserSettings(supabase, user.id, result, true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!initial) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-xl font-semibold text-zinc-50">Settings</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Your host city, university, and semester dates — used as the default for any new plan you
          create. Doesn&apos;t change plans you&apos;ve already made; edit an individual plan&apos;s dates from its
          card on the Plans tab instead.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <OnboardingFlow initial={initial} onComplete={handleSave} layout="single-page" submitLabel="Save" />
        {saved && <p className="mt-3 text-sm text-emerald-400">Saved.</p>}
      </div>
    </div>
  );
}
