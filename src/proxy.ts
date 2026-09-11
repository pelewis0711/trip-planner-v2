import { NextResponse, type NextRequest } from "next/server";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";
import { gateDecision, SIGN_IN_REQUIRED } from "@/lib/auth/gate";

// THE SIGN-IN GATE. Semesterly is signed-in only: every request this proxy
// sees either has a verified user, is on the public allowlist
// (PUBLIC_ROUTES in src/lib/auth/gate.ts), or is turned away -- pages get
// redirected to /welcome?next=..., API calls get a JSON 401. See CLAUDE.md,
// "Who can use the app", before loosening any of this.
//
// This file must stay `proxy.ts`. Next 16 ignores `middleware.ts` entirely:
// everything would look fine while the whole app sat wide open.
export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const decision = gateDecision(request.nextUrl, user !== null);

  switch (decision.type) {
    case "allow":
      return response;
    case "redirect":
      return withSessionCookies(response, NextResponse.redirect(new URL(decision.location, request.url)));
    case "unauthorized":
      return withSessionCookies(response, NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 }));
  }
}

// Runs on everything except build assets and image files -- including /api/*,
// which is why gateDecision answers API paths with a 401 instead of a redirect.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
