import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolves user ids to emails via the public `profiles` table (a mirror of
 * auth.users kept in sync by a trigger — see supabase/migrations/0002_sharing.sql).
 * Used anywhere the UI needs to show "who" for a collaborator/last-editor. */
export async function fetchProfileEmails(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, email").in("id", unique);
  if (error || !data) return new Map();

  return new Map(data.map((row) => [row.id as string, (row.email as string) ?? ""]));
}
