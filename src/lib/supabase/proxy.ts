import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

// Refreshes the Supabase auth cookie on every request so server components
// always see an up-to-date session. Called from src/proxy.ts (Next 16 renamed
// the middleware.ts convention to proxy.ts — see AGENTS.md).
//
// Returns the user alongside the response because the sign-in gate in
// src/proxy.ts needs exactly that answer, and getUser() is a network call to
// Supabase's auth server on every request -- asking twice would double it.
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the refresh. getUser(), not
  // getSession(): on the server getSession() trusts whatever the cookie says,
  // and a cookie can be forged; getUser() checks it with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

/** Copies the (possibly refreshed) session cookies from updateSession's
 * response onto a different response. Any redirect or 401 the gate returns
 * must carry them: Supabase refresh tokens are single-use, so dropping a
 * freshly rotated cookie would sign the user out on their next request. */
export function withSessionCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
