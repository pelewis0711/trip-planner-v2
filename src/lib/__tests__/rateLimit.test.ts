import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  FixedWindowLimiter,
  GEOCODE_GLOBAL_LIMITER,
  GEOCODE_IP_LIMITER,
  PRICING_LIMITER,
  clientIp,
  tooManyRequests,
} from "../rateLimit";

// The window logic takes an injectable `now`, so all of this is real assertions
// on real behaviour -- no fake timers, no sleeping.

const MINUTE = 60_000;

describe("FixedWindowLimiter: allowing and blocking", () => {
  it("allows exactly `limit` requests, then blocks", () => {
    const limiter = new FixedWindowLimiter(3, MINUTE);
    const t = 1_000_000;

    expect(limiter.check("ip", t).allowed).toBe(true);
    expect(limiter.check("ip", t).allowed).toBe(true);
    expect(limiter.check("ip", t).allowed).toBe(true);
    expect(limiter.check("ip", t).allowed).toBe(false);
  });

  it("counts down `remaining` and reports 0 once blocked", () => {
    const limiter = new FixedWindowLimiter(3, MINUTE);
    const t = 1_000_000;

    expect(limiter.check("ip", t).remaining).toBe(2);
    expect(limiter.check("ip", t).remaining).toBe(1);
    expect(limiter.check("ip", t).remaining).toBe(0);
    expect(limiter.check("ip", t).remaining).toBe(0); // blocked, not negative
  });

  it("keeps blocking for the rest of the window, not just the first over-limit call", () => {
    const limiter = new FixedWindowLimiter(2, MINUTE);
    const t = 1_000_000;

    limiter.check("ip", t);
    limiter.check("ip", t);
    expect(limiter.check("ip", t + 1_000).allowed).toBe(false);
    expect(limiter.check("ip", t + 30_000).allowed).toBe(false);
    expect(limiter.check("ip", t + MINUTE - 1).allowed).toBe(false);
  });
});

describe("FixedWindowLimiter: window rollover", () => {
  it("starts a fresh allowance once the window elapses", () => {
    const limiter = new FixedWindowLimiter(2, MINUTE);
    const t = 1_000_000;

    limiter.check("ip", t);
    limiter.check("ip", t);
    expect(limiter.check("ip", t).allowed).toBe(false);

    expect(limiter.check("ip", t + MINUTE).allowed).toBe(true);
    expect(limiter.check("ip", t + MINUTE).allowed).toBe(true);
    expect(limiter.check("ip", t + MINUTE).allowed).toBe(false);
  });

  it("does not roll over one millisecond early", () => {
    const limiter = new FixedWindowLimiter(1, MINUTE);
    const t = 1_000_000;

    limiter.check("ip", t);
    expect(limiter.check("ip", t + MINUTE - 1).allowed).toBe(false);
    expect(limiter.check("ip", t + MINUTE).allowed).toBe(true);
  });

  // A fixed window measures from the first request in the window, not from a
  // wall-clock boundary -- worth locking in, since it's the behaviour that
  // makes the burst maths on the Itinerary page work out.
  it("measures the window from the first request, not from a clock boundary", () => {
    const limiter = new FixedWindowLimiter(2, MINUTE);

    limiter.check("ip", 1_000_500); // window runs 1_000_500 -> 1_060_500
    limiter.check("ip", 1_030_000);
    expect(limiter.check("ip", 1_060_499).allowed).toBe(false);
    expect(limiter.check("ip", 1_060_500).allowed).toBe(true);
  });
});

describe("FixedWindowLimiter: key isolation", () => {
  it("tracks each key independently", () => {
    const limiter = new FixedWindowLimiter(1, MINUTE);
    const t = 1_000_000;

    expect(limiter.check("1.1.1.1", t).allowed).toBe(true);
    expect(limiter.check("1.1.1.1", t).allowed).toBe(false);
    expect(limiter.check("2.2.2.2", t).allowed).toBe(true);
  });

  it("one blocked caller does not consume another's allowance", () => {
    const limiter = new FixedWindowLimiter(2, MINUTE);
    const t = 1_000_000;

    for (let i = 0; i < 10; i++) limiter.check("noisy", t);
    expect(limiter.check("quiet", t).allowed).toBe(true);
    expect(limiter.check("quiet", t).allowed).toBe(true);
    expect(limiter.check("quiet", t).allowed).toBe(false);
  });
});

