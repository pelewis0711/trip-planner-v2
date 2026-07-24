"use client";

import { useMemo } from "react";
import { useActivePlan } from "@/lib/store/plan";
import { TRIPS } from "@/data/trips";
import { describeTerm } from "@/lib/calc/semester";
import { resolveHome } from "@/lib/resolveHome";
import { haversine } from "@/lib/calc/routing";
import ImagePlaceholder from "@/components/ImagePlaceholder";

const REGIONS = new Set(TRIPS.map((t) => t.reg)).size;
const COUNTRIES = new Set(TRIPS.map((t) => t.c)).size;

// Generic, season-driven advice -- not tied to any one student's personal
// trip picks. The "your break" line is filled in dynamically per-plan below
// (see breakLines in the component) instead of a hardcoded date range.
const SEASON_TIPS: readonly (readonly [string, string])[] = [
  ["Cold months:", "lean on cheap indoor-culture cities — museums, thermal baths, and old-town architecture hold up fine in the cold, and prices/crowds are both lower."],
  ["Shoulder season (a few weeks before your main break):", "a good window for either a cultural city trip or a warm-weather escape — check the catalog's weather and trip-type filters for what's actually in season where you'd go."],
  ["Warmer months:", "scenic, coastal, and outdoor-heavy trips open up. Save island/beach destinations for your warmest, latest free window — they're roughest value early in the term."],
];

const AFFORDABILITY_TIPS: readonly (readonly [string, string])[] = [
  ["Best value overall:", "Budapest, Kraków, Belgrade, Warsaw, Zagreb — full weekends often under $150 pp."],
  ["Free/cheap day trips (no lodging):", "look for catalog trips with a 0-night \"day trip\" option — usually under $40 all-in."],
  ["Splurge wisely:", "Switzerland, Norway, and the Greek islands tend to be the priciest — pick one or two, use hostels + grocery picnics elsewhere."],
  ["Money-savers baked in:", "every trip lets you swap Airbnb→hostel and flight→train, and deselect pricey activities."],
];

const LENGTH_TIPS: readonly (readonly [string, string])[] = [
  ["Day trip (0 nights):", "look for catalog trips flagged as day-trip friendly — perfect for a busy weekend."],
  ["1 night:", "nearby smaller cities you can reach without burning a whole weekend."],
  ["2 nights (the sweet spot):", "most weekend-sized cities fit comfortably in 2 nights."],
  ["3+ nights:", "save for your longer breaks — multi-city itineraries, islands, or anywhere with a long flight/train from home."],
];

export default function OverviewPage() {
  const activePlan = useActivePlan();
  const { home, slots = [] } = activePlan;
  const term = describeTerm(activePlan.semester);
  const weekendCount = slots.filter((s) => s.kind === "weekend").length;
  const otherSlots = slots.filter((s) => s.kind !== "weekend");

  const nearHome = useMemo(() => {
    const resolved = resolveHome(home);
    if (!resolved) return [];
    const homeCoord: [number, number] = [resolved.lat, resolved.lon];
    return [...TRIPS]
      .map((t) => ({ t, km: haversine(homeCoord, t.co) }))
      .filter(({ km }) => km > 20) // skip "home" itself if it's also a catalog city
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [home]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 gap-6 rounded-card border border-border bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_280px] lg:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {home ? `Plan your semester of travel from ${home} ✈️` : "Plan your semester of travel ✈️"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            {!home ? (
              <>
                <b className="text-ink">Pick your home city</b> up in the header to get flight/train
                prices routed from where you actually are. Until then, prices below are just illustrative.
              </>
            ) : (
              <>
                You&apos;re based in <b className="text-ink">{home}</b>
                {term ? (
                  <>
                    {" "}
                    for <b className="text-ink">{term.season} {term.year}</b>
                  </>
                ) : null}
                . That leaves{" "}
                <b className="text-ink">
                  {weekendCount} free weekend{weekendCount === 1 ? "" : "s"}
                </b>
                {otherSlots.length > 0 && (
                  <>
                    , plus {otherSlots.map((s) => s.label).join(", ")}
                  </>
                )}{" "}
                to travel. Every trip below reprices with flights/trains routed from {home}.
              </>
            )}{" "}
            Browse <b className="text-ink">{TRIPS.length} trip options</b>, then fine-tune every
            activity, meal, flight and bed.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [TRIPS.length, "trip options"],
              [REGIONS, "regions"],
              [COUNTRIES, "countries"],
              [slots.length, "open travel slots"],
            ].map(([n, label]) => (
              <div key={label as string} className="rounded-xl border border-border bg-surface-muted p-4">
                <b className="block text-2xl font-bold text-accent">{n}</b>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <ImagePlaceholder ratio="aspect-[4/3]" className="hidden lg:flex" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="font-heading text-sm font-semibold text-ink">🗓️ Recommended by time of year</h4>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            {SEASON_TIPS.map(([lead, rest]) => (
              <li key={lead}>
                <b className="text-ink">{lead}</b> {rest}
              </li>
            ))}
            {otherSlots
              .filter((s) => s.kind === "break" || s.kind === "special")
              .map((s) => (
                <li key={s.id}>
                  <b className="text-ink">
                    Your {s.label} ({s.date}):
                  </b>{" "}
                  go far &amp; multi-city if it&apos;s long enough — a rail pass often pays off on a
                  break this size.
                </li>
              ))}
          </ul>
        </div>

        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="font-heading text-sm font-semibold text-ink">
            📍 {home ? `Near ${home}` : "Near your home city"}
          </h4>
          {nearHome.length ? (
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              {nearHome.map(({ t, km }) => (
                <li key={t.id}>
                  <b className="text-ink">{t.n}, {t.c}</b> — ~{Math.round(km)}km, good for a quick
                  weekend or day trip.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Pick your home city to see the closest catalog trips — usually the cheapest, fastest ones
              to reach.
            </p>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="font-heading text-sm font-semibold text-ink">💰 Recommended for affordability</h4>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            {AFFORDABILITY_TIPS.map(([lead, rest]) => (
              <li key={lead}>
                <b className="text-ink">{lead}</b> {rest}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="font-heading text-sm font-semibold text-ink">⏱️ Recommended trip length</h4>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            {LENGTH_TIPS.map(([lead, rest]) => (
              <li key={lead}>
                <b className="text-ink">{lead}</b> {rest}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface p-5">
        <h3 className="font-heading text-sm font-semibold text-ink">How to use this planner</h3>
        <p className="mt-2 text-sm text-muted">
          <b className="text-ink">1.</b> Open <b className="text-ink">Trip Catalog</b>{" "}
          and browse or filter trips. &nbsp; <b className="text-ink">2.</b> Drop them onto{" "}
          <b className="text-ink">My Calendar</b>{" "}
          and pick your flight vs. train, hostel vs. Airbnb, and which activities you want. &nbsp;{" "}
          <b className="text-ink">3.</b> Watch{" "}
          <b className="text-ink">Itinerary &amp; Totals</b>{" "}
          update live with per-category costs and your full schedule.
        </p>
      </div>
    </div>
  );
}
