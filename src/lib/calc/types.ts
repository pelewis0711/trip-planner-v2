// Shared shape of a placed trip, mirroring v1's placements[slotId] (reference-v1-app.html:1025-1036).

export interface Stop {
  tripId: string;
  nights: number;
  // Picked activity ids ("rome.borghese-gallery"), Phase 26. Was a boolean[]
  // parallel to Trip.a -- read it through pickedActivities()/migrateAct() in
  // ./activities.ts, which still understand that old shape.
  act: string[];
  sig: boolean[]; // which signature foods are checked, parallel to Trip.f
  l: number; // lodging tier index (0-3)
  fd: number; // food tier index (0-2)
}

export interface SlotActuals {
  tr?: number | null;
  lo?: number | null;
  fo?: number | null;
  ac?: number | null;
}

export interface Placement {
  stops: Stop[];
  actual?: SlotActuals;
  // Phase 8: party size for this slot's whole group (shared across every
  // stop in a multi-city slot). undefined -> use the plan's default.
  travelers?: number;
}

export type Placements = Record<string, Placement>;
