// Merged program-calendar dataset: study-abroad *provider* programs (CEA
// CAPA, IES Abroad, CIEE, etc.) AND host universities in one searchable
// list, so the wizard's dates step can auto-fill real published dates for
// either kind from a single picker. University entries are converted
// programmatically from the existing Phase 6 UNIVERSITY_SEMESTERS dataset
// (re-tagged type:"university") rather than re-typed, so there's exactly
// one place those dates live. Provider entries are hand-researched here,
// in batches (see the batch markers below) -- WebSearch + WebFetch each
// provider+city's own official program calendar page (not just the host
// university's calendar, which often differs from a provider's own
// on-site schedule), citing a source URL, same discipline as Phase 6.
//
// Every entry carries the same VERIFY_NOTE: dates genuinely change year to
// year and a wrong guess here is worse than no autofill at all, so nothing
// is ever presented as authoritative -- just a real, cited starting point.
import { UNIVERSITY_SEMESTERS } from "./universitySemesters";
import { postFinalsBreak } from "@/lib/calc/onboarding";
import type { CustomBreak, SemesterConfig } from "@/lib/calc/semester";

export type ProgramType = "provider" | "university";

export interface ProgramBreak {
  label: string;
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
}

export interface ProgramCalendar {
  id: string;
  type: ProgramType;
  name: string;
  city: string;
  country: string;
  term: string; // display label, e.g. "Spring 2027"
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
  breaks: ProgramBreak[];
  sourceUrl?: string;
  verifyNote: string;
}

export const VERIFY_NOTE =
  "Published dates change year to year — verify with your program before booking anything.";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function termLabel(term: "fall" | "spring", startIso: string): string {
  const year = Number(startIso.slice(0, 4));
  return `${term === "fall" ? "Fall" : "Spring"} ${year}`;
}

// --- Universities: converted from the existing Phase 6 dataset, not re-researched ---
const UNIVERSITY_ENTRIES: ProgramCalendar[] = UNIVERSITY_SEMESTERS.map((e) => ({
  id: `${slug(e.university)}-${e.term}-${e.start.slice(0, 4)}`,
  type: "university",
  name: e.university,
  city: e.city,
  country: e.country,
  term: termLabel(e.term, e.start),
  start: e.start,
  end: e.end,
  breaks: e.breaks.map((b) => ({ label: b.label, start: b.start, end: b.end })),
  sourceUrl: e.sourceUrl,
  verifyNote: VERIFY_NOTE,
}));

