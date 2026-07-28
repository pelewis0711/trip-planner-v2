import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// ===========================================================================
// SERVER-ONLY. NEVER IMPORT THIS FILE FROM A CLIENT COMPONENT.
//
// SUPABASE_SERVICE_ROLE_KEY BYPASSES ROW LEVEL SECURITY COMPLETELY. Anyone
// holding it can read, change, or delete every row in every table -- including
// every user's email address -- no matter what policy is on it. It is a
// database password, not an API key.
//
// Consequently:
//   * NEVER rename it to NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY. Next.js inlines
//     every NEXT_PUBLIC_* variable into the browser bundle as a literal string,
//     which would publish it to every visitor, permanently, on the next deploy.
//   * NEVER import this module from a file with "use client", or from anything
//     a client component imports. It belongs to route handlers and other
//     server-only code. `src/lib/supabase/server.ts` (anon key + the user's
//     cookies, RLS enforced) is the right client for everything else.
//   * Prefer the narrowest thing that works. This client exists to write the
//     two shared price-cache tables from the API routes after
//     supabase/migrations/0010_revoke_anon_cache_writes.sql removed the anon
//     write grant -- not as a general-purpose "make the error go away" client.
//
// src/lib/supabase/__tests__/service-boundary.test.ts enforces the import rules
// above by scanning the source tree, so a violation fails the test suite rather
// than shipping.
// ===========================================================================

/** Supabase client authenticated as the service role. Bypasses RLS -- read the
 * banner above before using it anywhere new.
 *
 * Throws if the environment isn't configured, rather than silently falling back
 * to a weaker client: a caller that quietly degraded to the anon key would now
 * fail its write against the revoked grant, and the resulting error would point
 * at the database instead of at the missing variable. */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createServiceClient() needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local locally, and to the Vercel project's " +
        "environment variables for deploys (see .env.example)."
    );
  }

  // No session persistence or token refresh: this client is created per request
  // on the server and authenticates purely by the key, so there is no user
  // session to keep and nothing that should be written to any store.
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Whether the service client can be constructed. Lets a route return a clean
 * "not configured" response instead of throwing. */
export function hasServiceCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
