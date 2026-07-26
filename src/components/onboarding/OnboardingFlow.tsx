"use client";

// Phase 6: 5-step onboarding wizard (host city -> host university -> home
// university -> term -> confirm dates), the order and skip rules Parker
// picked explicitly. Reused by both /onboarding (first sign-in, step-by-step)
// and /settings (edit anytime, single page) via the `layout` prop.
//
// Phase 12: Step 5's date auto-fill now comes from a single searchable
// picker (src/data/programCalendars.ts) covering BOTH study-abroad
// providers (CEA CAPA, IES Abroad, ...) and host universities -- merged
// with the earlier Phase 6 host-university auto-fill rather than running
// alongside it, so there's one dataset and one mechanism, not two. Step 2
// ("Host university") is now a plain free-text field (still with a
// typing-assist datalist) that no longer has the side effect of changing
// dates -- picking a result in Step 5's search box is the one explicit
// action that fills in real dates.
import { useMemo, useState } from "react";
import Link from "next/link";
import { HOMES } from "@/data/homes";
import { EUROPEAN_CITIES } from "@/data/europeanCities";
import { lookupCity, resolveHome } from "@/lib/resolveHome";
import { universityProgramNames } from "@/data/programCalendars";
import { smartDefaultSemester, type Term } from "@/lib/calc/onboarding";
import type { SemesterConfig } from "@/lib/calc/semester";
import SemesterDatesForm from "@/components/SemesterDatesForm";
import ProgramSearchPicker from "@/components/ProgramSearchPicker";
import { usePlanStore } from "@/lib/store/plan";

export interface HostCity {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export type Currency = "USD" | "EUR" | "GBP";

export interface OnboardingResult {
  host: HostCity;
  hostUniversity: string;
  homeUniversity: string;
  term: Term;
  semester: SemesterConfig;
  // Phase 9: stored but not yet wired to any behavior -- no currency
  // conversion happens anywhere yet (every price in the app is still
  // computed in USD), and nothing changes based on studyingInEurope. Both
  // are here so the data flows end-to-end; real behavior is a later step.
  studyingInEurope: boolean;
  currency: Currency;
}

export interface OnboardingValues {
  host: HostCity;
  hostUniversity: string;
  homeUniversity: string;
  term: Term;
  semester: SemesterConfig;
  studyingInEurope: boolean;
  currency: Currency;
}

// Phase 9 step 3: the starting point for a brand-new, never-configured
// visitor -- no city, so this doesn't quietly look like anyone in particular.
// The host-city <select> below already falls through to "Other city..." for
// any value that isn't a real HOMES key, and canNext already requires a real
// hostCity before Step 1's Next enables, so an empty city here needs no
// other changes to this component.
export const EMPTY_ONBOARDING_DEFAULTS: OnboardingValues = {
  host: { city: "", country: "", lat: 0, lon: 0 },
  hostUniversity: "",
  homeUniversity: "",
  term: "spring",
  semester: smartDefaultSemester("spring"),
  studyingInEurope: true,
  currency: "USD",
};

const OTHER_CITY = "__other__";

export default function OnboardingFlow({
  initial,
  onComplete,
  layout = "wizard",
  submitLabel = "Finish",
}: {
  initial: OnboardingValues;
  onComplete: (result: OnboardingResult) => void;
  layout?: "wizard" | "single-page";
  submitLabel?: string;
}) {
  const [step, setStep] = useState(1);

  const privacyNoticeSeen = usePlanStore((s) => s.privacyNoticeSeen);
  const dismissPrivacyNotice = usePlanStore((s) => s.dismissPrivacyNotice);

  const [hostCity, setHostCity] = useState(initial.host.city);
  const [hostCountry, setHostCountry] = useState(initial.host.country);
  const [hostLat, setHostLat] = useState(initial.host.lat);
  const [hostLon, setHostLon] = useState(initial.host.lon);
  const [addingCity, setAddingCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // requirement 3's fallback, for when neither the bundled city list nor a
  // live geocode lookup can resolve what was typed -- never silently
  // guesses a city, always asks.
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCountry, setManualCountry] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const [hostUniversity, setHostUniversity] = useState(initial.hostUniversity);
  const [homeUniversity, setHomeUniversity] = useState(initial.homeUniversity);
  const [term, setTerm] = useState<Term>(initial.term);

  const [semester, setSemester] = useState<SemesterConfig>(initial.semester);
  const [studyingInEurope, setStudyingInEurope] = useState(initial.studyingInEurope);
  const [currency, setCurrency] = useState<Currency>(initial.currency);

  // Phase 12: the one thing that fills in real dates -- picking a search
  // result via the shared ProgramSearchPicker (also used by the Plans-tab
  // SemesterPanel, so this isn't the only place it lives anymore). Bumping
  // pickerKey remounts the picker, which clears its own "auto-filled from
  // X" banner -- used whenever the dates are hand-edited afterward, so
  // that banner never lies about where the current dates actually came
  // from.
  const [pickerKey, setPickerKey] = useState(0);

  const uniNames = useMemo(() => universityProgramNames(), []);

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
    setHostCity(result.city);
    setHostCountry(result.country);
    setHostLat(result.lat);
    setHostLon(result.lon);
    setAddingCity(false);
    setCityInput("");
  }

