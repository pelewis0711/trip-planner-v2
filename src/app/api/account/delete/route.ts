import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceCredentials } from "@/lib/supabase/service";
import { SIGN_IN_REQUIRED } from "@/lib/auth/gate";
import { ACCOUNT_DELETE_LIMITER, tooManyRequests } from "@/lib/rateLimit";
import { DELETE_CONFIRM_WORD } from "@/lib/social/accountDeletion";
import { removeFolder } from "../../_shared/storageCleanup";

// Permanently deletes the signed-in user's account. Signed-in only (checked
// here as well as in src/proxy.ts), POST only, and the body must carry the
// confirmation word typed on /settings/delete-account.
//
// Order matters:
//   1. Remove the user's profile-photo folder from Storage (no foreign key can
//      reach Storage, so the database can't do this part).
//   2. Delete the auth user. Every table cascades from it: plans, settings,
//      votes, comments, public_profiles, social_settings, the email mirror.
//      Migration 0014's trigger also takes them off friends' collaborator
//      lists and queues the photo folder again -- harmless if step 1 already
//      emptied it, and the daily sweep's safety net if step 1 failed.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 });

  const limit = ACCOUNT_DELETE_LIMITER.check(`delete:${user.id}`);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if ((body as { confirm?: unknown } | null)?.confirm !== DELETE_CONFIRM_WORD) {
    return NextResponse.json({ error: `Type ${DELETE_CONFIRM_WORD} to confirm.` }, { status: 400 });
  }

  if (!hasServiceCredentials()) {
    return NextResponse.json({ error: "Account deletion isn't available right now." }, { status: 503 });
  }
  const service = createServiceClient();

  // Best effort: if this fails, the queued sweep removes the photos later.
  await removeFolder(service, "avatars", `${user.id}/`);

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Couldn't delete your account. Nothing was removed; try again." }, { status: 500 });
  }

  // The session cookie now points at a user that doesn't exist; clear it.
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
