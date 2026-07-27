import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  // Code-gate placeholder: if a simple password screen is ever wanted (e.g.
  // to take the app fully private for a while), check a cookie/header here
  // and redirect to a /gate page before updateSession runs -- not built,
  // just the spot it would go.
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
