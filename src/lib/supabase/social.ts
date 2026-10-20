import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultSettings,
  draftToColumns,
  type ProfileDraft,
  type ProfileView,
  type PublicProfileRow,
  type SocialSettingsRow,
} from "@/lib/social/profile";

// Phase 26: reads and writes for the social profile layer. Tables and rules in
// supabase/migrations/0013_social_profiles.sql. The owner reads/writes their
// own rows directly (RLS: own row only); anyone else's profile comes ONLY from
// get_public_profile(), which returns just the fields that viewer may see.

export async function fetchOwnProfile(supabase: SupabaseClient, userId: string): Promise<PublicProfileRow | null> {
  const { data, error } = await supabase.from("public_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Failed to fetch public profile", error);
    return null;
  }
  return data as PublicProfileRow | null;
}

export type SaveResult = { ok: true; row: PublicProfileRow } | { ok: false; error: { code?: string; message?: string } };

/** Create (with the 18+ confirmation) or update the caller's own profile.
 * The database stamps the confirmation time and enforces every rule. */
export async function saveOwnProfile(
  supabase: SupabaseClient,
  userId: string,
  draft: ProfileDraft,
  opts: { isNew: boolean; avatarPath?: string | null }
): Promise<SaveResult> {
  const cols = {
    ...draftToColumns(draft),
    ...(opts.avatarPath !== undefined ? { avatar_path: opts.avatarPath } : {}),
  };
  const query = opts.isNew
    ? supabase
        .from("public_profiles")
        .insert({ id: userId, ...cols, adult_confirmed_at: new Date().toISOString() })
        .select("*")
        .single()
    : supabase.from("public_profiles").update(cols).eq("id", userId).select("*").single();
  const { data, error } = await query;
  if (error || !data) {
    console.error("Failed to save public profile", error);
    return { ok: false, error: { code: error?.code, message: error?.message } };
  }
  return { ok: true, row: data as PublicProfileRow };
}

export async function setAvatarPath(supabase: SupabaseClient, userId: string, path: string | null): Promise<boolean> {
  const { error } = await supabase.from("public_profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) console.error("Failed to set avatar path", error);
  return !error;
}

/** Live check for the username field. True when free, or already yours.
 * Fails open to `null` (unknown) so a network hiccup doesn't block typing --
 * the unique index is the real guard on Save. */
export async function isUsernameAvailable(supabase: SupabaseClient, username: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("username_available", { p_username: username });
  if (error) {
    console.error("username_available failed", error);
    return null;
  }
  return data === true;
}

export async function fetchSocialSettings(supabase: SupabaseClient, userId: string): Promise<SocialSettingsRow> {
  const { data, error } = await supabase.from("social_settings").select("*").eq("id", userId).maybeSingle();
  if (error) console.error("Failed to fetch social settings", error);
  return (data as SocialSettingsRow | null) ?? defaultSettings(userId);
}

export async function saveSocialSettings(supabase: SupabaseClient, settings: SocialSettingsRow): Promise<boolean> {
  const { error } = await supabase
    .from("social_settings")
    .upsert({ ...settings, updated_at: new Date().toISOString() });
  if (error) console.error("Failed to save social settings", error);
  return !error;
}

/** Someone's profile as the caller is allowed to see it, or null (no such
 * user, or nothing visible to you -- deliberately indistinguishable). */
export async function fetchProfileView(supabase: SupabaseClient, username: string): Promise<ProfileView | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_username: username });
  if (error) {
    console.error("get_public_profile failed", error);
    return null;
  }
  return (data as ProfileView | null) ?? null;
}

// ---------------------------------------------------------------------------
// Avatars (private "avatars" bucket; path "<user id>/<name>.<ext>").
// ---------------------------------------------------------------------------

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Upload a (pre-resized) avatar under a fresh name and return its path. A
 * fresh name each time means no browser shows a stale cached copy. */
export async function uploadAvatar(supabase: SupabaseClient, userId: string, blob: Blob): Promise<string | null> {
  const ext = EXT[blob.type];
  if (!ext) return null;
  const path = `${userId}/avatar-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) {
    console.error("Avatar upload failed", error);
    return null;
  }
  return path;
}

export async function removeAvatarFile(supabase: SupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) console.error("Avatar delete failed", error);
}

/** Downloads with the caller's session (so the Storage policy decides) and
 * returns a blob: URL for an <img>. Null if hidden or missing. */
export async function avatarObjectUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("avatars").download(path);
  if (error || !data) return null;
  return URL.createObjectURL(data);
}
