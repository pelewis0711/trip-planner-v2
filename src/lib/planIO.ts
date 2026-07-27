// JSON export/import for sharing plans — matches v1's file format exactly
// (reference-v1-app.html:1777-1786, 1961-1971) so exported v1 plan files
// import cleanly here, and vice versa.
//
// Imported files are untrusted input (a friend's plan.json, or anything a
// browser's file picker will happily accept regardless of where it really
// came from) -- everything below validates structure, caps size, and
// strips dangerous object keys before any of it reaches real app state.
import type { Plan } from "@/lib/store/plan";
import type { Placement, Placements, SlotActuals, Stop } from "@/lib/calc/types";

export function downloadPlanJson(plan: Plan) {
  const text = JSON.stringify({ kind: "study-abroad-plan", version: 2, plan }, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${(plan.name || "plan").replace(/[^\w-]+/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// Generous for a real plan export (normally a few KB to low hundreds of KB
// for a plan with every slot filled) while still ruling out someone handing
// the file picker a multi-megabyte file to chew on.
const MAX_IMPORT_CHARS = 2_000_000;
// Caps below are deliberately generous relative to any real plan (16-40
// calendar slots, a handful of stops each) -- they exist to bound a
// maliciously-crafted file, not to constrain normal use.
const MAX_PLANS_PER_IMPORT = 50;
const MAX_SLOTS_PER_PLAN = 300;
const MAX_STOPS_PER_SLOT = 20;

// Keys that can trigger prototype pollution if used as a plain object's
// property name via bracket assignment (obj[key] = ...) -- rejected
// wherever an imported file supplies an object key we're about to use,
// not just at the top level (a slot id inside `placements` is exactly as
// attacker-controlled as a top-level field name).
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => !DANGEROUS_KEYS.has(k));
}

function sanitizeStop(v: unknown): Stop | null {
  if (!isPlainObject(v)) return null;
  if (typeof v.tripId !== "string" || !v.tripId || v.tripId.length > 200) return null;
  if (typeof v.nights !== "number" || !Number.isFinite(v.nights) || v.nights < 0 || v.nights > 30) return null;
  const act = Array.isArray(v.act) ? v.act.filter((x): x is boolean => typeof x === "boolean").slice(0, 100) : [];
  const sig = Array.isArray(v.sig) ? v.sig.filter((x): x is boolean => typeof x === "boolean").slice(0, 100) : [];
  const l = typeof v.l === "number" && Number.isFinite(v.l) ? Math.max(0, Math.min(3, Math.trunc(v.l))) : 0;
  const fd = typeof v.fd === "number" && Number.isFinite(v.fd) ? Math.max(0, Math.min(2, Math.trunc(v.fd))) : 0;
  return { tripId: v.tripId, nights: v.nights, act, sig, l, fd };
}

function sanitizeActual(v: unknown): SlotActuals | undefined {
  if (!isPlainObject(v)) return undefined;
  const actual: SlotActuals = {};
  for (const key of ["tr", "lo", "fo", "ac"] as const) {
    const val = v[key];
    if (val === null) actual[key] = null;
    else if (typeof val === "number" && Number.isFinite(val)) actual[key] = val;
  }
  return actual;
}

function sanitizePlacement(v: unknown): Placement | null {
  if (!isPlainObject(v)) return null;
  const stopsRaw = Array.isArray(v.stops) ? v.stops : [];
  const stops = stopsRaw
    .map(sanitizeStop)
    .filter((s): s is Stop => s !== null)
    .slice(0, MAX_STOPS_PER_SLOT);
  const placement: Placement = { stops };
  if (typeof v.travelers === "number" && Number.isFinite(v.travelers) && v.travelers > 0 && v.travelers <= 50) {
    placement.travelers = Math.trunc(v.travelers);
  }
  const actual = sanitizeActual(v.actual);
  if (actual) placement.actual = actual;
  return placement;
}

export function sanitizePlacements(v: unknown): Placements {
  if (!isPlainObject(v)) return {};
  const out: Placements = {};
  let count = 0;
  for (const key of safeKeys(v)) {
    if (count >= MAX_SLOTS_PER_PLAN) break;
    if (key.length > 100) continue;
    const placement = sanitizePlacement(v[key]);
    if (placement) {
      out[key] = placement;
      count++;
    }
  }
  return out;
}

function sanitizeIncomingPlan(pl: unknown): Partial<Plan> {
  if (!isPlainObject(pl)) return { placements: {} };
  const out: Partial<Plan> = { placements: sanitizePlacements(pl.placements) };
  if (typeof pl.name === "string") out.name = pl.name.slice(0, 200);
  if (typeof pl.home === "string" && pl.home.length <= 100) out.home = pl.home;
  if (pl.bag === "none" || pl.bag === "cabin" || pl.bag === "checked") out.bag = pl.bag;
  if (typeof pl.budget === "number" && Number.isFinite(pl.budget) && pl.budget >= 0) out.budget = pl.budget;
  return out;
}

/** Parses and validates an imported plan-export file. Throws a plain Error
 * with a short, user-showable message on anything malformed -- the caller
 * shows that message instead of crashing or importing garbage. Never
 * throws on a structurally-odd-but-not-malicious file; unknown/extra
 * fields are just dropped rather than rejected outright, so old v1 exports
 * and future format additions both still import what they can. */
export function parsePlanFile(text: string): Partial<Plan>[] {
  if (text.length > MAX_IMPORT_CHARS) {
    throw new Error("That file is too large to be a plan export.");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!isPlainObject(data)) {
    throw new Error("That doesn't look like a plan file.");
  }

  const rawPlans: unknown[] = isPlainObject(data.plan)
    ? [data.plan]
    : Array.isArray(data.plans)
      ? data.plans
      : [];

  if (!rawPlans.length) {
    throw new Error("That doesn't look like a plan file.");
  }

  return rawPlans.slice(0, MAX_PLANS_PER_IMPORT).map(sanitizeIncomingPlan);
}
