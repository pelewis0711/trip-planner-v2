// Bundles the trip catalog + home base into the lookups the rest of the
// calc engine needs, so functions don't have to thread five params each.
import { TRIPS, type Trip } from "@/data/trips";
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

export function makeCtx(home: string, bag: BagOption = "cabin"): PlannerCtx {
  // [0, 0] (null island) is an honest, obviously-a-placeholder fallback for
  // an unresolved home -- never Prague's real coordinates. Every page that
  // can reach here with no home configured already shows an "unconfigured"
  // prompt instead of real numbers, so this is a safety net, not the normal
  // path (see Calendar/Itinerary/Catalog's isUnconfigured checks).
  const resolved = resolveHome(home);
  const homeCoord: [number, number] = resolved ? [resolved.lat, resolved.lon] : [0, 0];

  return {
    trips: TRIPS,
    tripOf: (id) => TRIP_BY_ID.get(id),
    coordsOf: (id) => TRIP_BY_ID.get(id)?.co,
    nameOf: (id) => TRIP_BY_ID.get(id)?.n ?? "?",
    home,
    homeCoord,
    bag,
  };
}
