// ===========================================================================
// WHO CAN USE THE APP: SIGNED-IN USERS ONLY.
//
// src/proxy.ts calls gateDecision() on every request it sees; this file is the
// whole policy, kept free of Next.js imports so it can be tested as a plain
// function (gate.test.ts). The university-email rule on WHO may sign up lives
// in supabase/migrations/0012_require_academic_email.sql -- this file only
// decides what a request with or without a session may reach.
//
// Proxy is the front door, not the only lock: the API routes check the user
// again themselves, and Row Level Security guards the data underneath both.
// ===========================================================================

/** Reachable with no session. ADDING A ROUTE HERE IS A DELIBERATE DECISION TO
 * MAKE IT PUBLIC, NOT HOUSEKEEPING -- it opens that route to anyone on the
 * internet. Each entry matches itself and anything under it (`/shared` covers
 * `/shared/abc123`), never a bare string prefix (`/sharedsomething` stays
 * gated). See CLAUDE.md, "Who can use the app". */
export const PUBLIC_ROUTES = [
  "/welcome", // the signed-out front door
  "/login", // where you sign in
  "/auth/callback", // magic links and Google land here before a session exists
  "/privacy", // what we store -- readable before you hand over an email
  "/shared", // public view-share links (Phase 2); collab links still ask you to sign in
  // PWA and static assets: the browser fetches these without a page around them,
  // and a redirect in place of the service worker or manifest breaks install.
  "/sw.js",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/manifest-icon",
  "/favicon.ico",
  "/_next",
  "/trips", // trip photos
] as const;

/** JSON body for a signed-out API call (proxy and the routes themselves). */
export const SIGN_IN_REQUIRED = "Sign in to use Semesterly.";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Pages that must never be a post-sign-in destination: sending someone to
 * the front door after signing in is how a redirect loop starts. */
function isFrontDoor(pathname: string): boolean {
  return pathname === "/welcome" || pathname === "/login" || pathname.startsWith("/auth/");
}

const SAFE_BASE = "http://semesterly.invalid";

/** A `?next=` value made safe to redirect to: a path on this site, never a
 * front-door page, else "/". Resolving against a throwaway origin is what
 * catches the tricks a string check misses -- `//evil.com`, `/\evil.com`, or a
 * tab/newline the URL parser silently drops (`/\t/evil.com` -> `//evil.com`)
 * all resolve to a different origin. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(value, SAFE_BASE);
  } catch {
    return "/";
  }
  if (url.origin !== SAFE_BASE || isFrontDoor(url.pathname)) return "/";
  return url.pathname + url.search + url.hash;
}

export type GateDecision =
  | { type: "allow" }
  | { type: "redirect"; location: string }
  | { type: "unauthorized" };

/** What the proxy does with one request. `url` is the request URL (Next has
 * already resolved any `..`/`%2e%2e` segments by the time it gets here). */
export function gateDecision(url: URL, signedIn: boolean): GateDecision {
  const { pathname } = url;

  if (signedIn) {
    // A signed-in visitor has no business on the front door -- send them on
    // to wherever they were headed. (/login does the same client-side.)
    if (pathname === "/welcome") {
      return { type: "redirect", location: safeNext(url.searchParams.get("next")) };
    }
    return { type: "allow" };
  }

  if (isPublicPath(pathname)) return { type: "allow" };

  // An API caller expects JSON: a redirect would hand fetch() an HTML page and
  // surface as a baffling JSON parse error instead of an auth error.
  if (isApiPath(pathname)) return { type: "unauthorized" };

  // Remember where they were going. `_rsc` is Next's internal client-router
  // cache key, not part of the address anyone typed.
  const target = new URL(url.href);
  target.searchParams.delete("_rsc");
  const welcome = new URLSearchParams({ next: target.pathname + target.search });
  return { type: "redirect", location: `/welcome?${welcome}` };
}
