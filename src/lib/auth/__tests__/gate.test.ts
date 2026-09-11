import { describe, expect, it } from "vitest";
import { gateDecision, isPublicPath, safeNext, PUBLIC_ROUTES } from "@/lib/auth/gate";

// The sign-in gate's whole policy (src/proxy.ts just applies it). If one of
// these fails, the app is either locking people out or letting them in.

const BASE = "https://trip-planner-v2-gamma.vercel.app";
const decide = (path: string, signedIn: boolean) => gateDecision(new URL(path, BASE), signedIn);

/** For a redirect, where it points: pathname plus the decoded ?next=. */
function redirectTarget(path: string, signedIn: boolean) {
  const d = decide(path, signedIn);
  if (d.type !== "redirect") throw new Error(`expected a redirect for ${path}, got ${d.type}`);
  const url = new URL(d.location, BASE);
  return { pathname: url.pathname, next: url.searchParams.get("next") };
}

const PUBLIC_PAGES = ["/welcome", "/login", "/auth/callback", "/privacy", "/shared/abc123"];
const ASSETS = [
  "/sw.js",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/manifest-icon/192",
  "/manifest-icon/512-maskable",
  "/favicon.ico",
  "/_next/static/chunks/app.js",
  "/trips/rome.jpg",
];
const APP_PAGES = ["/", "/catalog", "/calendar", "/itinerary", "/plans", "/settings", "/onboarding"];
const APIS = ["/api/flights/price?origin=PRG&destination=FCO&date=2027-03-12", "/api/hotels/price", "/api/geocode?q=lyon"];

describe("signed out", () => {
  it("sends / to /welcome?next=/", () => {
    expect(redirectTarget("/", false)).toEqual({ pathname: "/welcome", next: "/" });
  });

  it("sends a deep link to /welcome, remembering it", () => {
    expect(redirectTarget("/calendar", false)).toEqual({ pathname: "/welcome", next: "/calendar" });
    expect(redirectTarget("/catalog?q=rome", false)).toEqual({ pathname: "/welcome", next: "/catalog?q=rome" });
  });

  it("drops Next's internal _rsc cache key from next=", () => {
    expect(redirectTarget("/calendar?_rsc=abc123", false).next).toBe("/calendar");
  });

  it.each(APP_PAGES)("gates %s", (path) => {
    expect(redirectTarget(path, false).pathname).toBe("/welcome");
  });

  it.each([...PUBLIC_PAGES, ...ASSETS])("allows %s", (path) => {
    expect(decide(path, false)).toEqual({ type: "allow" });
  });

  it.each(APIS)("answers %s with a 401, not a redirect", (path) => {
    expect(decide(path, false)).toEqual({ type: "unauthorized" });
  });

  it("treats each public route as a whole path segment, not a string prefix", () => {
    // The case that matters: a sloppy startsWith("/shared") would make these public.
    expect(redirectTarget("/sharedsomething", false).pathname).toBe("/welcome");
    expect(redirectTarget("/shared-plans", false).pathname).toBe("/welcome");
    expect(redirectTarget("/welcome-back", false).pathname).toBe("/welcome");
    expect(redirectTarget("/loginx", false).pathname).toBe("/welcome");
    expect(redirectTarget("/privacyx", false).pathname).toBe("/welcome");
    expect(redirectTarget("/iconic", false).pathname).toBe("/welcome");
    expect(redirectTarget("/apiary", false).pathname).toBe("/welcome"); // not an API path either
  });

  it("can't climb out of a public route with .. segments", () => {
    // URL parsing resolves these before the gate ever sees them.
    expect(redirectTarget("/shared/../calendar", false)).toEqual({ pathname: "/welcome", next: "/calendar" });
    expect(redirectTarget("/shared/%2e%2e/calendar", false)).toEqual({ pathname: "/welcome", next: "/calendar" });
  });

  it("never redirects a public page to itself (no loop)", () => {
    for (const path of ["/welcome", "/welcome?next=/welcome", "/login", "/login?next=/login"]) {
      expect(decide(path, false)).toEqual({ type: "allow" });
    }
  });
});

describe("signed in", () => {
  it.each([...APP_PAGES, ...PUBLIC_PAGES.filter((p) => p !== "/welcome"), ...ASSETS, ...APIS])(
    "allows %s",
    (path) => {
      expect(decide(path, true)).toEqual({ type: "allow" });
    }
  );

  it("sends /welcome on into the app", () => {
    expect(redirectTarget("/welcome", true).pathname).toBe("/");
    expect(redirectTarget(`/welcome?next=${encodeURIComponent("/calendar?x=1")}`, true)).toEqual({
      pathname: "/calendar",
      next: null,
    });
  });

  it("won't follow /welcome's next= off-site or back to the front door", () => {
    for (const next of ["//evil.com", "https://evil.com", "/welcome", "/login?next=/x", "/auth/callback"]) {
      expect(redirectTarget(`/welcome?next=${encodeURIComponent(next)}`, true).pathname).toBe("/");
    }
  });
});

describe("safeNext", () => {
  it("keeps a real path on this site", () => {
    expect(safeNext("/calendar")).toBe("/calendar");
    expect(safeNext("/catalog?q=rome#top")).toBe("/catalog?q=rome#top");
    expect(safeNext("/shared/abc123")).toBe("/shared/abc123");
  });

  it.each([
    null,
    undefined,
    "",
    "calendar", // relative
    "//evil.com", // protocol-relative
    "/\\evil.com", // backslash reads as a slash
    "/\t/evil.com", // the URL parser drops the tab, leaving //evil.com
    "/\n/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/welcome",
    "/login?next=/calendar",
    "/auth/callback?code=x",
  ])("falls back to / for %j", (value) => {
    expect(safeNext(value)).toBe("/");
  });
});

describe("PUBLIC_ROUTES", () => {
  it("is exactly the agreed allowlist -- change this test only on purpose", () => {
    expect([...PUBLIC_ROUTES].sort()).toEqual(
      [
        "/welcome",
        "/login",
        "/auth/callback",
        "/privacy",
        "/shared",
        "/sw.js",
        "/manifest.webmanifest",
        "/icon",
        "/apple-icon",
        "/manifest-icon",
        "/favicon.ico",
        "/_next",
        "/trips",
      ].sort()
    );
  });

  it("isPublicPath matches each route and its children only", () => {
    expect(isPublicPath("/shared")).toBe(true);
    expect(isPublicPath("/shared/x/y")).toBe(true);
    expect(isPublicPath("/sharedx")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
