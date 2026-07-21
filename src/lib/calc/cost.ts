// Direct port of v1's per-night/per-day rate model (reference-v1-app.html:1027-1034).

export const CI_BASE: Record<number, { lodg: number; food: number }> = {
  1: { lodg: 13, food: 12 },
  2: { lodg: 20, food: 18 },
  3: { lodg: 28, food: 24 },
  4: { lodg: 38, food: 32 },
  5: { lodg: 52, food: 42 },
};

export type Tier = [label: string, price: number];

export function lodgingTiers(ci: number): Tier[] {
  const b = (CI_BASE[ci] || CI_BASE[3]).lodg;
  return [
    ["Hostel dorm", b],
    ["Apartment / Airbnb split", Math.round(b * 1.5)],
    ["Private room / budget hotel", Math.round(b * 2.1)],
    ["Boutique / splurge", Math.round(b * 3.6)],
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