describe("FixedWindowLimiter: retryAfterSeconds", () => {
  it("reports whole seconds until the window resets", () => {
    const limiter = new FixedWindowLimiter(1, MINUTE);
    const t = 1_000_000;

    limiter.check("ip", t);
    expect(limiter.check("ip", t).retryAfterSeconds).toBe(60);
    expect(limiter.check("ip", t + 30_000).retryAfterSeconds).toBe(30);
  });

  it("never returns 0, which would invite an instant pointless retry", () => {
    const limiter = new FixedWindowLimiter(1, MINUTE);
    const t = 1_000_000;

    limiter.check("ip", t);
    expect(limiter.check("ip", t + MINUTE - 1).retryAfterSeconds).toBe(1);
  });

  it("reports a resetAt that matches the window it started", () => {
    const limiter = new FixedWindowLimiter(5, MINUTE);
    const t = 1_000_000;
    expect(limiter.check("ip", t).resetAt).toBe(t + MINUTE);
    expect(limiter.check("ip", t + 10_000).resetAt).toBe(t + MINUTE);
  });
});

describe("configured limits match what was agreed", () => {
  // The Itinerary page fires one request per flight leg on mount, so a full
  // multi-city plan can burst 20-40 at once. 60/min leaves real headroom; a
  // tighter cap would 429 a legitimate page load.
  it("pricing routes allow 60 per minute", () => {
    expect(PRICING_LIMITER.limit).toBe(60);
    expect(PRICING_LIMITER.windowMs).toBe(MINUTE);
  });

  it("geocode is tighter per IP than the pricing routes", () => {
    expect(GEOCODE_IP_LIMITER.limit).toBe(6);
    expect(GEOCODE_IP_LIMITER.limit).toBeLessThan(PRICING_LIMITER.limit);
  });

  // Nominatim's policy is ~1 request/second against our server's IP. 30/min is
  // one per 2s, comfortably inside it.
  it("the global geocode cap stays inside Nominatim's ~1/sec policy", () => {
    expect(GEOCODE_GLOBAL_LIMITER.limit).toBe(30);
    const perSecond = GEOCODE_GLOBAL_LIMITER.limit / (GEOCODE_GLOBAL_LIMITER.windowMs / 1000);
    expect(perSecond).toBeLessThanOrEqual(1);
  });

  it("the global cap can still be reached by several IPs that are each within their own limit", () => {
    // This is the gap the global limiter exists to close: 6 IPs x 6 requests
    // each is 36 -- every caller compliant, the aggregate over policy.
    const perIp = new FixedWindowLimiter(6, MINUTE);
    const global = new FixedWindowLimiter(30, MINUTE);
    const t = 1_000_000;

    let blockedByGlobal = 0;
    for (let ip = 0; ip < 6; ip++) {
      for (let i = 0; i < 6; i++) {
        const ok = perIp.check(`ip-${ip}`, t).allowed;
        expect(ok).toBe(true); // nobody exceeds their own per-IP budget
        if (!global.check("__global__", t).allowed) blockedByGlobal++;
      }
    }
    expect(blockedByGlobal).toBe(6); // 36 attempted, 30 allowed
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    ({ headers: new Headers(headers) }) as unknown as NextRequest;

  it("takes the first entry of x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }))).toBe(
      "203.0.113.7"
    );
  });

  it("trims whitespace and handles a single value", () => {
    expect(clientIp(req({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to a shared bucket rather than failing open when no header exists", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("ignores an empty x-forwarded-for instead of returning an empty key", () => {
    expect(clientIp(req({ "x-forwarded-for": "", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });
});

describe("tooManyRequests response", () => {
  it("is a 429 with a Retry-After header", () => {
    const res = tooManyRequests({ allowed: false, remaining: 0, resetAt: 0, retryAfterSeconds: 42 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("leaks nothing about limits, windows, or the upstream provider", async () => {
    const res = tooManyRequests({ allowed: false, remaining: 0, resetAt: 0, retryAfterSeconds: 42 });
    const body = JSON.stringify(await res.json()).toLowerCase();
    for (const leak of ["nominatim", "travelpayouts", "supabase", "quota", "60", "per minute"]) {
      expect(body).not.toContain(leak);
    }
  });
});
