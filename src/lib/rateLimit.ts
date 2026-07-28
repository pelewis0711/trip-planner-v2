import { NextResponse, type NextRequest } from "next/server";

// ===========================================================================
// In-memory fixed-window rate limiting for the three public API routes.
//
// !! PER-INSTANCE, THEREFORE APPROXIMATE ON VERCEL. !!
//
// The counters live in this module's memory. Vercel runs serverless functions
// across multiple instances and recycles them freely, so:
//   * two requests from the same IP can land on different instances and each
//     get their own fresh counter -- the real ceiling is roughly
//     (limit x number of warm instances), not (limit);
//   * a cold start resets every counter to zero;
//   * an idle instance is torn down and its counts vanish.
//
// This is a deliberate trade for a sub-100-user, friends-of-friends app: it
// costs nothing, adds no dependency, and reliably stops the thing actually
// worth stopping -- someone looping a route in a shell script. It is NOT a
// security control and won't stop a determined, distributed attacker.
//
// UPGRADE PATH, when this stops being enough (roughly: real public traffic, or
// the first time abuse actually costs money): swap the storage in
// FixedWindowLimiter.check() for a shared atomic counter -- Upstash Redis
// (`@upstash/ratelimit`, works on serverless over HTTP) or Vercel KV are the
// usual choices. Every call site here stays the same; only this file changes,
// which is why the routes never touch the Map directly.
//
// A note on what per-IP limiting does and does not protect (see the geocode
// route): it bounds each *caller*, not the total outbound rate from this
// server. Nominatim bans by our server's IP, so the per-IP limiter alone can't
// bound what they see -- that's what GEOCODE_GLOBAL_LIMITER is for.
// ===========================================================================

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  /** Whole seconds until the window resets, min 1. For the Retry-After header. */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/** Stop the Map growing without bound on a long-lived instance. Sweeping only
 * when the map gets large keeps the common path allocation-free. */
const SWEEP_THRESHOLD = 5_000;

export class FixedWindowLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number
  ) {}

  /** `now` is injectable so the window logic is testable without fake timers. */
  check(key: string, now: number = Date.now()): RateLimitResult {
    if (this.buckets.size > SWEEP_THRESHOLD) this.sweep(now);

    const existing = this.buckets.get(key);
    const bucket =
      existing && now - existing.windowStart < this.windowMs
        ? existing
        : { count: 0, windowStart: now };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const resetAt = bucket.windowStart + this.windowMs;
    const allowed = bucket.count <= this.limit;

    return {
      allowed,
      remaining: allowed ? this.limit - bucket.count : 0,
      resetAt,
      // ceil, floored at 1: a Retry-After of 0 invites an instant retry that
      // would just be rejected again.
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  /** Drop buckets whose window has already elapsed. */
  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) this.buckets.delete(key);
    }
  }

  /** Test seam -- lets a test start from a known-empty state. */
  reset(): void {
    this.buckets.clear();
  }
}

const MINUTE = 60_000;

/** Live flight + hotel price lookups, per IP.
 *
 * Sized deliberately high: the Itinerary page fetches one price per flight leg
 * on mount, so a well-populated 16-slot plan can fire 20-40 requests in a
 * single burst. A tighter cap would 429 real users mid-page-load. The
 * Travelpayouts quota is not what this protects -- ordinary requests are served
 * from the 24h Postgres cache and never reach the provider. The quota is
 * protected by that cache plus the signed-in-only gate on ?refresh=1. */
export const PRICING_LIMITER = new FixedWindowLimiter(60, MINUTE);

/** Forced cache refreshes (?refresh=1), keyed by USER ID rather than IP.
 *
 * Signing in is a weak barrier on its own, because signup is open -- so the
 * signed-in-only gate stops drive-by anonymous abuse but not someone willing to
 * make an account. Without this, one account could spend 60 real upstream calls
 * a minute (3,600/hour against a free tier), since every ?refresh=1 bypasses
 * the 24h Postgres cache by design.
 *
 * Keyed per account, not per IP, so it can't be sidestepped by changing
 * networks; the remaining way around it is registering more accounts, which at
 * 5/min each is a far worse deal than the 60/min this replaces. Five a minute
 * is well above what a human clicking a refresh button ever needs. */
export const REFRESH_LIMITER = new FixedWindowLimiter(5, MINUTE);

/** Geocode, per IP. Legitimate use is rare -- lookupCity() only reaches the
 * network for a city absent from the bundled 145-city dataset, and only on an
 * explicit button press -- so a tight cap costs real users nothing. */
export const GEOCODE_IP_LIMITER = new FixedWindowLimiter(6, MINUTE);

/** Geocode, across all callers on this instance.
 *
 * Nominatim's usage policy limits our *server's* IP, so a per-IP cap can't
 * bound what they actually see: twenty visitors at 6/min each is 120/min from
 * one address. This caps total outbound geocoding at ~1 request per 2 seconds,
 * comfortably inside Nominatim's ~1/second ceiling. Per-instance, so the same
 * approximation caveat at the top of this file applies -- but it turns "no
 * aggregate bound at all" into "a bound per instance", which is the difference
 * that matters for not getting banned. */
export const GEOCODE_GLOBAL_LIMITER = new FixedWindowLimiter(30, MINUTE);

/** Fixed key for the global limiter -- one shared bucket, not per-caller. */
export const GLOBAL_KEY = "__global__";

/** Best-effort client IP.
 *
 * NextRequest.ip was removed in Next 15 (this app is on 16.x), so this reads
 * the forwarding headers Vercel sets. x-forwarded-for is a comma-separated
 * chain, client first. Falls back to a single shared bucket rather than
 * failing open, so a request with no usable header still counts against
 * something. Note this header is client-controllable when not behind a proxy
 * that overwrites it -- fine here, since Vercel does overwrite it, and since
 * this limiter is abuse-dampening rather than a security boundary. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 429 response. The message is deliberately plain: it names no limit, window,
 * quota, or upstream provider, so it gives a prober nothing to tune against. */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    }
  );
}
