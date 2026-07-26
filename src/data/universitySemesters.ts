// Phase 6 seed database: researched (not AI-guessed at runtime) academic
// calendars for common European study-abroad host universities, Fall 2026 /
// Spring 2027. Each entry cites the academic-calendar URL it came from so
// Parker (or anyone else) can spot-check it. A university/term not covered
// here just falls back to onboarding's smart manual-entry defaults (see
// src/lib/calc/onboarding.ts) -- nothing here is load-bearing for the app to
// work, it's purely an autocomplete convenience. Post-finals windows are
// NOT included below -- they're computed at onboarding time regardless of
// source (see postFinalsBreak in src/lib/calc/onboarding.ts), not researched.
//
// To add more universities later: run another research session like the one
// that built this file (WebSearch + WebFetch each university's official
// academic-calendar page, cite the URL, skip anything you can't source) --
// no API key needed. Append entries to UNIVERSITY_SEMESTERS below.
//
// Known gaps (no official 2026-27 calendar was findable at research time --
// re-check after these universities publish, don't guess in the meantime):
// Vrije Universiteit Amsterdam, Vesalius College Brussels, Aarhus University,
// University of Copenhagen, Deree spring term, Humboldt-Universitat zu Berlin,
// Universidade Catolica Portuguesa Lisboa, The American University of Paris.
//
// Flags worth a second look (left as researched, not corrected):
// - AAU Prague's real published Spring 2027 term is Jan 29 - May 14, 2027 --
//   this does NOT match the app's existing hardcoded AAU baseline (Jan 24 -
//   May 24) in src/data/slots.ts / DEFAULT_SEMESTER. That baseline is
//   deliberately left untouched (Parker's existing plans depend on it) --
//   flagged to him directly rather than silently reconciled.
// - Universitat Pompeu Fabra's reported spring window (Apr 1 - Jun 22, with
//   an Easter break dated *before* that start) looks like it may reflect a
//   trimester rather than semester system -- worth independent confirmation.
// - IE University's spring end date (Apr 21) is specifically for 1st/2nd-
//   year students per its source PDF; other class years may run later.
// - King's College London spring 2027: a second, independent fetch of the
//   same source during spot-checking returned "teaching Jan 22 - Mar 25"
//   rather than the "Jan 25 - Jun 4" recorded below -- KCL's page appears to
//   distinguish "teaching weeks" from a longer semester-with-exams span and
//   it's ambiguous which one this is. Left as researched; worth Parker's own
//   look before trusting it fully.
import type { CustomBreak } from "@/lib/calc/semester";

export interface UniversitySemesterEntry {
  university: string;
  city: string;
  country: string;
  term: "fall" | "spring";
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd -- official program end date
  breaks: CustomBreak[];
  sourceUrl: string;
}

function b(label: string, start: string, end: string, id: string): CustomBreak {
  return { id, label, start, end, kind: "break" };
}

