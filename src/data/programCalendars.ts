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

  // Batch 2 (CIEE + API), same discipline: each provider's own program
  // page, dates read directly off the page, not a summary.
  //
  // Flags worth a second look:
  // - CIEE (all 4 cities): none of the official pages publish specific
  //   break/excursion dates -- they only mention excursions in general
  //   prose (named destinations, no dates). breaks: [] reflects the real
  //   page content, not a search gap.
  // - API Florence: apiabroad.com's own program page is a JS-rendered app
  //   that can't be scraped directly, and API's own program page (per a
  //   university study-abroad-office mirror) explicitly tells students to
  //   use the LdM (Lorenzo de' Medici, the host institute) academic
  //   calendar for exact dates -- so this genuinely is the real source of
  //   truth for API Florence, not a substitute, even though it's LdM's PDF
  //   rather than apiabroad.com's own page.
  // - API Barcelona: deliberately NOT included. Two university
  //   study-abroad mirrors gave conflicting Spring 2027 dates (Jan 7-May
  //   11 vs. Jan 10-Apr 28) and Fall 2026 wasn't found anywhere -- rather
  //   than guess between two conflicting numbers, this is skipped entirely
  //   until it can be confirmed against API's own page.
  { id: "ciee-prague-fall-2026", type: "provider", name: "CIEE Prague", city: "Prague", country: "Czechia",
    term: "Fall 2026", start: "2026-09-08", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/czech-republic/prague/semester-prague",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-prague-spring-2027", type: "provider", name: "CIEE Prague", city: "Prague", country: "Czechia",
    term: "Spring 2027", start: "2027-01-26", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/czech-republic/prague/semester-prague",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-berlin-fall-2026", type: "provider", name: "CIEE Berlin", city: "Berlin", country: "Germany",
    term: "Fall 2026", start: "2026-09-07", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/germany/berlin/semester-berlin",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-berlin-spring-2027", type: "provider", name: "CIEE Berlin", city: "Berlin", country: "Germany",
    term: "Spring 2027", start: "2027-01-04", end: "2027-05-15", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/germany/berlin/semester-berlin",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-paris-fall-2026", type: "provider", name: "CIEE Paris", city: "Paris", country: "France",
    term: "Fall 2026", start: "2026-08-17", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/france/paris/semester-paris",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-paris-spring-2027", type: "provider", name: "CIEE Paris", city: "Paris", country: "France",
    term: "Spring 2027", start: "2027-01-02", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/france/paris/semester-paris",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-rome-fall-2026", type: "provider", name: "CIEE Rome", city: "Rome", country: "Italy",
    term: "Fall 2026", start: "2026-08-17", end: "2026-12-05", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/italy/rome/semester-rome",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-rome-spring-2027", type: "provider", name: "CIEE Rome", city: "Rome", country: "Italy",
    term: "Spring 2027", start: "2027-01-25", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/italy/rome/semester-rome",
    verifyNote: VERIFY_NOTE },
  { id: "api-florence-fall-2026", type: "provider", name: "API Florence", city: "Florence", country: "Italy",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-19",
    breaks: [{ label: "Fall Break", start: "2026-10-26", end: "2026-10-30" }],
    sourceUrl: "https://ldminstitute.com/wp-content/uploads/2025/12/LdM-Academic-Calendar-2026-2027_2025.12.10.pdf",
    verifyNote: VERIFY_NOTE },
  { id: "api-florence-spring-2027", type: "provider", name: "API Florence", city: "Florence", country: "Italy",
    term: "Spring 2027", start: "2027-01-26", end: "2027-05-15",
    breaks: [{ label: "Spring Break", start: "2027-03-22", end: "2027-03-26" }],
    sourceUrl: "https://ldminstitute.com/wp-content/uploads/2025/12/LdM-Academic-Calendar-2026-2027_2025.12.10.pdf",
    verifyNote: VERIFY_NOTE },

  // Batch 3 (Arcadia, AIFS, ISA, SAI) -- the thinnest batch so far in terms
  // of coverage per provider, flagged rather than padded out:
  // - Arcadia's own domain (studyabroad.arcadia.edu) 403'd every fetch
  //   attempt, including via Google cache -- both Arcadia entries below
  //   came from a partner university's education-abroad portal (UT
  //   Austin's utdirect.utexas.edu, which mirrors Arcadia's official
  //   program data), same workaround pattern as batch 2's API/LdM case.
  //   Only Arcadia London Spring 2027 was findable this way -- Fall 2026
  //   and both Arcadia Granada terms are NOT included: a WebSearch summary
  //   claimed a Fall 2026 date for London, but the underlying page only
  //   actually displayed Spring 2027 when fetched directly, so the claim
  //   was dropped rather than trusted unverified. Granada's program is
  //   real and current (a genuine UGR-partnered offering) but only
  //   2025/2026 dates were reachable, not the requested terms.
  // - AIFS Florence Spring 2027 came from a partner community college's
  //   page (Santa Rosa Junior College) that had transcribed AIFS's full
  //   calendar in detail, since aifsabroad.com's own Spring 2027 page
  //   exists but doesn't expose date content to a direct fetch (likely
  //   client-rendered) -- one step removed from AIFS's own copy, moderate
  //   confidence but internally detailed and consistent.
  // - AIFS London Spring 2027 wasn't found anywhere -- several program-
  //   variant URLs all only showed Fall 2026 detail.
  // - AIFS London Fall 2026's own official PDF literally labels its
  //   Oct 17-25 break "Spring Break" despite being the Fall term -- a
  //   clear copy-paste template artifact in AIFS's own document, not an
  //   error introduced here. Relabeled "Fall Break" below for sanity.
  // - ISA is now marketed under the WorldStrides brand
  //   (studiesabroad.com redirects to worldstrides.com) -- dates below are
  //   current on that live domain, under what's still called the ISA
  //   Barcelona program.
  { id: "aifs-florence-fall-2026", type: "provider", name: "AIFS Florence", city: "Florence", country: "Italy",
    term: "Fall 2026", start: "2026-09-03", end: "2026-12-04", breaks: [],
    sourceUrl: "https://www.aifsabroad.com/programs/study-abroad-florence-semester",
    verifyNote: VERIFY_NOTE },
  { id: "aifs-florence-spring-2027", type: "provider", name: "AIFS Florence", city: "Florence", country: "Italy",
    term: "Spring 2027", start: "2027-01-31", end: "2027-04-30",
    breaks: [{ label: "Mid-Semester Break", start: "2027-03-13", end: "2027-03-21" }],
    sourceUrl: "https://study-abroad.santarosa.edu/florence-spring-2027-information",
    verifyNote: VERIFY_NOTE },
  { id: "aifs-london-fall-2026", type: "provider", name: "AIFS London", city: "London", country: "England",
    term: "Fall 2026", start: "2026-09-04", end: "2026-12-04",
    breaks: [{ label: "Fall Break", start: "2026-10-17", end: "2026-10-25" }],
    sourceUrl: "https://secure.aifsabroad.com/College/Common/ViewDocument.aspx?docType=catalog&division=PART&docPath=QGNYHA1EIRQR/NCSAC+London+Info.pdf",
    verifyNote: VERIFY_NOTE },
  { id: "arcadia-london-spring-2027", type: "provider", name: "Arcadia London", city: "London", country: "England",
    term: "Spring 2027", start: "2027-01-04", end: "2027-04-19", breaks: [],
    sourceUrl: "https://utdirect.utexas.edu/apps/abroad/student/pgm_list/detail/nlogon/61/",
    verifyNote: VERIFY_NOTE },
  { id: "isa-barcelona-fall-2026", type: "provider", name: "ISA Barcelona", city: "Barcelona", country: "Spain",
    term: "Fall 2026", start: "2026-09-05", end: "2026-12-18", breaks: [],
    sourceUrl: "https://worldstrides.com/destinations/europe/spain/barcelona/international-studies-business--culture",
    verifyNote: VERIFY_NOTE },
  { id: "isa-barcelona-spring-2027", type: "provider", name: "ISA Barcelona", city: "Barcelona", country: "Spain",
    term: "Spring 2027", start: "2027-01-09", end: "2027-04-28", breaks: [],
    sourceUrl: "https://worldstrides.com/destinations/europe/spain/barcelona/international-studies-business--culture",
    verifyNote: VERIFY_NOTE },
  { id: "sai-rome-fall-2026", type: "provider", name: "SAI Rome", city: "Rome", country: "Italy",
    term: "Fall 2026", start: "2026-08-26", end: "2026-12-12", breaks: [],
    sourceUrl: "https://www.saiprograms.com/rome/jcu/jcu-fall-semester-2026",
    verifyNote: VERIFY_NOTE },
  { id: "sai-rome-spring-2027", type: "provider", name: "SAI Rome", city: "Rome", country: "Italy",
    term: "Spring 2027", start: "2027-01-13", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.saiprograms.com/rome/jcu/jcu-spring-semester-2027",
    verifyNote: VERIFY_NOTE },

  // Batch 4 -- expanding city coverage for providers already in the
  // dataset (CEA CAPA, IES Abroad, CIEE) rather than new provider names.
  // - CEA CAPA Dublin and CEA CAPA Rome are NOT included: ceastudyabroad.com
  //   returned a hard 403 Forbidden on every program-details URL tried
  //   (5+ distinct pages, both cities, both terms) -- looks like systematic
  //   bot-blocking, not a one-off. Partner-institution mirrors (Wake
  //   Forest for Rome, a Memphis studioabroad mirror for Dublin) show the
  //   real reason isn't just the fetch tool: Rome's own mirror lists Spring
  //   2027 as "Forthcoming" and Dublin's lists all upcoming terms as "TBA"
  //   -- CEA CAPA itself may not have finalized these specific dates yet.
  // - CIEE's own program pages label these as "tentative dates" with a
  //   note to confirm with an advisor before booking flights -- a real
  //   caveat from the source itself, not a hedge added here.
  // - IES Abroad Rome: IES splits each city into several discipline-
  //   specific program pages rather than one city page. Dates were pulled
  //   from "Rome - Language & Area Studies" and cross-checked identical
  //   against "Rome - Business Studies" and "Rome - International
  //   Relations," so this is treated as the Rome center's one shared
  //   semester calendar, not something specific to a single track.
  { id: "ciee-dublin-fall-2026", type: "provider", name: "CIEE Dublin", city: "Dublin", country: "Ireland",
    term: "Fall 2026", start: "2026-08-31", end: "2026-12-20", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/ireland/dublin/semester-dublin",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-dublin-spring-2027", type: "provider", name: "CIEE Dublin", city: "Dublin", country: "Ireland",
    term: "Spring 2027", start: "2027-01-04", end: "2027-05-02", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/ireland/dublin/semester-dublin",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-barcelona-fall-2026", type: "provider", name: "CIEE Barcelona", city: "Barcelona", country: "Spain",
    term: "Fall 2026", start: "2026-09-02", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/spain/barcelona/semester-barcelona",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-barcelona-spring-2027", type: "provider", name: "CIEE Barcelona", city: "Barcelona", country: "Spain",
    term: "Spring 2027", start: "2027-01-04", end: "2027-04-24", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/spain/barcelona/semester-barcelona",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-london-fall-2026", type: "provider", name: "IES Abroad London", city: "London", country: "England",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-12", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/london-study-london",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-london-spring-2027", type: "provider", name: "IES Abroad London", city: "London", country: "England",
    term: "Spring 2027", start: "2027-01-12", end: "2027-04-24", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/london-study-london",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-rome-fall-2026", type: "provider", name: "IES Abroad Rome", city: "Rome", country: "Italy",
    term: "Fall 2026", start: "2026-08-31", end: "2026-12-10", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/rome-language-area-studies",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-rome-spring-2027", type: "provider", name: "IES Abroad Rome", city: "Rome", country: "Italy",
    term: "Spring 2027", start: "2027-01-25", end: "2027-05-06", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/rome-language-area-studies",
    verifyNote: VERIFY_NOTE },

  // Batch 5 -- more city coverage. CEA CAPA skipped entirely this round
  // (batch 4's 403 bot-blocking was domain-wide, not city-specific, so
  // not worth retrying yet).
  // - CIEE Amsterdam's own page labels its "Semester in Amsterdam" as a
  //   12-week program (shorter than the ~15-16 week semester norm
  //   elsewhere in this dataset) and calls its own dates "tentative" --
  //   fetched twice to rule out grabbing the wrong track (CIEE separately
  //   offers a "Quarter" and "Open Campus Block" in Amsterdam too), both
  //   fetches agreed, so this looks like a genuine structural quirk of
  //   that program rather than a scraping error.
  // - IES Abroad Madrid/Berlin: IES runs multiple parallel program tracks
  //   per city (Language & Area Studies / Business / Security Studies /
  //   etc.) with slightly different day-level dates -- one track was
  //   picked per city for consistency; the deltas between tracks are only
  //   a few days.
  // - AIFS Barcelona Spring 2027 is NOT included -- the program's own
  //   dates page is a JS Fall/Spring toggle that only ever exposed Fall
  //   2026 content to a static fetch. Fall 2026 also mentions a real,
  //   included "Pyrenees excursion" with no published date range -- left
  //   out of breaks entirely rather than recorded with placeholder dates.
  // - API Madrid: NOT included, and likely doesn't exist rather than just
  //   being unsourced -- API's own Spain destination list names Barcelona,
  //   Bilbao, Granada, Salamanca, Seville, and Valencia, with no Madrid
  //   program among them.
  // - ISA Florence: NOT included -- "ISA" appears to have been fully
  //   absorbed into the WorldStrides Higher Ed brand (isabroad.org now
  //   redirects through studiesabroad.com to worldstrides.com with no ISA
  //   branding left), and the only Florence programs findable under
  //   WorldStrides are unrelated "Florence University of the Arts" (FUA)
  //   tracks, not ISA.
  { id: "ciee-amsterdam-fall-2026", type: "provider", name: "CIEE Amsterdam", city: "Amsterdam", country: "Netherlands",
    term: "Fall 2026", start: "2026-08-17", end: "2026-11-07", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/netherlands/amsterdam/semester-amsterdam",
    verifyNote: VERIFY_NOTE },
  { id: "ciee-amsterdam-spring-2027", type: "provider", name: "CIEE Amsterdam", city: "Amsterdam", country: "Netherlands",
    term: "Spring 2027", start: "2027-01-04", end: "2027-03-27", breaks: [],
    sourceUrl: "https://www.ciee.org/go-abroad/college-study-abroad/programs/netherlands/amsterdam/semester-amsterdam",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-madrid-fall-2026", type: "provider", name: "IES Abroad Madrid", city: "Madrid", country: "Spain",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/madrid-language-area-studies",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-madrid-spring-2027", type: "provider", name: "IES Abroad Madrid", city: "Madrid", country: "Spain",
    term: "Spring 2027", start: "2027-01-13", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/madrid-language-area-studies",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-berlin-fall-2026", type: "provider", name: "IES Abroad Berlin", city: "Berlin", country: "Germany",
    term: "Fall 2026", start: "2026-09-02", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/berlin-security-studies-international-affairs",
    verifyNote: VERIFY_NOTE },
  { id: "ies-abroad-berlin-spring-2027", type: "provider", name: "IES Abroad Berlin", city: "Berlin", country: "Germany",
    term: "Spring 2027", start: "2027-01-20", end: "2027-05-08", breaks: [],
    sourceUrl: "https://www.iesabroad.org/programs/berlin-security-studies-international-affairs",
    verifyNote: VERIFY_NOTE },
  { id: "aifs-barcelona-fall-2026", type: "provider", name: "AIFS Barcelona", city: "Barcelona", country: "Spain",
    term: "Fall 2026", start: "2026-09-01", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.aifsabroad.com/programs/study-abroad-barcelona-semester/",
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
