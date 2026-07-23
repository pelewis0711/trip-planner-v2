// Bundles the trip catalog + home base into the lookups the rest of the
// calc engine needs, so functions don't have to thread five params each.
import { TRIPS, type Trip } from "@/data/trips";
import { useCustomTripsStore } from "@/lib/store/customTrips";
import { resolveHome } from "@/lib/resolveHome";
import type { BagOption } from "./pricing";

export interface PlannerCtx {
  trips: Trip[];
  tripOf: (tripId: string) => Trip | undefined;
  coordsOf: (tripId: string) => [number, number] | undefined;
  nameOf: (tripId: string) => string;
  home: string;
  homeCoord: [number, number];
  bag: BagOption;
}

const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));

// Discovered trips (Phase 5) are per-account, so makeCtx reads the current
// snapshot from the Zustand store rather than a fixed import -- fine to call
// outside React (this is a plain getState() read, not a hook) and cheap
// since custom trips are always a small handful, not hundreds.
export function makeCtx(home: string, bag: BagOption = "cabin"): PlannerCtx {
  const custom = useCustomTripsStore.getState().trips;
  const hasCustom = Object.keys(custom).length > 0;
  const trips = hasCustom ? [...TRIPS, ...Object.values(custom)] : TRIPS;
  const byId = hasCustom ? new Map(trips.map((t) => [t.id, t])) : TRIP_BY_ID;

  // [0, 0] (null island) is an honest, obviously-a-placeholder fallback for
  // an unresolved home -- never Prague's real coordinates. Every page that
  // can reach here with no home configured already shows an "unconfigured"
  // prompt instead of real numbers, so this is a safety net, not the normal
  // path (see Calendar/Itinerary/Catalog's isUnconfigured checks).
  const resolved = resolveHome(home);
  const homeCoord: [number, number] = resolved ? [resolved.lat, resolved.lon] : [0, 0];

  return {
    trips,
    tripOf: (id) => byId.get(id),
    coordsOf: (id) => byId.get(id)?.co,
    nameOf: (id) => byId.get(id)?.n ?? "?",
    home,
    homeCoord,
    bag,
  };
}
