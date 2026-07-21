// Shared shape of a placed trip, mirroring v1's placements[slotId] (reference-v1-app.html:1025-1036).

export interface Stop {
  tripId: string;
  nights: number;
  act: boolean[]; // which activities are checked, parallel to Trip.a
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
}

export type Placements = Record<string, Placement>;