export const UNIVERSITY_SEMESTERS: UniversitySemesterEntry[] = [
  // --- UK & Ireland ---
  { university: "University College Dublin", city: "Dublin", country: "Ireland", term: "fall",
    start: "2026-08-31", end: "2027-01-17", breaks: [],
    sourceUrl: "https://www.ucd.ie/students/t4media/Academic_dates2026_27.pdf" },
  { university: "University College Dublin", city: "Dublin", country: "Ireland", term: "spring",
    start: "2027-01-18", end: "2027-05-16",
    breaks: [b("Fieldwork/Study period", "2027-03-08", "2027-03-21", "study")],
    sourceUrl: "https://www.ucd.ie/students/t4media/Academic_dates2026_27.pdf" },
  { university: "Trinity College Dublin", city: "Dublin", country: "Ireland", term: "fall",
    start: "2026-09-14", end: "2026-12-22", breaks: [],
    sourceUrl: "https://www.tcd.ie/students/orientation/dates/" },
  { university: "Trinity College Dublin", city: "Dublin", country: "Ireland", term: "spring",
    start: "2027-01-18", end: "2027-04-30", breaks: [],
    sourceUrl: "https://www.tcd.ie/students/orientation/dates/" },
  { university: "King's College London", city: "London", country: "United Kingdom", term: "fall",
    start: "2026-09-28", end: "2027-01-22",
    breaks: [b("Reading Week", "2026-11-02", "2026-11-06", "reading")],
    sourceUrl: "https://self-service.kcl.ac.uk/article/ka-01913/en-us" },
  { university: "King's College London", city: "London", country: "United Kingdom", term: "spring",
    start: "2027-01-25", end: "2027-06-04",
    breaks: [b("Reading Week", "2027-03-01", "2027-03-05", "reading")],
    sourceUrl: "https://self-service.kcl.ac.uk/article/ka-01913/en-us" },
  { university: "University College London", city: "London", country: "United Kingdom", term: "fall",
    start: "2026-09-28", end: "2026-12-18",
    breaks: [b("Reading Week", "2026-11-09", "2026-11-13", "reading")],
    sourceUrl: "https://www.ucl.ac.uk/srs/sites/srs/files/ucl_calendar_2026_27v1.pdf" },
  { university: "University College London", city: "London", country: "United Kingdom", term: "spring",
    start: "2027-01-11", end: "2027-06-11",
    breaks: [
      b("Reading Week", "2027-02-15", "2027-02-19", "reading"),
      b("Easter break", "2027-03-25", "2027-04-25", "easter"),
    ],
    sourceUrl: "https://www.ucl.ac.uk/study/current-students/life-ucl/term-dates-and-closures" },
  { university: "University of Edinburgh", city: "Edinburgh", country: "United Kingdom", term: "fall",
    start: "2026-09-21", end: "2026-12-21", breaks: [],
    sourceUrl: "https://semester-dates.ed.ac.uk/202627" },
  { university: "University of Edinburgh", city: "Edinburgh", country: "United Kingdom", term: "spring",
    start: "2027-01-11", end: "2027-05-22",
    breaks: [
      b("Flexible Learning Week", "2027-02-15", "2027-02-19", "flw"),
      b("Spring Break", "2027-04-05", "2027-04-16", "spring"),
    ],
    sourceUrl: "https://semester-dates.ed.ac.uk/202627" },
  { university: "University of St Andrews", city: "St Andrews", country: "United Kingdom", term: "fall",
    start: "2026-09-14", end: "2026-12-21",
    breaks: [
      b("Independent Learning Week", "2026-10-19", "2026-10-23", "ilw1"),
      b("Revision Week", "2026-11-30", "2026-12-04", "revision"),
    ],
    sourceUrl: "https://www.st-andrews.ac.uk/semester-dates/2026-2027/" },
  { university: "University of St Andrews", city: "St Andrews", country: "United Kingdom", term: "spring",
    start: "2027-01-25", end: "2027-05-24",
    breaks: [
      b("Spring Vacation", "2027-03-01", "2027-03-07", "spring"),
      b("Independent Learning Week", "2027-04-05", "2027-04-09", "ilw2"),
    ],
    sourceUrl: "https://www.st-andrews.ac.uk/semester-dates/2026-2027/" },
  { university: "Queen's University Belfast", city: "Belfast", country: "United Kingdom", term: "fall",
    start: "2026-09-21", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.qub.ac.uk/Study/international-students/incoming-exchange/semester-dates/2026-27/" },
  { university: "Queen's University Belfast", city: "Belfast", country: "United Kingdom", term: "spring",
    start: "2027-01-18", end: "2027-05-28",
    breaks: [b("Easter Vacation", "2027-03-22", "2027-04-02", "easter")],
    sourceUrl: "https://www.qub.ac.uk/Study/international-students/incoming-exchange/semester-dates/2026-27/" },
  // country corrected from "United Kingdom" to "Scotland" during UIUC
  // partner research (batch 5) -- this app treats England/Scotland/
  // Wales/Northern Ireland as their own countries (Schengen exemption
  // logic depends on it), a convention this specific entry predated.
  { university: "University of Glasgow", city: "Glasgow", country: "Scotland", term: "fall",
    start: "2026-09-21", end: "2026-12-18",
    breaks: [b("Winter Break", "2026-12-23", "2027-01-04", "winter")],
    sourceUrl: "https://www.gla.ac.uk/myglasgow/apg/sessiondates/session2026-27/" },
  { university: "University of Glasgow", city: "Glasgow", country: "Scotland", term: "spring",
    start: "2027-01-11", end: "2027-05-28",
    breaks: [b("Spring Break", "2027-03-29", "2027-04-16", "spring")],
    sourceUrl: "https://www.gla.ac.uk/myglasgow/apg/sessiondates/session2026-27/" },
  { university: "Royal Holloway, University of London", city: "Egham", country: "United Kingdom", term: "fall",
    start: "2026-09-21", end: "2026-12-11", breaks: [],
    sourceUrl: "https://www.royalholloway.ac.uk/about-us/more/term-dates/" },
  { university: "Royal Holloway, University of London", city: "Egham", country: "United Kingdom", term: "spring",
    start: "2027-01-11", end: "2027-06-11",
    breaks: [b("Easter Break", "2027-03-26", "2027-04-25", "easter")],
    sourceUrl: "https://www.royalholloway.ac.uk/about-us/more/term-dates/" },
  { university: "Maynooth University", city: "Maynooth", country: "Ireland", term: "fall",
    start: "2026-09-21", end: "2027-01-23",
    breaks: [
      b("Reading/Study Week", "2026-10-26", "2026-10-30", "reading"),
      b("Pre-exam Study Week", "2027-01-04", "2027-01-09", "prexam"),
    ],
    sourceUrl: "https://www.maynoothuniversity.ie/sites/default/files/assets/document/Academic%20Calendar%202026-2027...(approved%20AC%2003Nov2025).pdf" },
  { university: "Maynooth University", city: "Maynooth", country: "Ireland", term: "spring",
    start: "2027-02-02", end: "2027-05-29",
    breaks: [b("Study Week", "2027-05-10", "2027-05-15", "study")],
    sourceUrl: "https://www.maynoothuniversity.ie/sites/default/files/assets/document/Academic%20Calendar%202026-2027...(approved%20AC%2003Nov2025).pdf" },

  // --- France, Spain, Italy ---
  { university: "Sciences Po Paris", city: "Paris", country: "France", term: "fall",
    start: "2026-09-07", end: "2026-12-09",
    breaks: [
      b("Autumn Break", "2026-10-26", "2026-11-01", "autumn"),
      b("Holiday Break", "2026-12-19", "2027-01-04", "holiday"),
    ],
    sourceUrl: "https://www.sciencespo.fr/students/en/study/academic-affairs/university-calendar/" },
  { university: "Sciences Po Paris", city: "Paris", country: "France", term: "spring",
    start: "2027-01-23", end: "2027-04-26",
    breaks: [b("Winter Break", "2027-02-15", "2027-02-21", "winter")],
    sourceUrl: "https://www.sciencespo.fr/students/en/study/academic-affairs/university-calendar/" },
  { university: "Sorbonne Universite", city: "Paris", country: "France", term: "fall",
    start: "2026-09-14", end: "2027-01-15", breaks: [],
    sourceUrl: "https://lettres.sorbonne-universite.fr/sites/default/files/media/2026-07/Calendrier%20facultaire%20Lettres%202026_2027.pdf" },
  { university: "Sorbonne Universite", city: "Paris", country: "France", term: "spring",
    start: "2027-01-25", end: "2027-06-28", breaks: [],
    sourceUrl: "https://lettres.sorbonne-universite.fr/sites/default/files/media/2026-07/Calendrier%20facultaire%20Lettres%202026_2027.pdf" },
  { university: "IE University", city: "Madrid", country: "Spain", term: "fall",
    start: "2026-08-31", end: "2026-12-18",
    breaks: [b("Winter Break", "2026-12-19", "2027-01-10", "winter")],
    sourceUrl: "https://docs.ie.edu/university/Calendarios/IEU-Academic-Calendar-2026-2027.pdf" },
  { university: "IE University", city: "Madrid", country: "Spain", term: "spring",
    start: "2027-01-30", end: "2027-04-21",
    breaks: [b("Spring Break", "2027-03-20", "2027-03-29", "spring")],
    sourceUrl: "https://docs.ie.edu/university/Calendarios/IEU-Academic-Calendar-2026-2027.pdf" },
  { university: "Universidad Pontificia Comillas (ICADE)", city: "Madrid", country: "Spain", term: "fall",
    start: "2026-09-01", end: "2026-12-23", breaks: [],
    sourceUrl: "https://sp.upcomillas.es/centros/facultades/economicas/DocumentosCCEE/RELACIONES%20INTERNACIONALES/Incoming%20Students/Fact%20Sheet/Fact%20Sheet%20Undergraduate%20ICADE.pdf" },
  { university: "Universidad Pontificia Comillas (ICADE)", city: "Madrid", country: "Spain", term: "spring",
    start: "2027-01-11", end: "2027-05-21",
    breaks: [b("Holy Week", "2027-03-25", "2027-03-26", "holyweek")],
    sourceUrl: "https://sp.upcomillas.es/centros/facultades/economicas/DocumentosCCEE/RELACIONES%20INTERNACIONALES/Incoming%20Students/Fact%20Sheet/Fact%20Sheet%20Undergraduate%20ICADE.pdf" },
  { university: "ESADE Business School", city: "Barcelona", country: "Spain", term: "fall",
    start: "2026-09-07", end: "2026-12-04", breaks: [],
    sourceUrl: "https://incoming-iep.nccu.edu.tw/sites/default/files/ESADE%20Exchange%20Fact%20Sheet%202026-2027.pdf" },
  { university: "ESADE Business School", city: "Barcelona", country: "Spain", term: "spring",
    start: "2027-01-11", end: "2027-05-14", breaks: [],
    sourceUrl: "https://incoming-iep.nccu.edu.tw/sites/default/files/ESADE%20Exchange%20Fact%20Sheet%202026-2027.pdf" },
  { university: "Universitat Pompeu Fabra", city: "Barcelona", country: "Spain", term: "fall",
    start: "2026-09-21", end: "2026-12-18",
    breaks: [b("Christmas Break", "2026-12-19", "2027-01-06", "christmas")],
    sourceUrl: "https://www.upf.edu/web/studyabroad/dates" },
  { university: "Universitat Pompeu Fabra", city: "Barcelona", country: "Spain", term: "spring",
    start: "2027-04-01", end: "2027-06-22",
    breaks: [b("Easter Break", "2027-03-20", "2027-03-29", "easter")],
    sourceUrl: "https://www.upf.edu/web/studyabroad/dates" },
  { university: "Bocconi University", city: "Milan", country: "Italy", term: "fall",
    start: "2026-09-02", end: "2027-02-02",
    breaks: [b("Christmas Break", "2026-12-24", "2027-01-06", "christmas")],
    sourceUrl: "https://www.unibocconi.it/en/international-students/incoming-exchange-students/academics-exchange-students-academic-calendar-202627" },
  { university: "Bocconi University", city: "Milan", country: "Italy", term: "spring",
    start: "2027-02-03", end: "2027-07-10",
    breaks: [b("Easter Break", "2027-03-27", "2027-03-30", "easter")],
    sourceUrl: "https://www.unibocconi.it/en/international-students/incoming-exchange-students/academics-exchange-students-academic-calendar-202627" },
  { university: "John Cabot University", city: "Rome", country: "Italy", term: "fall",
    start: "2026-08-31", end: "2026-12-03",
    breaks: [b("Thanksgiving Holiday", "2026-11-26", "2026-11-26", "thanksgiving")],
    sourceUrl: "https://www.johncabot.edu/academics/calendar" },
  { university: "John Cabot University", city: "Rome", country: "Italy", term: "spring",
    start: "2027-01-18", end: "2027-04-29",
    breaks: [
      b("Spring Break", "2027-03-08", "2027-03-12", "spring"),
      b("Holiday", "2027-03-29", "2027-03-29", "holiday"),
    ],
    sourceUrl: "https://www.johncabot.edu/academics/calendar" },
  { university: "The American University of Rome", city: "Rome", country: "Italy", term: "fall",
    start: "2026-08-31", end: "2026-12-11",
    breaks: [b("Fall Break", "2026-10-19", "2026-10-23", "fall")],
    sourceUrl: "https://my.aur.edu/ICS/Portlets/ICS/Portlet.Resources/ViewHandler.ashx?id=d47bdb7d-3d99-470e-8d79-9ac80c9b9cdf" },
  { university: "The American University of Rome", city: "Rome", country: "Italy", term: "spring",
    start: "2027-01-18", end: "2027-05-04",
    breaks: [b("Spring Break", "2027-03-08", "2027-03-12", "spring")],
    sourceUrl: "https://my.aur.edu/ICS/Portlets/ICS/Portlet.Resources/ViewHandler.ashx?id=64dbf028-7f4c-44a7-8c8b-42f268fc846a" },

  // --- Czechia, Austria, Hungary, Germany, Portugal ---
  { university: "Anglo-American University", city: "Prague", country: "Czechia", term: "fall",
    start: "2026-08-31", end: "2026-12-15",
    breaks: [b("Mid-term break", "2026-10-26", "2026-10-30", "midterm")],
    sourceUrl: "https://www.aauni.edu/about/academic-calendar/academic-calendar-2026-2027/" },
  { university: "Anglo-American University", city: "Prague", country: "Czechia", term: "spring",
    start: "2027-01-29", end: "2027-05-14",
    breaks: [b("Mid-term break", "2027-03-29", "2027-04-02", "midterm")],
    sourceUrl: "https://www.aauni.edu/about/academic-calendar/academic-calendar-2026-2027/" },
  { university: "Charles University", city: "Prague", country: "Czechia", term: "fall",
    start: "2026-09-16", end: "2027-02-12", breaks: [],
    sourceUrl: "https://cuni.cz/UKEN-368.html" },
  { university: "Charles University", city: "Prague", country: "Czechia", term: "spring",
    start: "2027-02-15", end: "2027-06-30", breaks: [],
    sourceUrl: "https://cuni.cz/UKEN-368.html" },
  { university: "University of Vienna", city: "Vienna", country: "Austria", term: "fall",
    start: "2026-10-01", end: "2027-01-31",
    breaks: [b("Christmas break", "2026-12-21", "2027-01-06", "christmas")],
    sourceUrl: "https://studieren.univie.ac.at/en/semester-planning/the-academic-year/" },
  { university: "University of Vienna", city: "Vienna", country: "Austria", term: "spring",
    start: "2027-03-01", end: "2027-06-30",
    breaks: [
      b("Easter break", "2027-03-22", "2027-04-04", "easter"),
      b("Whitsun break", "2027-05-15", "2027-05-17", "whitsun"),
    ],
    sourceUrl: "https://studieren.univie.ac.at/en/semester-planning/the-academic-year/" },
  { university: "WU Vienna", city: "Vienna", country: "Austria", term: "fall",
    start: "2026-10-01", end: "2027-01-31",
    breaks: [b("Christmas break", "2026-12-24", "2027-01-06", "christmas")],
    sourceUrl: "https://www.wu.ac.at/en/programs/international-and-exchange-students/incoming-exchange-students/exchange-semester/your-semester-at-wu-from-start-to-finish/dates-and-deadlines" },
  { university: "WU Vienna", city: "Vienna", country: "Austria", term: "spring",
    start: "2027-03-01", end: "2027-06-27",
    breaks: [b("Easter break", "2027-03-22", "2027-03-29", "easter")],
    sourceUrl: "https://www.wu.ac.at/en/programs/international-and-exchange-students/incoming-exchange-students/exchange-semester/your-semester-at-wu-from-start-to-finish/dates-and-deadlines" },
  { university: "Corvinus University of Budapest", city: "Budapest", country: "Hungary", term: "fall",
    start: "2026-08-31", end: "2027-01-31",
    breaks: [
      b("Autumn break", "2026-10-26", "2026-11-01", "autumn"),
      b("Winter break", "2026-12-20", "2027-01-03", "winter"),
    ],
    sourceUrl: "https://www.uni-corvinus.hu/post/hir/the-2026-2027-academic-year-schedule-and-public-holidays-have-been-published/?lang=en" },
  { university: "Corvinus University of Budapest", city: "Budapest", country: "Hungary", term: "spring",
    start: "2027-02-08", end: "2027-06-27",
    breaks: [b("Spring break", "2027-03-30", "2027-04-04", "spring")],
    sourceUrl: "https://www.uni-corvinus.hu/post/hir/the-2026-2027-academic-year-schedule-and-public-holidays-have-been-published/?lang=en" },
  { university: "Freie Universitat Berlin", city: "Berlin", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-13",
    breaks: [b("Christmas break", "2026-12-21", "2027-01-02", "christmas")],
    sourceUrl: "https://www.fu-berlin.de/studium/beratung/kalender/2026wise/index.html" },
  { university: "Freie Universitat Berlin", city: "Berlin", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-17", breaks: [],
    sourceUrl: "https://www.fu-berlin.de/studium/beratung/kalender/2027sose/index.html" },
  { university: "LMU Munich", city: "Munich", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-05",
    breaks: [b("Christmas break", "2026-12-24", "2027-01-06", "christmas")],
    sourceUrl: "https://www.lmu.de/de/workspace-fuer-studierende/1x1-des-studiums/vorlesungszeiten/" },
  { university: "LMU Munich", city: "Munich", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-16", breaks: [],
    sourceUrl: "https://www.lmu.de/de/workspace-fuer-studierende/1x1-des-studiums/vorlesungszeiten/" },
  { university: "Universidade Nova de Lisboa", city: "Lisbon", country: "Portugal", term: "fall",
    start: "2026-09-14", end: "2026-12-18",
    breaks: [b("Christmas break", "2026-12-19", "2027-01-03", "christmas")],
    sourceUrl: "https://www.fcsh.unl.pt/en/calendarios/academic-year-2026-27/" },
  { university: "Universidade Nova de Lisboa", city: "Lisbon", country: "Portugal", term: "spring",
    start: "2027-02-22", end: "2027-05-28",
    breaks: [
      b("Carnival break", "2027-02-08", "2027-02-09", "carnival"),
      b("Easter break", "2027-03-22", "2027-03-29", "easter"),
    ],
    sourceUrl: "https://www.fcsh.unl.pt/en/calendarios/academic-year-2026-27/" },

  // --- Netherlands, Belgium, Sweden, Denmark, Greece ---
  { university: "University of Amsterdam", city: "Amsterdam", country: "Netherlands", term: "fall",
    start: "2026-08-31", end: "2027-01-29",
    breaks: [b("Winter break", "2026-12-19", "2027-01-03", "winter")],
    sourceUrl: "https://student.uva.nl/en/academic-calendar/2026-2027" },
  { university: "University of Amsterdam", city: "Amsterdam", country: "Netherlands", term: "spring",
    start: "2027-02-01", end: "2027-06-25",
    breaks: [
      b("Easter break", "2027-03-28", "2027-03-29", "easter"),
      b("May holidays", "2027-05-03", "2027-05-07", "may"),
    ],
    sourceUrl: "https://student.uva.nl/en/academic-calendar/2026-2027" },
  { university: "KU Leuven", city: "Leuven", country: "Belgium", term: "fall",
    start: "2026-09-21", end: "2027-01-30",
    breaks: [b("Christmas break", "2026-12-19", "2027-01-03", "christmas")],
    sourceUrl: "https://www.kuleuven.be/english/about-kuleuven/calendars/2026-2027/ku-leuven-leuven" },
  { university: "KU Leuven", city: "Leuven", country: "Belgium", term: "spring",
    start: "2027-02-08", end: "2027-06-26",
    breaks: [b("Easter break", "2027-03-27", "2027-04-11", "easter")],
    sourceUrl: "https://www.kuleuven.be/english/about-kuleuven/calendars/2026-2027/ku-leuven-leuven" },
  { university: "Stockholm University", city: "Stockholm", country: "Sweden", term: "fall",
    start: "2026-08-31", end: "2027-01-17", breaks: [],
    sourceUrl: "https://www.su.se/english/education/student-support/term-dates" },
  { university: "Stockholm University", city: "Stockholm", country: "Sweden", term: "spring",
    start: "2027-01-18", end: "2027-06-06", breaks: [],
    sourceUrl: "https://www.su.se/english/education/student-support/term-dates" },
  { university: "Lund University", city: "Lund", country: "Sweden", term: "fall",
    start: "2026-08-31", end: "2027-01-17",
    breaks: [b("Christmas break", "2026-12-21", "2027-01-05", "christmas")],
    sourceUrl: "https://www.student.lth.se/english/my-studies/academic-calendar/" },
  { university: "Lund University", city: "Lund", country: "Sweden", term: "spring",
    start: "2027-01-18", end: "2027-06-06", breaks: [],
    sourceUrl: "https://www.student.lth.se/english/my-studies/academic-calendar/" },
  { university: "Copenhagen Business School", city: "Copenhagen", country: "Denmark", term: "fall",
    start: "2026-09-01", end: "2027-01-31", breaks: [],
    sourceUrl: "https://www.cbs.dk/en/study-programmes/bachelor-programmes/study-start" },
  { university: "Copenhagen Business School", city: "Copenhagen", country: "Denmark", term: "spring",
    start: "2027-02-01", end: "2027-06-30", breaks: [],
    sourceUrl: "https://www.cbs.dk/en/study-programmes/bachelor-programmes/study-start" },
  { university: "Deree - The American College of Greece", city: "Athens", country: "Greece", term: "fall",
    start: "2026-09-10", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.acg.edu/wp-content/uploads/2026/04/UG_Calendar_2026_27_v3.pdf" },

  // --- University of Illinois Urbana-Champaign's real European exchange
  // partners (batch 1 of that effort), sourced from UIUC's own official
  // program database (app.studyabroad.illinois.edu, Region = Europe) --
  // NOT a curated "top universities" list, the actual real list UIUC
  // students can pick from. Flag worth knowing: this database does NOT
  // include Anglo-American University, Prague, anywhere -- searched
  // explicitly for "AAU"/"Anglo-American"/"Prague" and found only CEA CAPA
  // (a provider, already in programCalendars.ts) and one faculty-led short
  // course. AAU Prague appears to be a non-UIUC-affiliated enrollment path,
  // not a campus exchange -- a real, separate fact from anything about the
  // app's own baked-in dates.
  //
  // Flags worth a second look:
  // - EPFL Spring 2027 not included -- EPFL's own calendar page only
  //   publishes Spring 2025-26 (current) and Fall 2026-27; Spring 2027
  //   genuinely isn't published yet.
  // - Humboldt-Universitat zu Berlin not included at all -- every page/PDF
  //   on hu-berlin.de returned a bot-protection challenge page rather than
  //   content, and no citable mirror was found either. Worth a retry.
  // - University of Manchester's dates come from an official but
  //   explicitly provisional planning document (its own disclaimer:
  //   "prepared to assist in timetable planning only... based on our best
  //   understanding of term dates") -- very likely accurate, not a final
  //   locked calendar.
  // - VU Amsterdam's dates came from VU's own official 2026-27 exchange
  //   factsheet, but the reachable copy was hosted on a partner
  //   university's site (Universitas Gadjah Mada's international office)
  //   rather than fetched directly from vu.nl (whose own PDFs didn't
  //   render as text) -- content itself carries VU letterhead/contacts.
  { university: "ETH Zurich", city: "Zurich", country: "Switzerland", term: "fall",
    start: "2026-09-14", end: "2026-12-18",
    breaks: [b("Christmas Break", "2026-12-24", "2027-01-03", "christmas")],
    sourceUrl: "https://mtec.ethz.ch/news/academic-calendar.html" },
  { university: "ETH Zurich", city: "Zurich", country: "Switzerland", term: "spring",
    start: "2027-02-22", end: "2027-06-04",
    breaks: [b("Easter Break", "2027-03-26", "2027-04-04", "easter")],
    sourceUrl: "https://mtec.ethz.ch/news/academic-calendar.html" },
  { university: "EPFL", city: "Lausanne", country: "Switzerland", term: "fall",
    start: "2026-09-07", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.epfl.ch/education/studies/en/rules-and-procedures/academic-calendar/" },
  { university: "TU Delft", city: "Delft", country: "Netherlands", term: "fall",
    start: "2026-09-07", end: "2027-01-29",
    breaks: [b("Christmas Holidays", "2026-12-21", "2027-01-03", "christmas")],
    sourceUrl: "https://www.tudelft.nl/en/student/my-study-me/education/academic-calendar" },
  { university: "TU Delft", city: "Delft", country: "Netherlands", term: "spring",
    start: "2027-02-01", end: "2027-06-25",
    breaks: [b("Spring Break", "2027-02-01", "2027-02-07", "spring")],
    sourceUrl: "https://www.tudelft.nl/en/student/my-study-me/education/academic-calendar" },
  { university: "VU Amsterdam", city: "Amsterdam", country: "Netherlands", term: "fall",
    start: "2026-08-31", end: "2027-01-29", breaks: [],
    sourceUrl: "https://vu.nl/en/education/more-about/academic-calendar" },
  { university: "VU Amsterdam", city: "Amsterdam", country: "Netherlands", term: "spring",
    start: "2027-02-01", end: "2027-06-25", breaks: [],
    sourceUrl: "https://vu.nl/en/education/more-about/academic-calendar" },
  { university: "Heidelberg University", city: "Heidelberg", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-06",
    breaks: [b("Christmas/New Year Break", "2026-12-21", "2027-01-06", "christmas")],
    sourceUrl: "https://www.uni-heidelberg.de/en/study/management-of-studies/key-dates-deadlines/further-semester-dates" },
  { university: "Heidelberg University", city: "Heidelberg", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-24", breaks: [],
    sourceUrl: "https://www.uni-heidelberg.de/en/study/management-of-studies/key-dates-deadlines/further-semester-dates" },
  { university: "University of Bristol", city: "Bristol", country: "England", term: "fall",
    start: "2026-09-21", end: "2026-12-18",
    breaks: [b("Winter Break", "2026-12-21", "2027-01-08", "winter")],
    sourceUrl: "https://www.bristol.ac.uk/university/dates/" },
  { university: "University of Bristol", city: "Bristol", country: "England", term: "spring",
    start: "2027-01-18", end: "2027-05-21",
    breaks: [b("Spring Vacation", "2027-03-22", "2027-04-09", "spring")],
    sourceUrl: "https://www.bristol.ac.uk/university/dates/" },
  { university: "University of Manchester", city: "Manchester", country: "England", term: "fall",
    start: "2026-09-21", end: "2027-01-31",
    breaks: [b("Christmas Vacation", "2026-12-21", "2027-01-10", "christmas")],
    sourceUrl: "https://documents.manchester.ac.uk/DocuInfo.aspx?DocID=78064" },
  { university: "University of Manchester", city: "Manchester", country: "England", term: "spring",
    start: "2027-02-01", end: "2027-06-13",
    breaks: [b("Easter Vacation", "2027-03-22", "2027-04-11", "easter")],
    sourceUrl: "https://documents.manchester.ac.uk/DocuInfo.aspx?DocID=78064" },

  // UIUC exchange partners, batch 2. 5 of 8 requested universities sourced.
  // Flags worth a second look:
  // - WHU Otto Beisheim School of Management NOT attempted at all --
  //   whu.edu's robots.txt explicitly disallows ClaudeBot while
  //   whitelisting Googlebot/Bingbot, so this was treated as a policy
  //   boundary to respect, not a technical failure to route around.
  // - University of Bologna NOT included -- its academic calendars are
  //   decentralized per-school/per-degree with no single working central
  //   page found after checking the sitemap, international-mobility nav,
  //   and internal search.
  // - Tilburg University NOT included -- the live site 403s (Cloudflare
  //   bot challenge) on every page. A real official PDF was found via the
  //   Wayback Machine, but its own 2026-27 section is explicitly labeled
  //   "DRAFT: THE START OF ACADEMIC YEAR 2026-2027 IS STILL IN DRAFT" with
  //   only a preliminary start window and no end date or spring dates --
  //   genuinely not ready to record, not a fetch failure.
  // - TUM/TU Darmstadt/Bern: each publishes both a broader administrative
  //   "semester" and a narrower actual-teaching "lecture period" inside
  //   it -- the lecture period is what's recorded below (what actually
  //   matters for when an exchange student is in class), not the wider
  //   window that mostly pads exam/break time on both ends.
  // - TUM/KTH/Karolinska show breaks: [] because their own pages say so
  //   explicitly (Karolinska: "no official holidays such as Christmas or
  //   Easter"; KTH: continuous study/exam periods, no gap) -- not a
  //   search gap.
  { university: "Technical University of Munich (TUM)", city: "Munich", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-05", breaks: [],
    sourceUrl: "https://www.tum.de/en/studies/application/application-info-portal/dates-periods-and-deadlines/" },
  { university: "Technical University of Munich (TUM)", city: "Munich", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-16", breaks: [],
    sourceUrl: "https://www.tum.de/en/studies/application/application-info-portal/dates-periods-and-deadlines/" },
  { university: "TU Darmstadt", city: "Darmstadt", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-12",
    breaks: [b("Christmas Break (Weihnachtspause)", "2026-12-21", "2027-01-08", "christmas")],
    sourceUrl: "https://www.tu-darmstadt.de/studieren/studierende_tu/semestermine/index.de.jsp" },
  { university: "TU Darmstadt", city: "Darmstadt", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-16", breaks: [],
    sourceUrl: "https://www.tu-darmstadt.de/studieren/studierende_tu/semestermine/index.de.jsp" },
  { university: "KTH Royal Institute of Technology", city: "Stockholm", country: "Sweden", term: "fall",
    start: "2026-08-24", end: "2027-01-11", breaks: [],
    sourceUrl: "https://www.kth.se/en/student/studier/schema/lasarsindelning-1.912374" },
  { university: "KTH Royal Institute of Technology", city: "Stockholm", country: "Sweden", term: "spring",
    start: "2027-01-12", end: "2027-05-31", breaks: [],
    sourceUrl: "https://www.kth.se/en/student/studier/schema/lasarsindelning-1.912374" },
  { university: "Karolinska Institute", city: "Stockholm", country: "Sweden", term: "fall",
    start: "2026-08-31", end: "2027-01-17", breaks: [],
    sourceUrl: "https://education.ki.se/student-at-ki/academic-calendar" },
  { university: "Karolinska Institute", city: "Stockholm", country: "Sweden", term: "spring",
    start: "2027-01-18", end: "2027-06-06", breaks: [],
    sourceUrl: "https://education.ki.se/student-at-ki/academic-calendar" },
  { university: "University of Bern", city: "Bern", country: "Switzerland", term: "fall",
    start: "2026-09-14", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.unibe.ch/studies/dates/semesterdates/index_eng.html" },
  { university: "University of Bern", city: "Bern", country: "Switzerland", term: "spring",
    start: "2027-02-22", end: "2027-06-04",
    breaks: [b("Spring vacation", "2027-03-26", "2027-04-04", "spring")],
    sourceUrl: "https://www.unibe.ch/studies/dates/semesterdates/index_eng.html" },

  // UIUC exchange partners, batch 3. 5 of 8 requested universities sourced.
  // Flags worth a second look:
  // - EBS Universitat (Wiesbaden) NOT included -- no academic-calendar
  //   page found anywhere on ebs.edu after checking the sitemap, student
  //   services, and orientation pages; may be behind a student-only
  //   portal or simply not published on a dedicated page.
  // - University of Bergen NOT included -- its official page only
  //   describes a generic recurring pattern ("autumn starts week 32...")
  //   without confirming it's specifically the 2026/27 dates rather than
  //   a template description. Not reported rather than treated as exact.
  // - Universidade Catolica Portuguesa (Lisbon) NOT included as a
  //   fall/spring entry -- its real, dated academic-calendar PDF exists
  //   (year starts Sept 1 2026, ends July 31 2027, with dated Christmas
  //   and Easter closures) but the document itself isn't organized into a
  //   fall/spring split, so guessing where one ends and the other begins
  //   was avoided rather than invented.
  // - UC3M/UPV Valencia: "end" is each term's own exam-period end (both
  //   universities' own documents frame it this way -- "fin de semestre"
  //   = when all evaluation acts must be finished), not last day of
  //   classes -- this is why Fall's end date lands in late January, after
  //   Christmas break. A real structural feature of the Spanish academic
  //   calendar, not an error.
  // - BI Norwegian's Christmas-break end date (Jan 4) is an inference from
  //   the source's own vaguer "23 December to early January" phrasing, not
  //   a date literally printed on the page.
  { university: "Friedrich-Schiller-Universitat Jena", city: "Jena", country: "Germany", term: "fall",
    start: "2026-10-19", end: "2027-02-12",
    breaks: [b("Christmas/New Year break", "2026-12-21", "2027-01-01", "christmas")],
    sourceUrl: "https://www.uni-jena.de/unijenamedia/38740/zuletzt-vom-senat-zur-kenntnis-genommener-terminplan.pdf" },
  { university: "Friedrich-Schiller-Universitat Jena", city: "Jena", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-16",
    breaks: [b("Schillertag (Dies Academicus)", "2027-06-25", "2027-06-25", "special")],
    sourceUrl: "https://www.uni-jena.de/unijenamedia/38740/zuletzt-vom-senat-zur-kenntnis-genommener-terminplan.pdf" },
  { university: "University of Potsdam", city: "Potsdam", country: "Germany", term: "fall",
    start: "2026-10-12", end: "2027-02-05",
    breaks: [b("Christmas Break", "2026-12-21", "2027-01-01", "christmas")],
    sourceUrl: "https://www.uni-potsdam.de/en/studium/dates-and-deadlines/important-dates-and-deadlines-during-your-studies" },
  { university: "University of Potsdam", city: "Potsdam", country: "Germany", term: "spring",
    start: "2027-04-12", end: "2027-07-23", breaks: [],
    sourceUrl: "https://www.uni-potsdam.de/en/studium/dates-and-deadlines/important-dates-and-deadlines-during-your-studies" },
  { university: "BI Norwegian Business School", city: "Oslo", country: "Norway", term: "fall",
    start: "2026-08-17", end: "2026-12-21",
    breaks: [b("Christmas closure", "2026-12-23", "2027-01-04", "christmas")],
    sourceUrl: "https://www.bi.no/en/study-at-bi/international-students/practical-info/academic-calendar/" },
  { university: "BI Norwegian Business School", city: "Oslo", country: "Norway", term: "spring",
    start: "2027-01-11", end: "2027-06-18", breaks: [],
    sourceUrl: "https://www.bi.no/en/study-at-bi/international-students/practical-info/academic-calendar/" },
  { university: "Universidad Carlos III de Madrid", city: "Madrid", country: "Spain", term: "fall",
    start: "2026-09-07", end: "2027-01-25",
    breaks: [b("Navidad (Christmas)", "2026-12-23", "2027-01-08", "christmas")],
    sourceUrl: "https://www.uc3m.es/grado/media/grado/doc/archivo/doc_calendario_2627/calendario_grado_2026_2027_v9.pdf" },
  { university: "Universidad Carlos III de Madrid", city: "Madrid", country: "Spain", term: "spring",
    start: "2027-01-26", end: "2027-05-28",
    breaks: [b("Semana Santa (Easter)", "2027-03-22", "2027-03-29", "easter")],
    sourceUrl: "https://www.uc3m.es/grado/media/grado/doc/archivo/doc_calendario_2627/calendario_grado_2026_2027_v9.pdf" },
  { university: "Universitat Politecnica de Valencia", city: "Valencia", country: "Spain", term: "fall",
    start: "2026-09-07", end: "2027-01-29",
    breaks: [b("Navidad (Christmas)", "2026-12-23", "2027-01-06", "christmas")],
    sourceUrl: "https://www.upv.es/entidades/SG/infoweb/sg/info/U0985732.pdf" },
  { university: "Universitat Politecnica de Valencia", city: "Valencia", country: "Spain", term: "spring",
    start: "2027-02-01", end: "2027-06-25",
    breaks: [
      b("Fallas (Valencia/Gandia campus)", "2027-03-17", "2027-03-19", "special"),
      b("Semana Santa (Easter, Valencia/Gandia campus)", "2027-03-25", "2027-04-05", "easter"),
    ],
    sourceUrl: "https://www.upv.es/entidades/SG/infoweb/sg/info/U0985732.pdf" },

  // UIUC exchange partners, batch 4. All 8 requested universities sourced
  // -- the first batch in this series with zero gaps.
  // Flags worth a second look:
  // - Term start = first day of TEACHING, not orientation/welcome week, so
  //   several starts are later than a "welcome week" date you might see
  //   elsewhere (Cardiff, Birmingham, Galway, QMUL all start teaching
  //   roughly a week after their welcome/enrolment week).
  // - Jagiellonian's own "summer semester" officially runs Feb 25-Sep 30,
  //   2027 -- unusually long because Jagiellonian's own definition
  //   includes the full retake-exam window (through mid-September) and an
  //   administrative close-out, not just teaching+first exams. Used
  //   exactly as published rather than guessing a shorter "real" end.
  // - SLU has no single home city (multi-campus: Uppsala, Alnarp, Umea) --
  //   Uppsala (the largest/HQ campus) was chosen as a judgment call, not
  //   a sourced fact.
  // - University of Birmingham's accessible page didn't publish a named
  //   reading-week/break, so breaks: [] reflects that rather than a
  //   guessed gap.
  // - "University of Galway" is the current name (formerly NUI Galway) --
  //   used as researched.
  { university: "Swedish University of Agricultural Sciences (SLU)", city: "Uppsala", country: "Sweden", term: "fall",
    start: "2026-08-31", end: "2027-01-17",
    breaks: [b("Winter break (no classes)", "2026-12-23", "2026-12-31", "winter")],
    sourceUrl: "https://www.slu.se/en/study/application-and-admission/academi-calendar/" },
  { university: "Swedish University of Agricultural Sciences (SLU)", city: "Uppsala", country: "Sweden", term: "spring",
    start: "2027-01-18", end: "2027-06-06", breaks: [],
    sourceUrl: "https://www.slu.se/en/study/application-and-admission/academi-calendar/" },
  { university: "Bogazici University", city: "Istanbul", country: "Turkey", term: "fall",
    start: "2026-09-21", end: "2026-12-18",
    breaks: [b("Republic Day", "2026-10-28", "2026-10-29", "special")],
    sourceUrl: "https://intl.bogazici.edu.tr/sites/intl.bogazici.edu.tr/files/academic_calendar_2026-2027.pdf" },
  { university: "Bogazici University", city: "Istanbul", country: "Turkey", term: "spring",
    start: "2027-02-08", end: "2027-05-28",
    breaks: [
      b("Ramadan Holiday", "2027-03-08", "2027-03-11", "special"),
      b("Spring Break", "2027-04-19", "2027-04-23", "break"),
      b("Eid al-Adha Holiday", "2027-05-15", "2027-05-19", "special"),
    ],
    sourceUrl: "https://intl.bogazici.edu.tr/sites/intl.bogazici.edu.tr/files/academic_calendar_2026-2027.pdf" },
  { university: "Cardiff University", city: "Cardiff", country: "Wales", term: "fall",
    start: "2026-10-05", end: "2027-01-31",
    breaks: [b("Christmas Break", "2026-12-19", "2027-01-10", "christmas")],
    sourceUrl: "https://www.cardiff.ac.uk/public-information/corporate-information/semester-dates" },
  { university: "Cardiff University", city: "Cardiff", country: "Wales", term: "spring",
    start: "2027-02-01", end: "2027-06-18",
    breaks: [b("Easter Break", "2027-03-20", "2027-04-11", "easter")],
    sourceUrl: "https://www.cardiff.ac.uk/public-information/corporate-information/semester-dates" },
  { university: "University of Birmingham", city: "Birmingham", country: "England", term: "fall",
    start: "2026-09-28", end: "2026-12-11", breaks: [],
    sourceUrl: "https://www.birmingham.ac.uk/undergraduate/courses/academicyear" },
  { university: "University of Birmingham", city: "Birmingham", country: "England", term: "spring",
    start: "2027-01-11", end: "2027-03-26", breaks: [],
    sourceUrl: "https://www.birmingham.ac.uk/undergraduate/courses/academicyear" },
  { university: "University of Galway", city: "Galway", country: "Ireland", term: "fall",
    start: "2026-09-07", end: "2026-12-18",
    breaks: [b("Christmas Break", "2026-12-19", "2027-01-10", "christmas")],
    sourceUrl: "https://www.universityofgalway.ie/media/registrationoffice/files/26-27-All-Students-Final.pdf" },
  { university: "University of Galway", city: "Galway", country: "Ireland", term: "spring",
    start: "2027-01-11", end: "2027-05-06",
    breaks: [b("Easter Break", "2027-03-26", "2027-03-29", "easter")],
    sourceUrl: "https://www.universityofgalway.ie/media/registrationoffice/files/26-27-All-Students-Final.pdf" },
  { university: "Jagiellonian University", city: "Krakow", country: "Poland", term: "fall",
    start: "2026-10-01", end: "2027-02-24",
    breaks: [
      b("Christmas Break", "2026-12-23", "2027-01-06", "christmas"),
      b("Inter-semester Break", "2027-02-11", "2027-02-17", "break"),
    ],
    sourceUrl: "https://internationalstudents.uj.edu.pl/en_GB/studenci/kalendarz-akademicki" },
  { university: "Jagiellonian University", city: "Krakow", country: "Poland", term: "spring",
    start: "2027-02-25", end: "2027-09-30",
    breaks: [b("Easter Break", "2027-03-25", "2027-03-30", "easter")],
    sourceUrl: "https://internationalstudents.uj.edu.pl/en_GB/studenci/kalendarz-akademicki" },
  { university: "University of Southampton", city: "Southampton", country: "England", term: "fall",
    start: "2026-09-14", end: "2027-01-23",
    breaks: [b("Christmas Break", "2026-12-13", "2027-01-03", "christmas")],
    sourceUrl: "https://www.southampton.ac.uk/about/term-dates" },
  { university: "University of Southampton", city: "Southampton", country: "England", term: "spring",
    start: "2027-01-25", end: "2027-05-29",
    breaks: [b("Easter Break", "2027-03-21", "2027-04-11", "easter")],
    sourceUrl: "https://www.southampton.ac.uk/about/term-dates" },
  { university: "Queen Mary University of London", city: "London", country: "England", term: "fall",
    start: "2026-09-21", end: "2027-01-22",
    breaks: [b("Christmas/New Year Vacation", "2026-12-24", "2027-01-03", "christmas")],
    sourceUrl: "https://www.qmul.ac.uk/about/calendar/" },
  { university: "Queen Mary University of London", city: "London", country: "England", term: "spring",
    start: "2027-01-25", end: "2027-06-04",
    breaks: [b("Easter Vacation", "2027-04-17", "2027-05-03", "easter")],
    sourceUrl: "https://www.qmul.ac.uk/about/calendar/" },

  // UIUC exchange partners, batch 5 (direct-enroll universities). This
  // closes out UIUC's remaining direct-enroll list, minus the "Illinois
  // program center" entries with no clear single host institution -- see
  // CLAUDE.md for what was found/not found there.
  // - Newcastle's own page presents two incompatible date structures
  //   ("term dates" vs. "semester dates"); "term dates" was used since the
  //   source explicitly labels those as applying to undergraduate taught
  //   students. No break dates were published on this page at all.
  // - Stirling has separate UG/PGT calendars -- undergraduate dates used
  //   as more relevant to a direct-enroll exchange student.
  // - Lucerne (HSLU) is a federation of ~6 schools each with its own dates
  //   page -- sourced from the Lucerne School of Information Technology
  //   (the one with a clean English page); other HSLU schools may run a
  //   few days off from this.
  { university: "Newcastle University", city: "Newcastle", country: "England", term: "fall",
    start: "2026-09-21", end: "2026-12-11", breaks: [],
    sourceUrl: "https://www.ncl.ac.uk/regulations/term-dates/" },
  { university: "Newcastle University", city: "Newcastle", country: "England", term: "spring",
    start: "2027-01-04", end: "2027-03-25", breaks: [],
    sourceUrl: "https://www.ncl.ac.uk/regulations/term-dates/" },
  { university: "University of Stirling", city: "Stirling", country: "Scotland", term: "fall",
    start: "2026-09-14", end: "2026-12-18",
    breaks: [b("Mid-semester Break", "2026-10-26", "2026-10-30", "break")],
    sourceUrl: "https://www.stir.ac.uk/study/semester-dates/" },
  { university: "University of Stirling", city: "Stirling", country: "Scotland", term: "spring",
    start: "2027-01-18", end: "2027-05-07",
    breaks: [b("Mid-semester Break", "2027-03-01", "2027-03-05", "break")],
    sourceUrl: "https://www.stir.ac.uk/study/semester-dates/" },
  { university: "Lucerne University of Applied Sciences and Arts", city: "Lucerne", country: "Switzerland", term: "fall",
    start: "2026-09-14", end: "2026-12-19", breaks: [],
    sourceUrl: "https://www.hslu.ch/en/lucerne-school-of-information-technology/degree-programs/academic-calendar/" },
  { university: "Lucerne University of Applied Sciences and Arts", city: "Lucerne", country: "Switzerland", term: "spring",
    start: "2027-02-22", end: "2027-05-05",
    breaks: [b("Easter Break", "2027-03-26", "2027-03-30", "easter")],
    sourceUrl: "https://www.hslu.ch/en/lucerne-school-of-information-technology/degree-programs/academic-calendar/" },
];

export function universityNames(): string[] {
  return Array.from(new Set(UNIVERSITY_SEMESTERS.map((e) => e.university))).sort();
}

export function findUniversitySemester(
  university: string,
  term: "fall" | "spring" | "winter"
): UniversitySemesterEntry | undefined {
  if (term === "winter") return undefined;
  const needle = university.trim().toLowerCase();
  if (!needle) return undefined;
  return UNIVERSITY_SEMESTERS.find(
    (e) => e.university.toLowerCase() === needle && e.term === term
  );
}
