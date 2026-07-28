import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolves user ids to emails via the `profiles` table (a mirror of auth.users
 * kept in sync by a trigger — see supabase/migrations/0002_sharing.sql).
 * Used anywhere the UI needs to show "who" for a collaborator/last-editor.
 *
 * Since 0009_lock_down_profiles.sql this only returns rows for yourself and for
 * people you share a plan with — ids you have no connection to are silently
 * absent from the returned Map rather than erroring. Every caller already
 * tolerates a missing id (they all `?? null` / `?? ""`), and every caller only
 * ever asks about co-members of a plan it can already read. The one exception
 * is the share page, which must show an owner to a visitor who hasn't joined
 * yet — that path uses fetchSharedOwnerEmail below instead. */
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

/** The plan owner's email for a share link, via the `get_shared_plan_owner_email`
 * RPC (supabase/migrations/0009_lock_down_profiles.sql).
 *
 * The narrowed `profiles` policy deliberately hides the owner from a visitor who
 * hasn't joined the plan yet, so the share page can't get this from
 * fetchProfileEmails. The RPC is security definer and returns exactly one string
 * — the owner's email for the single plan matching the token — rather than
 * widening the table policy for one page. Returns null for an unknown/expired
 * token, or if the caller is signed out (the RPC is granted to `authenticated`
 * only, matching the pre-0009 behavior where signed-out visitors saw no email). */
export async function fetchSharedOwnerEmail(
  supabase: SupabaseClient,
  token: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_shared_plan_owner_email", { p_token: token });
  if (error) return null;
  return (data as string | null) ?? null;
}
