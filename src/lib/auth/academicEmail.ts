// ===========================================================================
// THE DATABASE IS THE REAL GATE. THIS FILE ONLY PICKS THE ERROR MESSAGE.
//
// supabase/migrations/0012_require_academic_email.sql rejects every new
// auth.users row whose email isn't a university address -- a BEFORE INSERT
// trigger that calling the Supabase API directly can't get around, plus a
// Before User Created auth hook that returns a readable reason. Nothing in this
// file can let a bad signup through or keep a good one out. It exists so the
// login page can say "use your university email" before a round trip, and turn
// the rejections that do come back into real copy instead of "Database error".
//
// isAcademicEmail() must stay rule-for-rule identical to
// public.is_academic_email() in that migration. academicEmail.test.ts checks
// the rule, and fails if the bundled fallback list or the domain regex drifts
// from the migration.
// ===========================================================================

import { createClient } from "@/lib/supabase/client";
import { ACADEMIC_DOMAINS } from "@/data/academicDomains";

/** Bundled fallback patterns, used when the academic_domains fetch fails. */
export const ACADEMIC_DOMAIN_PATTERNS: readonly string[] = ACADEMIC_DOMAINS.map(([pattern]) => pattern);

/** Same six characters as the SQL's btrim(): space, \t, \n, \v, \f, \r. String.prototype.trim()
 * also strips Unicode spaces, which Postgres wouldn't -- so it isn't used here. */
const EDGE_WHITESPACE = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g;

/** ASCII hostname with at least two labels. Checked BEFORE lowercasing so the
 * JS and Postgres rules agree on every input (some non-ASCII characters
 * lowercase to ASCII in one and not the other). Also what rejects `x@edu`:
 * a bare suffix isn't a school. Must match DOMAIN_REGEX in the migration. */
export const DOMAIN_SHAPE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Shape a pattern must have -- mirrors the academic_domains CHECK constraint. */
export const PATTERN_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** Everything after the LAST `@`, lowercased -- or null for null, empty, or
 * malformed input (no `@`, nothing before it, or a domain that isn't a
 * two-plus-label ASCII hostname). */
export function emailDomain(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const s = email.replace(EDGE_WHITESPACE, "");
  const at = s.lastIndexOf("@");
  if (at <= 0) return null;
  const domain = s.slice(at + 1);
  if (!DOMAIN_SHAPE.test(domain)) return null;
  return domain.toLowerCase();
}

/** The one matching rule: the domain IS the pattern, or is a subdomain of it.
 * The leading dot in `"." + pattern` is what keeps `notuva.nl` from matching
 * `uva.nl`, and `illinois.edu.attacker.com` from matching `edu`. */
export function matchesAcademicPattern(domain: string, pattern: string): boolean {
  return domain === pattern || domain.endsWith("." + pattern);
}

export function isAcademicEmail(
  email: string | null | undefined,
  patterns: readonly string[] = ACADEMIC_DOMAIN_PATTERNS
): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return patterns.some((pattern) => matchesAcademicPattern(domain, pattern));
}

let sessionPatterns: Promise<readonly string[]> | null = null;

/** The live pattern list from academic_domains, fetched once per session.
 * Falls back to the bundled copy if the fetch fails or comes back empty -- and
 * doesn't cache that failure, so the next call tries the network again. */
export function loadAcademicPatterns(): Promise<readonly string[]> {
  sessionPatterns ??= fetchAcademicPatterns().then((patterns) => {
    if (patterns) return patterns;
    sessionPatterns = null;
    return ACADEMIC_DOMAIN_PATTERNS;
  });
  return sessionPatterns;
}

async function fetchAcademicPatterns(): Promise<string[] | null> {
  try {
    const { data, error } = await createClient().from("academic_domains").select("pattern");
    if (error || !data || data.length === 0) return null;
    return (data as { pattern: string }[]).map((row) => row.pattern);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Turning a Supabase rejection into real copy.
// ---------------------------------------------------------------------------

/** Literal token in both the trigger's exception and the hook's error message. */
export const NOT_ACADEMIC_TOKEN = "SEMESTERLY_NOT_ACADEMIC_EMAIL";

/** What Supabase Auth says when ANY database error stops a new-user insert --
 * including the trigger, which it doesn't pass through. Only the hook's message
 * survives the trip, so this alone can't prove the email was the problem. */
const NEW_USER_DB_ERROR = "Database error saving new user";

/** `not_academic`: definitely the school-email rule (the hook's tagged message).
 * `signup_failed`: a new account couldn't be saved -- almost always the trigger,
 * but Supabase doesn't say, so the copy hedges. */
export type SignupRejection = "not_academic" | "signup_failed";

export function classifySignupError(message: string | null | undefined): SignupRejection | null {
  if (!message) return null;
  if (message.includes(NOT_ACADEMIC_TOKEN)) return "not_academic";
  if (message.includes(NEW_USER_DB_ERROR)) return "signup_failed";
  return null;
}

export const SUPPORT_EMAIL = "pel4@illinois.edu";

export const NOT_ACADEMIC_MESSAGE =
  "Semesterly is for students. Use your university email address — usually the one ending in .edu, or your school's equivalent.";

export const SIGNUP_FAILED_MESSAGE =
  "We couldn't create your account. New Semesterly accounts need a university email address — usually the one ending in .edu, or your school's equivalent.";
