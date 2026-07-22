// Direct port of v1's per-night/per-day rate model (reference-v1-app.html:1027-1034).

export const CI_BASE: Record<number, { lodg: number; food: number }> = {
  1: { lodg: 13, food: 12 },
  2: { lodg: 20, food: 18 },
  3: { lodg: 28, food: 24 },
  4: { lodg: 38, food: 32 },
  5: { lodg: 52, food: 42 },
};

export type Tier = [label: string, price: number];

// Phase 8: group-aware, per person per night. Hostel is a flat per-bed price
// regardless of group size. Airbnb/private/boutique assume the group shares
// units/rooms -- a whole-unit or whole-room price is split across the group,
// so bigger groups drop the per-person cost. See CLAUDE.md's Phase 8 section
// for the calibration table this was checked against before shipping.
export function lodgingTiers(ci: number, travelers: number): Tier[] {
  const b = (CI_BASE[ci] || CI_BASE[3]).lodg;
  const n = Math.max(1, travelers);
  const rooms = Math.ceil(n / 2); // private/boutique: 2 people per room

  const airbnbUnit = (2.5 + 0.5 * n) * b;
  const airbnbPerPerson = Math.max(airbnbUnit / n, 0.8 * b);
  const privatePerPerson = (b * 2.1 * rooms) / n;
  const boutiquePerPerson = (b * 3.6 * rooms) / n;

  return [
    ["Hostel dorm", Math.round(b)],
    ["Apartment / Airbnb split", Math.round(airbnbPerPerson)],
    ["Private room / budget hotel", Math.round(privatePerPerson)],
    ["Boutique / splurge", Math.round(boutiquePerPerson)],
  ];
}

export function foodTiers(ci: number): Tier[] {
  const b = (CI_BASE[ci] || CI_BASE[3]).food;
  return [
    ["Street food & groceries", b],
    ["Mid-range restaurants", Math.round(b * 1.8)],
    ["Foodie splurge", Math.round(b * 2.9)],
  ];
}

export function tierOf(ci: number): "b" | "m" | "s" {
  return ci <= 2 ? "b" : ci === 3 ? "m" : "s";
}

// A 2-night trip = ~3 days of eating.
export function daysOf(nights: number): number {
  return Math.max(1, nights + 1);
}