  function confirmManualEntry() {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!cityInput.trim() || Number.isNaN(lat) || Number.isNaN(lon)) return;
    setHostCity(cityInput.trim());
    setHostCountry(manualCountry.trim());
    setHostLat(lat);
    setHostLon(lon);
    setAddingCity(false);
    setManualEntry(false);
    setGeocodeError(null);
    setCityInput("");
  }

  function finish() {
    onComplete({
      host: { city: hostCity, country: hostCountry, lat: hostLat, lon: hostLon },
      hostUniversity: hostUniversity.trim(),
      homeUniversity: homeUniversity.trim(),
      term,
      semester,
      studyingInEurope,
      currency,
    });
  }

  const stepBody = (
    <>
      {(layout === "single-page" || step === 1) && (
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-ink">1. Host city</h3>
          {addingCity ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  list="city-options"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCity()}
                  placeholder="Type any European city…"
                  className="rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-ink placeholder:text-muted"
                />
                <datalist id="city-options">
                  {[...Object.keys(HOMES), ...Object.keys(EUROPEAN_CITIES)].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleAddCity}
                  disabled={geocoding}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {geocoding ? "Looking up…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCity(false);
                    setGeocodeError(null);
                    setManualEntry(false);
                  }}
                  className="text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
              {geocodeError && !manualEntry && (
                <div className="space-y-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <p>{geocodeError} — we couldn&apos;t find that city.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCity(false);
                        setGeocodeError(null);
                      }}
                      className="rounded-md border border-warning/40 px-2 py-1 font-semibold text-warning"
                    >
                      Pick the nearest city from the list instead
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualEntry(true)}
                      className="rounded-md border border-warning/40 px-2 py-1 font-semibold text-warning"
                    >
                      Enter coordinates manually
                    </button>
                  </div>
                </div>
              )}
              {manualEntry && (
                <div className="space-y-1.5 rounded-md border border-border bg-surface-muted p-2.5">
                  <p className="text-[11px] text-muted">
                    &ldquo;{cityInput}&rdquo; — enter its coordinates and (optionally) country so trip distances
                    and your Schengen tracker still work.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <input
                      type="text"
                      value={manualCountry}
                      onChange={(e) => setManualCountry(e.target.value)}
                      placeholder="Country (optional)"
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink placeholder:text-muted"
                    />
                    <input
                      type="number"
                      step="any"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="Latitude"
                      className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink placeholder:text-muted"
                    />
                    <input
                      type="number"
                      step="any"
                      value={manualLon}
                      onChange={(e) => setManualLon(e.target.value)}
                      placeholder="Longitude"
                      className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink placeholder:text-muted"
                    />
                    <button
                      type="button"
                      onClick={confirmManualEntry}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-white"
                    >
                      Use these coordinates
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <select
              value={Object.keys(HOMES).includes(hostCity) ? hostCity : OTHER_CITY}
              onChange={(e) => {
                if (e.target.value === OTHER_CITY) {
                  setAddingCity(true);
                } else {
                  const resolved = resolveHome(e.target.value);
                  setHostCity(e.target.value);
                  setHostCountry(resolved?.country ?? "");
                  setHostLat(resolved?.lat ?? 0);
                  setHostLon(resolved?.lon ?? 0);
                }
              }}
              className="rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink"
            >
              {Object.keys(HOMES).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
              <option value={OTHER_CITY}>Other city…</option>
            </select>
          )}
          {!addingCity && hostCity && (
            <p className="text-xs text-muted">
              {hostCity}, {hostCountry}
            </p>
          )}
        </section>
      )}

      {(layout === "single-page" || step === 2) && (
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-ink">
            2. Host university <span className="font-sans font-normal text-muted">(optional)</span>
          </h3>
          <input
            type="text"
            list="host-university-options"
            value={hostUniversity}
            onChange={(e) => setHostUniversity(e.target.value)}
            placeholder="Start typing…"
            className="w-full max-w-sm rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink placeholder:text-muted"
          />
          <datalist id="host-university-options">
            {uniNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </section>
      )}

      {(layout === "single-page" || step === 3) && (
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-ink">
            3. Home university <span className="font-sans font-normal text-muted">(optional)</span>
          </h3>
          <input
            type="text"
            value={homeUniversity}
            onChange={(e) => setHomeUniversity(e.target.value)}
            placeholder="Your home-campus school"
            className="w-full max-w-sm rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink placeholder:text-muted"
          />
        </section>
      )}

      {(layout === "single-page" || step === 4) && (
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-ink">4. Term</h3>
          <div className="flex gap-2">
            {(["fall", "spring", "winter"] as Term[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={`rounded-md border px-4 py-1.5 text-sm font-semibold capitalize ${
                  term === t
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted hover:border-primary/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {(layout === "single-page" || step === 5) && (
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-ink">5. Confirm semester dates</h3>

          <ProgramSearchPicker
            key={pickerKey}
            onApply={(sem, p) => {
              setSemester(sem);
              if (/spring/i.test(p.term)) setTerm("spring");
              else if (/fall/i.test(p.term)) setTerm("fall");
            }}
          />

          <SemesterDatesForm
            value={semester}
            onChange={(next) => {
              setPickerKey((k) => k + 1);
              setSemester(next);
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={studyingInEurope}
                onChange={(e) => setStudyingInEurope(e.target.checked)}
                className="accent-primary"
              />
              Studying in Europe
            </label>
            <label className="flex items-center gap-2 text-xs text-ink">
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="rounded-md border border-border bg-surface-muted px-2 py-1 text-ink"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </label>
          </div>
          <p className="text-[11px] text-muted">
            Just saved for now — doesn&apos;t change any prices yet (everything in the app is still
            shown in USD).
          </p>

          {!privacyNoticeSeen && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary-soft px-3 py-2.5 text-xs text-ink">
              <span>
                🔒 By default, everything you enter here stays only in your own browser — no account
                needed. Sign in and it syncs to your own private account instead.{" "}
                <Link href="/privacy" className="font-semibold text-primary underline">
                  Read more
                </Link>
              </span>
              <button
                type="button"
                onClick={dismissPrivacyNotice}
                className="shrink-0 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 font-semibold text-primary"
              >
                Got it
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );

  if (layout === "single-page") {
    return (
      <div className="space-y-6">
        {stepBody}
        <button
          type="button"
          onClick={finish}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
        >
          {submitLabel}
        </button>
      </div>
    );
  }

  const canNext = step === 1 ? !!hostCity && !addingCity : step === 4 ? !!term : true;

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-surface-muted"}`} />
        ))}
      </div>

      {stepBody}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted disabled:opacity-30"
        >
          Back
        </button>
        {step < 5 ? (
          <div className="flex gap-2">
            {(step === 2 || step === 3) && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary/40"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
