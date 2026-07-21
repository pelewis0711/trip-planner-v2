// Bundles the trip catalog + home base into the lookups the rest of the
// calc engine needs, so functions don't have to thread five params each.
import { TRIPS, type Trip } from "@/data/trips";
import { HOMES } from "@/data/homes";
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
  return {
    trips: TRIPS,
    tripOf: (id) => TRIP_BY_ID.get(id),
    coordsOf: (id) => TRIP_BY_ID.get(id)?.co,
    nameOf: (id) => TRIP_BY_ID.get(id)?.n ?? "?",
    home,
    homeCoord: HOMES[home] || HOMES.Prague,
    bag,
  };
}
