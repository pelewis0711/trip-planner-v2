import type { SupabaseClient } from "@supabase/supabase-js";
import type { SemesterConfig } from "@/lib/calc/semester";
import type { OnboardingResult, OnboardingValues } from "@/components/onboarding/OnboardingFlow";

export interface UserSettingsRow {
  id: string;
  home_city: string;
  home_country: string;
  home_lat: number;
  home_lon: number;
  host_university: string | null;
  home_university: string | null;
  term: "fall" | "spring" | "winter";
  default_semester: SemesterConfig;
  onboarded_at: string | null;
  updated_at: string;
}

export function rowToOnboardingValues(row: UserSettingsRow): OnboardingValues {
  return {
    host: { city: row.home_city, country: row.home_country, lat: row.home_lat, lon: row.home_lon },
    hostUniversity: row.host_university ?? "",
    homeUniversity: row.home_university ?? "",
    term: row.term,
    semester: row.default_semester,
  };
}

/** Own-row-only (RLS) -- returns null if the account has never onboarded. */
export async function fetchUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSettingsRow | null> {
  const { data, error } = await supabase.from("user_settings").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Failed to fetch user_settings", error);
    return null;
  }
  return data as UserSettingsRow | null;
}

/** Insert-or-update the caller's own settings row, stamping onboarded_at the
 * first time (never overwritten afterwards -- editing from Settings later
 * shouldn't reset "have I onboarded" state). */
export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  result: OnboardingResult,
  alreadyOnboarded: boolean
): Promise<boolean> {
  const { error } = await supabase.from("user_settings").upsert({
    id: userId,
    home_city: result.host.city,
    home_country: result.host.country,
    home_lat: result.host.lat,
    home_lon: result.host.lon,
    host_university: result.hostUniversity || null,
    home_university: result.homeUniversity || null,
    term: result.term,
    default_semester: result.semester,
    onboarded_at: alreadyOnboarded ? undefined : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Failed to save user_settings", error);
    return false;
  }
  return true;
}
