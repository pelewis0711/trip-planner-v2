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
  { university: "University of Glasgow", city: "Glasgow", country: "United Kingdom", term: "fall",
    start: "2026-09-21", end: "2026-12-18", breaks: [],
    sourceUrl: "https://www.gla.ac.uk/myglasgow/apg/sessiondates/session2026-27/" },
  { university: "University of Glasgow", city: "Glasgow", country: "United Kingdom", term: "spring",
    start: "2027-01-11", end: "2027-05-28",
    breaks: [b("Spring Vacation", "2027-03-29", "2027-04-16", "spring")],
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
