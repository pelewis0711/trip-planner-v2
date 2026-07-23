"use client";

import { useActivePlan } from "@/lib/store/plan";
import { TRIPS } from "@/data/trips";

const REGIONS = new Set(TRIPS.map((t) => t.reg)).size;
const COUNTRIES = new Set(TRIPS.map((t) => t.c)).size;

const RECS = [
  {
    title: "🗓️ Recommended by time of year",
    items: [
      ["Feb (cold):", "lean on cheap indoor-culture cities — Vienna, Budapest, Kraków, Warsaw. Thermal baths in Budapest are a February highlight."],
      ["Mar:", "Dublin for St. Patrick's (Mar 17); Marrakech before the desert heat; Andalusia (Seville/Granada) blooms early."],
      ["Spring Break (Mar 26–Apr 4):", "go far & multi-city — Spain (Barcelona→Madrid→Seville→Granada) or Italy, where a Eurail pass pays off."],
      ["Apr–May (warm):", "unlock scenic & beach — Swiss Alps, Cinque Terre, Amalfi, Croatia. Save Greek islands & Santorini for the post-finals window when it's warmest."],
    ],
  },
  {
    title: "💰 Recommended for affordability",
    items: [
      ["Best value overall:", "Budapest, Kraków, Belgrade, Warsaw, Zagreb — full weekends often under $150 pp."],
      ["Free/cheap day trips (no lodging):", "Kutná Hora, Bohemian Switzerland, Toledo, Wachau Valley — under $40."],
      ["Splurge wisely:", "Switzerland, Norway, Santorini and Nice are the priciest — pick one or two, use hostels + grocery picnics."],
      ["Money-savers baked in:", "every trip lets you swap Airbnb→hostel and flight→train, and deselect pricey activities."],
    ],
  },
  {
    title: "⏱️ Recommended trip length",
    items: [
      ["Day trip (0 nights):", "Kutná Hora, Toledo, Bohemian Switzerland, Wachau — perfect for a busy weekend."],
      ["1 night:", "nearby gems — Český Krumlov, Salzburg, Nuremberg, Bled, Zagreb."],
      ["2 nights (the sweet spot):", "most weekend cities — Vienna, Berlin, Amsterdam, Barcelona."],
      ["3+ nights:", "save for break & post-finals — Rome, Paris, Spain, Amalfi, Santorini, Istanbul."],
    ],
  },
] as const;

export default function OverviewPage() {
  const { home } = useActivePlan();
  const isPrague = home === "Prague";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/60 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          {home ? `Plan your semester of travel from ${home} ✈️` : "Plan your semester of travel ✈️"}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          {!home ? (
            <>
              <b className="text-zinc-200">Pick your home city</b> up in the header to get flight/train
              prices routed from where you actually are. Until then, prices below are just illustrative.
            </>
          ) : isPrague ? (
            <>
              You&apos;re based in <b className="text-zinc-200">Prague</b>{" "}
              (this plan was built around Anglo-American University&apos;s{" "}
              <b className="text-zinc-200">Spring 2027</b>{" "}
              calendar — classes Jan 29–May 14). That leaves ~13 free weekends, a St. Patrick&apos;s
              midweek window, a 9-day spring break, and a post-finals stretch.
            </>
          ) : (
            <>
              You&apos;re based in <b className="text-zinc-200">{home}</b>. Every trip below reprices
              with flights/trains routed from {home}. The weekend &amp; break slots follow a typical
              late-Jan–late-May spring semester — treat the dates loosely and use whichever weekends
              match your program.
            </>
          )}{" "}
          Browse <b className="text-zinc-200">{TRIPS.length} trip options</b>, then fine-tune every
          activity, meal, flight and bed.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [TRIPS.length, "trip options"],
            [REGIONS, "regions"],
            [COUNTRIES, "countries"],
            [16, "open travel slots"],
          ].map(([n, label]) => (
            <div key={label as string} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <b className="block text-2xl font-bold text-emerald-400">{n}</b>
              <span className="text-xs text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECS.map((rec) => (
          <div key={rec.title} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h4 className="text-sm font-semibold text-zinc-100">{rec.title}</h4>
            <ul className="mt-3 space-y-2.5 text-sm text-zinc-400">
              {rec.items.map(([lead, rest]) => (
                <li key={lead}>
                  <b className="text-zinc-200">{lead}</b> {rest}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-100">How to use this planner</h3>
        <p className="mt-2 text-sm text-zinc-400">
          <b className="text-zinc-200">1.</b> Open <b className="text-zinc-200">Trip Catalog</b>{" "}
          and browse or filter trips. &nbsp; <b className="text-zinc-200">2.</b> Drop them onto{" "}
          <b className="text-zinc-200">My Calendar</b>{" "}
          and pick your flight vs. train, hostel vs. Airbnb, and which activities you want. &nbsp;{" "}
          <b className="text-zinc-200">3.</b> Watch{" "}
          <b className="text-zinc-200">Itinerary &amp; Totals</b>{" "}
          update live with per-category costs and your full schedule.
        </p>
      </div>
    </div>
  );
}
