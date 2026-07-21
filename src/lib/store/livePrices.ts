"use client";

import { create } from "zustand";

export interface LivePrice {
  price: number | null;
  currency: string;
  airline: string | null;
  foundDepartureAt: string | null;
  checkedAt: string;
  cached: boolean;
}

export function legKey(origin: string, destination: string, date: string): string {
  return `${origin}|${destination}|${date}`;
}

interface LivePriceState {
  prices: Record<string, LivePrice>;
  loading: Record<string, boolean>;
  fetchPrice: (origin: string, destination: string, date: string, opts?: { refresh?: boolean }) => Promise<void>;
}

// Session-only cache of prices fetched from our own /api/flights/price route
// (which itself checks a 24h Postgres cache before ever hitting
// Travelpayouts -- see that route for the actual rate-limit story). Not
// persisted to localStorage: every page load re-asks our own route, which
// is cheap since it's almost always just a Postgres read.
export const useLivePriceStore = create<LivePriceState>((set, get) => ({
  prices: {},
  loading: {},
  fetchPrice: async (origin, destination, date, opts) => {
    const key = legKey(origin, destination, date);
    if (get().loading[key]) return;
    if (!opts?.refresh && get().prices[key]) return;

    set((s) => ({ loading: { ...s.loading, [key]: true } }));
    try {
      const params = new URLSearchParams({ origin, destination, date });
      if (opts?.refresh) params.set("refresh", "1");
      const res = await fetch(`/api/flights/price?${params}`);
      if (res.ok) {
        const data = (await res.json()) as LivePrice;
        set((s) => ({ prices: { ...s.prices, [key]: data } }));
      }
    } catch (err) {
      console.error("Failed to fetch live price", err);
    } finally {
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  },
}));
