// Shared display helpers used by both TripCard and TripDetailSheet, so the
// two don't drift into duplicate copies of the same tier/type/month labels.
export const TYPE_LABEL: Record<string, string> = {
  history: "History & Culture",
  scenic: "Scenic & Nature",
  beach: "Beach & Islands",
  nightlife: "Nightlife & Cities",
};

export const TYPE_STYLE: Record<string, string> = {
  history: "bg-violet-100 text-violet-700",
  scenic: "bg-teal-100 text-teal-700",
  beach: "bg-sky-100 text-sky-700",
  nightlife: "bg-pink-100 text-pink-700",
};

export const TIER_LABEL: Record<string, string> = { b: "Budget", m: "Mid", s: "Splurge" };
// Semantic status colors (not the primary/accent brand pair) -- these
// communicate a fact about the trip's cost tier, not a brand decoration.
export const TIER_STYLE: Record<string, string> = {
  b: "bg-success/10 text-success",
  m: "bg-warning/10 text-warning",
  s: "bg-danger/10 text-danger",
};

export function tierOf(ci: number): "b" | "m" | "s" {
  return ci <= 2 ? "b" : ci === 3 ? "m" : "s";
}

export const MO_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};
