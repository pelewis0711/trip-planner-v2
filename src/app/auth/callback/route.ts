import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifySignupError } from "@/lib/auth/academicEmail";

// Hit after a magic-link click or Google OAuth redirect. Exchanges the
// one-time `code` for a session cookie, then sends the user back into the app.
//
// When Supabase refuses instead, it redirects here with ?error=...&error_description=...
// and no code -- that's how a Google signup rejected by
// supabase/migrations/0012_require_academic_email.sql arrives, since the account is
// created (or not) inside Supabase before it ever redirects back. The description is
// mapped to a fixed reason for /login to render; it is never passed through as-is.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (searchParams.has("error") || searchParams.has("error_description")) {
    return redirectToLogin(origin, next, classifySignupError(searchParams.get("error_description")));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return redirectToLogin(origin, next, classifySignupError(error.message));
  }

  return redirectToLogin(origin, next, null);
}

function redirectToLogin(origin: string, next: string, reason: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", reason ?? "auth");
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
