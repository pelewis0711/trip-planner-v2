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
  const [menuOpen, setMenuOpen] = useState(false);

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
      <span className="hidden max-w-[140px] truncate text-muted sm:inline">{user.email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-border px-3 py-2 font-medium text-muted transition-colors hover:border-accent hover:text-accent-hover"
      >
        Sign out
      </button>
    </div>
  ) : (
    <Link
      href="/login"
      className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
    >
      Sign in
    </Link>
  );

  const planIds = Object.keys(plans).sort((a, b) => plans[b].updated - plans[a].updated);
  const totalPill = (
    <div className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink">
      Total: <span className="text-primary">{formatMoney(total, currency)}</span>
    </div>
  );

  const cityPicker = addingCity ? (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-xs">
      <input
        autoFocus
        type="text"
        list="header-city-options"
        value={cityInput}
        onChange={(e) => setCityInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAddCity()}
        placeholder="Type a city…"
        className="w-28 rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-ink placeholder:text-muted"
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
        className="rounded-md bg-primary px-2.5 py-1.5 font-bold text-white disabled:opacity-50"
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
        className="text-muted hover:text-ink"
      >
        ✕
      </button>
      {geocodeError && !manualEntry && (
        <div className="flex w-full flex-wrap items-center gap-1.5 pt-1">
          <span className="text-danger">{geocodeError}</span>
          <button
            type="button"
            onClick={() => setManualEntry(true)}
            className="rounded-md border border-border px-1.5 py-1 font-semibold text-muted"
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
            className="w-20 rounded-md border border-border bg-surface-muted px-1.5 py-1 text-ink placeholder:text-muted"
          />
          <input
            type="number"
            step="any"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder="Lat"
            className="w-16 rounded-md border border-border bg-surface-muted px-1.5 py-1 text-ink placeholder:text-muted"
          />
          <input
            type="number"
            step="any"
            value={manualLon}
            onChange={(e) => setManualLon(e.target.value)}
            placeholder="Lon"
            className="w-16 rounded-md border border-border bg-surface-muted px-1.5 py-1 text-ink placeholder:text-muted"
          />
          <button
            type="button"
            onClick={confirmManualEntry}
            className="rounded-md bg-primary px-2.5 py-1.5 font-bold text-white"
          >
            Use
          </button>
        </div>
      )}
    </div>
  ) : (
    <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted">
      <span aria-hidden>🏠</span>
      <span>Home</span>
      <select
        value={home}
        onChange={(e) => (e.target.value === OTHER_CITY ? setAddingCity(true) : setHome(e.target.value))}
        className="rounded-md border border-border bg-surface-muted px-2 py-1 text-sm font-semibold text-ink"
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
  );

  const planPicker = (
    <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted">
      <span aria-hidden>📋</span>
      <span>Plan</span>
      <select
        value={id}
        onChange={(e) => switchPlan(e.target.value)}
        className="max-w-[140px] rounded-md border border-border bg-surface-muted px-2 py-1 text-sm font-semibold text-ink"
      >
        {planIds.map((pid) => (
          <option key={pid} value={pid}>
            {plans[pid].name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-white">
            S
          </span>
          <div>
            <div className="font-heading text-lg leading-none font-bold text-ink">Semesterly</div>
            <div className="text-[10.5px] leading-tight font-medium tracking-wide text-muted">
              {term ? `${term.season.toUpperCase()} ${term.year} · ` : ""}PER PERSON {currency}
              {currency !== "USD" && (
                <span className="ml-1 normal-case tracking-normal">(rates approx., {RATES_AS_OF})</span>
              )}
            </div>
          </div>
        </Link>

        {/* desktop: everything inline */}
        <nav className="ml-4 hidden flex-1 flex-wrap items-center gap-1.5 lg:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-primary text-white" : "text-muted hover:bg-primary-soft hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {cityPicker}
          {planPicker}
          <OfflineIndicator />
          {authControl}
          {totalPill}
        </div>

        {/* mobile: hamburger toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-surface px-4 py-4 lg:hidden">
          <nav className="grid grid-cols-2 gap-2">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-xl px-3.5 py-3 text-center text-sm font-medium ${
                    active ? "bg-primary text-white" : "border border-border text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            {cityPicker}
            {planPicker}
            <div className="flex items-center justify-between gap-2">
              <OfflineIndicator />
              {authControl}
            </div>
            {totalPill}
          </div>
        </div>
      )}
    </header>
  );
}