// --- Providers: hand-researched, batched (each batch = one research pass) ---
// Batch 1 (CEA CAPA + IES Abroad), researched via each provider's own
// official program-calendar page (not the host university's), dates
// verified directly against the site's calendar table, not a summary.
//
// Flags worth a second look (left as researched, not silently corrected):
// - CEA CAPA Prague Spring 2027: a plain "Study in Prague" page under the
//   same track as the Fall 2026 entry wasn't discoverable -- used the
//   "Semester with CEA CAPA & UNYP" partner-track page instead, whose
//   dates were cross-checked identical against the parallel "& Charles
//   University" partner-track page, so this is very likely the shared
//   Prague-center calendar regardless of university partner.
// - CEA CAPA London Spring 2027: same issue -- used "Study + Internship
//   in London" (a genuinely different program, includes an internship
//   component) since a plain semester-only Spring 2027 page wasn't
//   discoverable under its own URL. Worth re-checking against a
//   non-internship program page once one is published.
// - CEA CAPA Barcelona Spring 2027: the official page explicitly says
//   "coming soon" -- genuinely not yet published, not fetched/guessed.
const PROVIDER_ENTRIES: ProgramCalendar[] = [
  { id: "cea-capa-prague-fall-2026", type: "provider", name: "CEA CAPA Prague", city: "Prague", country: "Czechia",
    term: "Fall 2026", start: "2026-08-25", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/study-in-prague-1076/fall-2026-fall-semester-18296",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-prague-spring-2027", type: "provider", name: "CEA CAPA Prague", city: "Prague", country: "Czechia",
    term: "Spring 2027", start: "2027-01-26", end: "2027-05-14", breaks: [],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/semester-with-cea-capa-and-unyp-1161/spring-2027-spring-semester-18579",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-barcelona-fall-2026", type: "provider", name: "CEA CAPA Barcelona", city: "Barcelona", country: "Spain",
    term: "Fall 2026", start: "2026-09-02", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/international-business-331/fall-2026-fall-semester-18130",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-florence-fall-2026", type: "provider", name: "CEA CAPA Florence", city: "Florence", country: "Italy",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-19",
    breaks: [{ label: "Fall Break", start: "2026-10-23", end: "2026-11-01" }],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/study-in-florence-1061/fall-2026-fall-semester-18286",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-florence-spring-2027", type: "provider", name: "CEA CAPA Florence", city: "Florence", country: "Italy",
    term: "Spring 2027", start: "2027-01-12", end: "2027-04-30",
    breaks: [
      { label: "Spring Break", start: "2027-03-05", end: "2027-03-14" },
      { label: "National Holiday (no classes)", start: "2027-03-29", end: "2027-03-29" },
    ],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/study-in-florence-1061/spring-2027-spring-semester-18521",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-london-fall-2026", type: "provider", name: "CEA CAPA London", city: "London", country: "England",
    term: "Fall 2026", start: "2026-09-02", end: "2026-12-12",
    breaks: [{ label: "Fall Break", start: "2026-10-19", end: "2026-10-23" }],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/study-in-london-1065/fall-2026-fall-semester-18248",
    verifyNote: VERIFY_NOTE },
  { id: "cea-capa-london-spring-2027", type: "provider", name: "CEA CAPA London", city: "London", country: "England",
    term: "Spring 2027", start: "2027-01-13", end: "2027-04-24",
    breaks: [{ label: "Spring Break", start: "2027-03-01", end: "2027-03-05" }],
    sourceUrl: "https://www.ceastudyabroad.com/program/program-details/study---internship-in-london-958/spring-2027-spring-semester-18486",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-barcelona-fall-2026", type: "provider", name: "IES Abroad Barcelona", city: "Barcelona", country: "Spain",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/barcelona-liberal-arts-business",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-barcelona-spring-2027", type: "provider", name: "IES Abroad Barcelona", city: "Barcelona", country: "Spain",
    term: "Spring 2027", start: "2027-01-07", end: "2027-04-30", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/barcelona-liberal-arts-business",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-vienna-fall-2026", type: "provider", name: "IES Abroad Vienna", city: "Vienna", country: "Austria",
    term: "Fall 2026", start: "2026-08-24", end: "2026-12-12", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/vienna-business-economics-international-relations",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-vienna-spring-2027", type: "provider", name: "IES Abroad Vienna", city: "Vienna", country: "Austria",
    term: "Spring 2027", start: "2027-01-18", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/vienna-business-economics-international-relations",
    verifyNote: VERIFY_NOTE },
];

export const PROGRAM_CALENDARS: ProgramCalendar[] = [...UNIVERSITY_ENTRIES, ...PROVIDER_ENTRIES];

/** Typing-assist suggestions for the plain-text "Host university" field
 * (Step 2) -- distinct from searchPrograms(), which drives the actual
 * date auto-fill in Step 5. */
export function universityProgramNames(): string[] {
  return Array.from(new Set(PROGRAM_CALENDARS.filter((p) => p.type === "university").map((p) => p.name))).sort();
}

export function searchPrograms(query: string, limit = 8): ProgramCalendar[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PROGRAM_CALENDARS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q)
  )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Converts a chosen program's real dates into the app's SemesterConfig
 * shape -- a post-finals window is always appended (computed, never
 * researched), matching every other semester source in this app. */
export function toSemesterConfig(entry: ProgramCalendar): SemesterConfig {
  const breaks: CustomBreak[] = entry.breaks.map((b, i) => ({
    id: `${entry.id}-b${i}`,
    label: b.label,
    start: b.start,
    end: b.end,
    kind: "break",
  }));
  breaks.push(postFinalsBreak(entry.end));
  return { start: entry.start, end: entry.end, breaks };
}
