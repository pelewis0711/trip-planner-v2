// Direct port of v1's travel routing (reference-v1-app.html:1038-1063).
// The 0.028 flight and 0.11 rail/bus constants are calibrated against real
// European budget fares — do not "fix" them upward.

export type LegMode = "local" | "train/bus" | "flight";

export interface LegEstimate {
  cost: number;
  mode: LegMode;
  km: number;
}

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// One-way estimate between two coordinates; mode auto-chosen by distance.
export function legEstimate(
  ca: [number, number] | undefined,
  cb: [number, number] | undefined
): LegEstimate {
  if (!ca || !cb) return { cost: 60, mode: "flight", km: 0 };
  const d = haversine(ca, cb);
  let cost: number;
  let mode: LegMode;
  if (d <= 60) {
    mode = "local";
    cost = 0;
  } else if (d <= 350) {
    mode = "train/bus";
    cost = Math.max(14, Math.round(0.11 * d));
  } else {
    mode = "flight";
    cost = Math.max(40, Math.round(35 + 0.028 * d));
  }
  return { cost, mode, km: Math.round(d) };
}

export interface RouteLeg extends LegEstimate {
  from: string;
  to: string;
  kind: "out" | "inter" | "back";
}

export interface RouteStop {
  tripId: string;
}

// HOME -> stop 1 -> stop 2 -> ... -> HOME
export function routeLegs(
  stops: RouteStop[],
  homeName: string,
  homeCoord: [number, number],
  coordsOf: (tripId: string) => [number, number] | undefined,
  nameOf: (tripId: string) => string
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  if (!stops || !stops.length) return legs;
  const first = stops[0].tripId;
  const last = stops[stops.length - 1].tripId;

  let e = legEstimate(homeCoord, coordsOf(first));
  legs.push({ from: homeName, to: nameOf(first), ...e, kind: "out" });

  for (let i = 1; i < stops.length; i++) {
    const ic = legEstimate(coordsOf(stops[i - 1].tripId), coordsOf(stops[i].tripId));
    legs.push({
      from: nameOf(stops[i - 1].tripId),
      to: nameOf(stops[i].tripId),
      ...ic,
      kind: "inter",
    });
  }

  e = legEstimate(coordsOf(last), homeCoord);
  legs.push({ from: nameOf(last), to: homeName, ...e, kind: "back" });

  return legs;
}

// Travel time from home to a trip, used by the "travel time from home" filter.
// Dynamic — recomputed for whatever home city is selected.
export function travelHours(
  tripId: string,
  homeCoord: [number, number],
  coordsOf: (tripId: string) => [number, number] | undefined
): number {
  const e = legEstimate(homeCoord, coordsOf(tripId));
  if (e.mode === "local") return 0.5;
  return e.mode === "train/bus" ? e.km / 75 : 2 + e.km / 750;
}
