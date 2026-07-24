"use client";

import { useState } from "react";
import { useActivePlan } from "@/lib/store/plan";
import { useCustomTripsStore } from "@/lib/store/customTrips";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { makeCtx } from "@/lib/calc/context";
import { blendedTotals } from "@/lib/calc/costs";
import { schengenDays } from "@/lib/calc/schengen";
import type { FilterState } from "@/lib/filters";
import type { Trip } from "@/data/trips";
import SuggestionCard from "./SuggestionCard";

interface RejectedTrip {
  name: string;
  reason: string;
}

interface DiscoverResponse {
  accepted: Trip[];
  rejected: RejectedTrip[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  error?: string;
}

function describeFilters(filters: FilterState, query: string): string {
  const parts: string[] = [];
  if (query) parts.push(`search "${query}"`);
  Object.entries(filters).forEach(([key, set]) => {
    if (set.size) parts.push(`${key}: ${[...set].join("/")}`);
  });
  return parts.join("; ");
}

export default function DiscoverPanel({
  filters,
  query,
  onClose,
}: {
  filters: FilterState;
  query: string;
  onClose: () => void;
}) {
  const plan = useActivePlan();
  const customTrips = useCustomTripsStore((s) => s.trips);
  const addTrip = useCustomTripsStore((s) => s.addTrip);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Trip[]>([]);
  const [rejected, setRejected] = useState<RejectedTrip[]>([]);
  const [usage, setUsage] = useState<DiscoverResponse["usage"] | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const runDiscovery = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setRejected([]);
    setUsage(null);
    setApprovedIds(new Set());

    const ctx = makeCtx(plan.home, plan.bag);
    const slots = getSlotsForPlan(plan);
    const remainingSlots = slots
      .filter((s) => !plan.placements[s.id]?.stops.length)
      .map((s) => ({ label: s.label, date: s.date }));

    const bt = blendedTotals(plan.placements, ctx, plan.defaultTravelers ?? 1);
    const remainingBudget = plan.budget !== null ? Math.max(0, Math.round(plan.budget - bt.blend)) : null;

    const schD = schengenDays(plan.placements, plan.home, ctx.tripOf);
    const remainingSchengenDays = Math.max(0, 90 - schD);

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: plan.home,
          filterSummary: describeFilters(filters, query),
          remainingSlots,
          remainingBudget,
          remainingSchengenDays,
          existingCustomTrips: Object.values(customTrips),
        }),
      });
      const data: DiscoverResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "Discovery failed — try again in a moment.");
      } else {
        setSuggestions(data.accepted);
        setRejected(data.rejected);
        setUsage(data.usage);
      }
    } catch {
      setError("Couldn't reach the discovery service — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (trip: Trip) => {
    addTrip(trip);
    setApprovedIds((prev) => new Set([...prev, trip.id]));
  };

  const handleReject = (tripId: string) => {
    setSuggestions((prev) => prev.filter((t) => t.id !== tripId));
  };

  return (
    <div className="rounded-card border border-primary/30 bg-primary-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-ink">✨ Discover more trips</h3>
          <p className="mt-1 text-xs text-muted">
            Uses your active filters, open slots, remaining budget, and Schengen days to propose real
            places not already in the catalog. Costs a few cents per run — you approve each one before
            it&apos;s added to your own catalog.
          </p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-muted hover:text-ink">
          ✕
        </button>
      </div>

      <button
        type="button"
        onClick={runDiscovery}
        disabled={loading}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {loading ? "Thinking… (can take 15–30s)" : "Find new trips"}
      </button>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {usage && (
        <p className="mt-3 text-[11px] text-muted">
          This run: {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
          tokens · ≈${usage.costUsd < 0.01 ? "<0.01" : usage.costUsd.toFixed(2)}
          {rejected.length > 0 && ` · ${rejected.length} suggestion${rejected.length > 1 ? "s" : ""} rejected (malformed or duplicate)`}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((t) => (
            <SuggestionCard
              key={t.id}
              trip={t}
              approved={approvedIds.has(t.id)}
              onApprove={() => handleApprove(t)}
              onReject={() => handleReject(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
