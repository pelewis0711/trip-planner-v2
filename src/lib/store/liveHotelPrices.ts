"use client";

import { create } from "zustand";

export interface LiveHotelPrice {
  price: number | null;
  currency: string;
  hotelName: string | null;
  checkedAt: string;
  cached: boolean;
  // set when the upstream provider itself isn't reachable/authorized right
  // now (as opposed to a legitimate "no cached price for this hotel/date") --
  // see CLAUDE.md's Phase 8 section for why this exists.
  unavailable?: boolean;
}

export function hotelKey(city: string, checkIn: string, checkOut: string, guests: number, tier: "private" | "boutique"): string {
  return `${city}|${checkIn}|${checkOut}|${guests}|${tier}`;
}

interface LiveHotelPriceState {
  prices: Record<string, LiveHotelPrice>;
  loading: Record<string, boolean>;
  fetchPrice: (
    city: string,
    checkIn: string,
    checkOut: string,
    guests: number,
    tier: "private" | "boutique",
    opts?: { refresh?: boolean }
  ) => Promise<void>;
}

// Session-only, mirrors useLivePriceStore (src/lib/store/livePrices.ts)
// exactly -- every page load re-asks our own route, which is cheap since
// it's almost always a Postgres read, not a real upstream call.
export const useLiveHotelPriceStore = create<LiveHotelPriceState>((set, get) => ({
  prices: {},
  loading: {},
  fetchPrice: async (city, checkIn, checkOut, guests, tier, opts) => {
    const key = hotelKey(city, checkIn, checkOut, guests, tier);
    if (get().loading[key]) return;
    if (!opts?.refresh && get().prices[key]) return;

    set((s) => ({ loading: { ...s.loading, [key]: true } }));
    try {
      const params = new URLSearchParams({ city, checkIn, checkOut, guests: String(guests), tier });
      if (opts?.refresh) params.set("refresh", "1");
      const res = await fetch(`/api/hotels/price?${params}`);
      const data = await res.json();
      if (res.ok) {
        set((s) => ({ prices: { ...s.prices, [key]: data as LiveHotelPrice } }));
      } else {
        set((s) => ({
          prices: {
            ...s.prices,
            [key]: { price: null, currency: "USD", hotelName: null, checkedAt: new Date().toISOString(), cached: false, unavailable: true },
          },
        }));
      }
    } catch (err) {
      console.error("Failed to fetch live hotel price", err);
    } finally {
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  },
}));
