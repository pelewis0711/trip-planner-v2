"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActivePlan, usePlanStore } from "@/lib/store/plan";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { HOMES } from "@/data/homes";
import { EUROPEAN_CITIES } from "@/data/europeanCities";
import { useCustomHomesStore } from "@/lib/store/customHomes";
import { lookupCity } from "@/lib/resolveHome";
import { makeCtx } from "@/lib/calc/context";
import { grandTotals } from "@/lib/calc/costs";
import { describeTerm } from "@/lib/calc/semester";
import { formatMoney, RATES_AS_OF } from "@/lib/calc/currency";
import OfflineIndicator from "./OfflineIndicator";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/catalog", label: "Trip Catalog" },
  { href: "/calendar", label: "My Calendar" },
  { href: "/itinerary", label: "Itinerary & Totals" },
  { href: "/plans", label: "Plans & Compare" },
  { href: "/settings", label: "Settings" },
];

const OTHER_CITY = "__other__";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { id, home, bag, placements, defaultTravelers, semester } = useActivePlan();
  const setHome = usePlanStore((s) => s.setHome);
  const switchPlan = usePlanStore((s) => s.switchPlan);
  const plans = usePlanStore((s) => s.plans);
  const currency = usePlanStore((s) => s.defaultCurrency);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const total = grandTotals(placements, makeCtx(home, bag), defaultTravelers ?? 1).total;
  const term = describeTerm(semester);

  const customHomes = useCustomHomesStore((s) => s.homes);
  const addHome = useCustomHomesStore((s) => s.addHome);
  const [addingCity, setAddingCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCountry, setManualCountry] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  async function handleAddCity() {
    const q = cityInput.trim();
    if (!q) return;
    setGeocoding(true);
    setGeocodeError(null);
    setManualEntry(false);
    const result = await lookupCity(q);
    setGeocoding(false);
    if ("error" in result) {
      setGeocodeError(result.error);
      return;
    }
    addHome(result.city, { lat: result.lat, lon: result.lon, country: result.country });
    setHome(result.city);
    setAddingCity(false);
    setCityInput("");
  }

  function confirmManualEntry() {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!cityInput.trim() || Number.isNaN(lat) || Number.isNaN(lon)) return;
    const city = cityInput.trim();
    addHome(city, { lat, lon, country: manualCountry.trim() });
    setHome(city);
    setAddingCity(false);
    setManualEntry(false);
    setGeocodeError(null);
    setCityInput("");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  const authControl = authLoading ? null : user ? (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span className="hidden max-w-[140px] truncate text-zinc-400 sm:inline">{user.email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-zinc-800 px-2.5 py-1.5 font-medium text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
      >
        Sign out
      </button>
    </div>
  ) : (
    <Link
      href="/login"
      className="shrink-0 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-emerald-500/50 hover:text-zinc-100"
    >
      Sign in
    </Link>
  );

  const planIds = Object.keys(plans).sort((a, b) => plans[b].updated - plans[a].updated);
  const totalPill = (
    <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
      Total: <span className="text-emerald-400">{formatMoney(total, currency)}</span>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
          <div>
            <div className="text-base font-semibold text-zinc-50">Trip Planner v2</div>
            <div className="text-[11px] font-medium tracking-wide text-zinc-500">
              {term ? `${term.season.toUpperCase()} ${term.year} · ` : ""}PER PERSON {currency}
              {currency !== "USD" && (
                <span className="ml-1 normal-case tracking-normal text-zinc-600">
                  (rates approx., as of {RATES_AS_OF})
                </span>
              )}
            </div>
          </div>
          <div className="sm:hidden">{totalPill}</div>
        </div>

        {addingCity ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs">
            <input
              autoFocus
              type="text"
              list="header-city-options"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCity()}
              placeholder="Type a city…"
              className="w-28 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <datalist id="header-city-options">
              {[...Object.keys(HOMES), ...Object.keys(EUROPEAN_CITIES)].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={handleAddCity}
              disabled={geocoding}
              className="rounded-md bg-emerald-500 px-2 py-1 font-bold text-zinc-950 disabled:opacity-50"
            >
              {geocoding ? "…" : "✓"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingCity(false);
                setGeocodeError(null);
                setManualEntry(false);
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
            {geocodeError && !manualEntry && (
              <div className="flex w-full flex-wrap items-center gap-1.5 pt-1">
                <span className="text-red-400">{geocodeError}</span>
                <button
                  type="button"
                  onClick={() => setManualEntry(true)}
                  className="rounded-md border border-zinc-700 px-1.5 py-0.5 font-semibold text-zinc-300"
                >
                  Enter coordinates manually
                </button>
              </div>
            )}
            {manualEntry && (
              <div className="flex w-full flex-wrap items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={manualCountry}
                  onChange={(e) => setManualCountry(e.target.value)}
                  placeholder="Country"
                  className="w-20 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-100 placeholder:text-zinc-600"
                />
                <input
                  type="number"
                  step="any"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="Lat"
                  className="w-16 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-100 placeholder:text-zinc-600"
                />
                <input
                  type="number"
                  step="any"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  placeholder="Lon"
                  className="w-16 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-100 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={confirmManualEntry}
                  className="rounded-md bg-emerald-500 px-2 py-1 font-bold text-zinc-950"
                >
                  Use
                </button>
              </div>
            )}
          </div>
        ) : (
          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-400">
            <span aria-hidden>🏠</span>
            <span className="hidden sm:inline">Home</span>
            <select
              value={home}
              onChange={(e) => (e.target.value === OTHER_CITY ? setAddingCity(true) : setHome(e.target.value))}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100"
            >
              {!home && (
                <option value="" disabled>
                  Choose a city…
                </option>
              )}
              {Object.keys(HOMES).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
              {Object.keys(customHomes).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
              <option value={OTHER_CITY}>Other city…</option>
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-400">
          <span aria-hidden>📋</span>
          <span className="hidden sm:inline">Plan</span>
          <select
            value={id}
            onChange={(e) => switchPlan(e.target.value)}
            className="max-w-[140px] rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100"
          >
            {planIds.map((pid) => (
              <option key={pid} value={pid}>
                {plans[pid].name}
              </option>
            ))}
          </select>
        </label>

        <nav className="order-last flex w-full gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible sm:ml-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-zinc-800 text-zinc-400 hover:border-emerald-500/50 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <OfflineIndicator />
        {authControl}
        <div className="hidden sm:block">{totalPill}</div>
      </div>
    </header>
  );
}
