// Display-only currency conversion. The calc engine (costs.ts, cost.ts,
// routing.ts, pricing.ts, warnings.ts, livePricing.ts) computes and stores
// everything in plain USD, untouched -- conversion happens only here, at
// the moment a number is formatted for the screen or a spreadsheet cell.
//
// A small, hand-set rate table, not a live-FX integration -- disclosed as
// approximate (RATES_AS_OF, shown next to the Header's currency label) so
// no one mistakes this for a real-time exchange rate.
import type { Currency } from "@/components/onboarding/OnboardingFlow";

export const RATES: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };
export const RATES_AS_OF = "July 2026";
export const SYMBOLS: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£" };

export function convert(usd: number, currency: Currency): number {
  return usd * RATES[currency];
}

export function formatMoney(usd: number, currency: Currency): string {
  return `${SYMBOLS[currency]}${Math.round(convert(usd, currency)).toLocaleString()}`;
}
