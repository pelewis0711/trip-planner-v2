// Direct port of v1's Excel export (reference-v1-app.html:1787-1960), using the
// `xlsx` package (installed from SheetJS's own CDN — the npm-registry release is
// frozen on an old, unpatched build) instead of a CDN <script> loaded at runtime.
import type { CellObject } from "xlsx";
import type { Plan } from "@/lib/store/plan";
import type { Slot } from "@/data/slots";
import { getSlotsForPlan } from "@/lib/calc/semester";
import { makeCtx } from "@/lib/calc/context";
import {
  actualEntered,
  blendedSlot,
  blendedTotals,
  grandTotals,
  slotCosts,
  type SlotCosts,
} from "@/lib/calc/costs";
import { liveSlotCosts, liveAdjustedGrandTotals } from "@/lib/calc/livePricing";
import type { LivePrice } from "@/lib/store/livePrices";
import { daysOf, foodTiers, lodgingTiers } from "@/lib/calc/cost";
import { HOME_COUNTRY, SCHENGEN, schengenDays } from "@/lib/calc/schengen";
import { slotWarnings } from "@/lib/calc/warnings";
import { iso, nice, stopDates, legDateFor } from "@/lib/calc/dates";
import { BAGS } from "@/lib/calc/pricing";
import {
  airbnbUrl,
  bookingComUrl,
  getYourGuideUrl,
  googleFlightsUrl,
  hostelworldUrl,
  mapsBestDishUrl,
  STATIC_LINKS,
} from "@/lib/calc/booking";

type Row = (string | number | CellObject)[];

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const XL = (label: string, url: string): CellObject => ({
  v: label,
  t: "s",
  l: { Target: url, Tooltip: url },
});
const XM = (n: number): CellObject => ({
  v: Math.round(n),
  t: "n",
  z: '"$"#,##0',
});

export function buildXlsxSheets(plan: Plan, livePrices: Record<string, LivePrice> = {}) {
  const ctx = makeCtx(plan.home, plan.bag);
  const slots = getSlotsForPlan(plan);
  const ordered = slots.filter((s) => plan.placements[s.id]?.stops.length);

  // Slot.s/.e are [month, day] with no year, so a custom semester's year
  // and month range are pulled from its ISO start/end (assumed to fall
  // within a single calendar year — true for any one study-abroad term).
  const semYear = plan.semester ? Number(plan.semester.start.slice(0, 4)) : 2027;
  const semStartMonth = plan.semester ? Number(plan.semester.start.slice(5, 7)) : 1;
  const semEndMonth = plan.semester ? Number(plan.semester.end.slice(5, 7)) : 5;

  const useLive = !!plan.useLivePrices;
  const costsFor = (s: Slot): SlotCosts & { liveLegIndexes: Set<number> } =>
    useLive
      ? liveSlotCosts(s.id, s, plan.placements[s.id].stops, ctx, semYear, livePrices)
      : { ...slotCosts(s.id, plan.placements[s.id].stops, ctx), liveLegIndexes: new Set<number>() };

  const routeOf = (s: Slot) =>
    plan.placements[s.id].stops.map((st) => ctx.tripOf(st.tripId)?.n ?? "?").join(" → ");
  const nightsOf = (s: Slot) =>
    plan.placements[s.id].stops.reduce((n, st) => n + (st.nights || 0), 0);
  const flagsOf = (s: Slot) => {
    const stops = plan.placements[s.id]?.stops ?? [];
    const legs = slotCosts(s.id, stops, ctx).legs;
    return slotWarnings(s, stops, legs, ctx.tripOf)
      .map((w) => (w.lv === "red" ? "⚠ " : "◔ ") + w.msg)
      .join("  |  ");
  };
  const g = useLive ? liveAdjustedGrandTotals(plan.placements, ctx, slots, semYear, livePrices) : grandTotals(plan.placements, ctx);
  const nightsAll = ordered.reduce((n, s) => n + nightsOf(s), 0);
  const today = new Date().toLocaleDateString();

  /* ---- Sheet 1: Budget ---- */
  const bt = blendedTotals(plan.placements, ctx);
  const homeC = HOME_COUNTRY[plan.home] || plan.home;
  const schD = schengenDays(plan.placements, plan.home, ctx.tripOf);

  const bud: Row[] = [
    [`STUDY ABROAD BUDGET — ${plan.name || "Plan"}`],
    ["Home base", plan.home],
    ["Semester", plan.semester ? `Custom (${plan.semester.start} to ${plan.semester.end})` : "Spring 2027 (AAU Prague calendar)"],
    ["Currency", "USD, per person"],
    ["Exported", today],
    [
      "Flight pricing includes",
      `${BAGS[plan.bag][0]}, seasonal peak multipliers, and secondary-airport transfers where relevant`,
    ],
    [
      "Live prices",
      useLive
        ? "ON — Travel/Slot total columns use a live fare where one was found (see Live? column); estimate otherwise"
        : "OFF — all numbers below are algorithmic estimates, no live fares",
    ],
    [],
    ["Slot", "Dates", "Route", "Nights", "Travel", "Lodging", "Food", "Activities", "Slot total", "Actual (booked)", "Variance", "Live?", "Flags"],
  ];
  ordered.forEach((s) => {
    const c = costsFor(s);
    const booked = actualEntered(plan.placements[s.id]);
    const bl = blendedSlot(s.id, plan.placements[s.id], ctx);
    const liveNote = c.liveLegIndexes.size
      ? `live (${c.liveLegIndexes.size}/${c.legs.filter((l) => l.mode === "flight").length} flight legs)`
      : "";
    bud.push([
      s.label, s.date, routeOf(s), nightsOf(s),
      XM(c.travel), XM(c.lodg), XM(c.food), XM(c.act), XM(c.total),
      booked ? XM(bl) : "", booked ? XM(bl - c.total) : "", liveNote, flagsOf(s),
    ]);
  });
  const buf = g.total * 0.12;
  bud.push(
    [],
    ["TOTALS", "", "", nightsAll, XM(g.travel), XM(g.lodg), XM(g.food), XM(g.act), XM(g.total), bt.booked ? XM(bt.blend) : "", bt.booked ? XM(bt.blend - bt.est) : ""],
    [],
    ["Trips subtotal (estimates)", "", "", "", "", "", "", "", XM(g.total)],
    ["Projected spend (booked actuals where entered)", "", "", "", "", "", "", "", XM(bt.blend)],
    ["+12% contingency buffer", "", "", "", "", "", "", "", XM(buf)],
    ["Optional: Eurail Global Pass (Youth, 10d/2mo)", "", "", "", "", "", "", "", XM(296)],
    ["ESTIMATED GRAND TOTAL (projection + buffer + Eurail)", "", "", "", "", "", "", "", XM(bt.blend + buf + 296)],
    []
  );
  if (plan.budget) {
    bud.push(
      ["Travel budget cap", "", "", "", "", "", "", "", XM(plan.budget)],
      ["Remaining vs budget (projection)", "", "", "", "", "", "", "", XM(plan.budget - bt.blend)]
    );
  }
  bud.push(
    ["Cost per night away", "", "", "", "", "", "", "", nightsAll ? XM(g.total / nightsAll) : "—"],
    [
      `🛂 Schengen days used (${SCHENGEN.has(homeC) ? `outside ${homeC}` : "in the Schengen area"})`,
      "", "", "", "", "", "", "",
      `${schD} of 90 per 180${schD > 90 ? " — OVER THE LEGAL LIMIT" : schD > 80 ? " — cutting it close" : ""}`,
    ],
    [`Note: excludes normal weekday living costs in ${plan.home}.`]
  );
  if (!ordered.length) bud.push([], ["(No trips scheduled in this plan yet — fill the calendar and re-export.)"]);

  /* ---- Sheet 2: Travel Plan (detailed) ---- */
  const tp: Row[] = [
    [`DETAILED TRAVEL PLAN — ${plan.name || "Plan"}`],
    [
      useLive
        ? `Costs use live fares where found (marked LIVE below), estimated otherwise. USD per person. Routes auto-computed ${plan.home} → stops → ${plan.home}.`
        : `All costs estimated, USD per person. Routes auto-computed ${plan.home} → stops → ${plan.home}.`,
    ],
    [],
  ];
  ordered.forEach((s) => {
    const stops = plan.placements[s.id].stops;
    const c = costsFor(s);
    const multi = stops.length > 1;
    tp.push([`■ ${s.label} — ${s.date}${s.note ? `  (${s.note})` : ""}`]);
    tp.push(["Route", [plan.home, ...stops.map((st) => ctx.tripOf(st.tripId)?.n ?? "?"), plan.home].join(" → ")]);
    const fl = flagsOf(s);
    if (fl) tp.push(["⚠ Check", fl]);
    tp.push(["Booking tip", timingTipFor(s)]);
    tp.push(["", "Travel legs:", "From", "To", "Mode", "~km", "Est. cost", "Pricing notes"]);
    c.legs.forEach((l, i) =>
      tp.push([
        "", "", l.from, l.to, l.mode, l.km || "", XM(l.cost),
        c.liveLegIndexes.has(i) ? `LIVE${l.note ? " · " + l.note : ""}` : l.note || "",
      ])
    );
    stops.forEach((st, si) => {
      const t = ctx.tripOf(st.tripId);
      if (!t) return;
      tp.push(["", `${multi ? `Stop ${si + 1}: ` : ""}${t.n}, ${t.c} — ${st.nights === 0 ? "day trip" : `${st.nights} night${st.nights > 1 ? "s" : ""}`}`]);
      if (st.nights > 0) {
        const lt = lodgingTiers(t.ci)[st.l];
        tp.push(["", "", "Lodging", `${lt[0]} × ${st.nights}n`, XM(lt[1] * st.nights)]);
      }
      const ft = foodTiers(t.ci)[st.fd];
      const dys = daysOf(st.nights);
      tp.push(["", "", "Food", `${ft[0]} × ${dys}d`, XM(ft[1] * dys)]);
      t.f.forEach(([name, price], i) => { if (st.sig[i]) tp.push(["", "", "Signature food", name, XM(price)]); });
      t.a.forEach(([name, price], i) => { if (st.act[i]) tp.push(["", "", "Activity", name, price ? XM(price) : "free"]); });
    });
    tp.push(["", "SLOT TOTAL", "", "", "", "", XM(c.total)]);
    tp.push([]);
  });
  if (!ordered.length) tp.push(["(No trips scheduled yet.)"]);

  /* ---- Sheet 3: Calendar (month grid) ---- */

  const cal: Row[] = [
    [`SEMESTER CALENDAR — ${semYear} (${plan.name || "Plan"})`],
    ["Trips appear on every day they cover."],
    [],
  ];
  const daySlot = (d: Date): string | null => {
    for (const s of slots) {
      const sd = new Date(semYear, s.s[0] - 1, s.s[1]);
      const ed = new Date(semYear, s.e[0] - 1, s.e[1]);
      if (d >= sd && d <= ed && plan.placements[s.id]?.stops.length) return routeOf(s);
    }
    return null;
  };
  for (let m = semStartMonth; m <= semEndMonth; m++) {
    cal.push([`${MONTH_NAMES[m]} ${semYear}`]);
    cal.push(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const dim = new Date(semYear, m, 0).getDate();
    let week: string[] = ["", "", "", "", "", "", ""];
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(semYear, m - 1, d);
      const dow = (dt.getDay() + 6) % 7;
      const r = daySlot(dt);
      week[dow] = r ? `${d} · ${r}` : String(d);
      if (dow === 6 || d === dim) {
        cal.push(week);
        week = ["", "", "", "", "", "", ""];
      }
    }
    cal.push([]);
  }

  /* ---- Sheet 4: Calendar (weekend/slot list) ---- */
  const wk: Row[] = [
    [`SLOT-BY-SLOT CALENDAR — ${plan.name || "Plan"}`],
    [],
    ["Slot", `Dates (${semYear})`, "Type", "Note", "Route", "Places", "Nights", "Cost", "Warnings"],
  ];
  slots.forEach((s) => {
    const filled = plan.placements[s.id]?.stops.length;
    const c = filled ? costsFor(s) : null;
    wk.push([
      s.label, s.date, s.kind, s.note || "",
      filled ? routeOf(s) : "— free —",
      filled ? plan.placements[s.id].stops.length : "",
      filled ? nightsOf(s) : "",
      filled && c ? XM(c.total) : "",
      filled ? flagsOf(s) : "",
    ]);
  });

  /* ---- Sheet 5: Booking links ---- */
  const lk: Row[] = [
    [`BOOKING LINKS — ${plan.name || "Plan"}`],
    ["Blue cells are clickable hyperlinks. Search links open pre-filled for the right city/route."],
    [],
  ];
  const legsWithDates = (s: Slot) => {
    const stops = plan.placements[s.id].stops;
    const legs = slotCosts(s.id, stops, ctx).legs;
    const sd = stopDates(s, stops, semYear);
    return legs.map((l, i) => ({ ...l, d: legDateFor(sd, stops.length, legs.length, i) }));
  };

  lk.push(["✈️ FLIGHTS"]);
  lk.push(["Slot", "Leg", "Date", "Pricing notes", "Link"]);
  let anyFlight = false;
  ordered.forEach((s) => {
    legsWithDates(s)
      .filter((l) => l.mode === "flight")
      .forEach((l) => {
        anyFlight = true;
        lk.push([s.label, `${l.from} → ${l.to}`, l.d ? nice(l.d) : "", l.note || "", XL("Google Flights", googleFlightsUrl(l.from, l.to, l.d))]);
      });
  });
  if (anyFlight) {
    lk.push(["(all flights)", "fare alerts & budget carriers", "", "", XL("Skyscanner", STATIC_LINKS.skyscanner), XL("Kiwi", STATIC_LINKS.kiwi), XL("Ryanair", STATIC_LINKS.ryanair), XL("Wizz Air", STATIC_LINKS.wizzair)]);
  } else {
    lk.push(["(no flight legs in this plan)"]);
  }

  lk.push([], ["🚆 TRAINS & BUSES"], ["Slot", "Leg", "~km", "Search 1", "Search 2", "Search 3"]);
  let anyRail = false;
  ordered.forEach((s) => {
    slotCosts(s.id, plan.placements[s.id].stops, ctx).legs
      .filter((l) => l.mode === "train/bus")
      .forEach((l) => {
        anyRail = true;
        lk.push([s.label, `${l.from} → ${l.to}`, l.km || "", XL("Omio", STATIC_LINKS.omio), XL("Trainline", STATIC_LINKS.trainline), XL("FlixBus", STATIC_LINKS.flixbus)]);
      });
  });
  if (!anyRail) lk.push(["(no rail/bus legs in this plan)"]);

  lk.push([], ["🛏️ LODGING — links open with your dates pre-filled"], ["Slot", "City", "Check-in", "Check-out", "Nights", "Tier chosen", "Search 1", "Search 2", "Search 3"]);
  let anyStay = false;
  ordered.forEach((s) => {
    const sd = stopDates(s, plan.placements[s.id].stops, semYear);
    plan.placements[s.id].stops.forEach((st, i) => {
      if (st.nights < 1) return;
      const t = ctx.tripOf(st.tripId);
      if (!t) return;
      anyStay = true;
      const ci = iso(sd[i].in);
      const co = iso(sd[i].out);
      lk.push([
        s.label, t.n, ci, co, st.nights, lodgingTiers(t.ci)[st.l][0],
        XL("Hostelworld", hostelworldUrl(t.n, ci, co)),
        XL("Booking.com", bookingComUrl(t.n, ci, co)),
        XL("Airbnb", airbnbUrl(t.n, ci, co)),
      ]);
    });
  });
  if (!anyStay) lk.push(["(no overnight stays in this plan)"]);

  lk.push([], ["🎟️ ACTIVITIES — selected items link to a pre-filled search; city rows cover everything else"], ["Slot", "City", "Activity", "Est. price", "Link"]);
  ordered.forEach((s) => {
    plan.placements[s.id].stops.forEach((st) => {
      const t = ctx.tripOf(st.tripId);
      if (!t) return;
      lk.push([s.label, t.n, `(all ${t.n} activities & tickets)`, "", XL("GetYourGuide", getYourGuideUrl(t.n))]);
      t.a.forEach(([name, price], i) => {
        if (st.act[i]) lk.push([s.label, t.n, name, price ? XM(price) : "free", XL("Find tickets", getYourGuideUrl(`${name} ${t.n}`))]);
      });
    });
  });

  lk.push([], ["🍽️ FOOD — where to find each signature dish (Google Maps search)"], ["Slot", "City", "Dish", "Est. price", "Link"]);
  let anyFood = false;
  ordered.forEach((s) => {
    plan.placements[s.id].stops.forEach((st) => {
      const t = ctx.tripOf(st.tripId);
      if (!t) return;
      t.f.forEach(([name, price], i) => {
        if (st.sig[i]) {
          anyFood = true;
          lk.push([s.label, t.n, name, XM(price), XL("Find on Maps", mapsBestDishUrl(name, t.n))]);
        }
      });
    });
  });
  if (!anyFood) lk.push(["(no signature foods selected)"]);

  lk.push(
    [], ["⏰ WHEN TO BOOK — cheat sheet"],
    ["Flights", "4–8 weeks out; holiday weekends (St Pat's, spring break) 2–3 months. Fly Tue/Wed. Set fare alerts."],
    ["Trains/buses", "Short hops: anytime. High-speed (AVE, Frecce, TGV) cheapest when booking opens ~2–3 months out."],
    ["Stays", "3–6 weeks ahead; event weekends 2–3 months. Use free-cancellation rates and rebook if prices drop."],
    ["Activities", "Timed-entry icons (Alhambra, Sagrada Família, Vatican, Last Supper, Anne Frank) sell out — 3–8 weeks ahead."]
  );

  return { bud, tp, cal, wk, lk };
}

// v1's timingTip (reference-v1-app.html:1582-1588) — kept local since booking.ts's
// version takes a Slot and this needs no extra deps.
function timingTipFor(s: Slot): string {
  if (s.id === "sSP")
    return "🍀 St. Patrick's Day spikes Dublin prices hard — book flights AND hostels 2–3 months out (by mid-December). Dublin dorms hit €60+ and sell out first.";
  if (s.kind === "break")
    return "Spring break is peak season. Lock your outbound + return flights and the first/last-city beds 2–3 months ahead. Spain's high-speed AVE trains are cheapest the day the timetable opens (~2 months prior) — buy early.";
  if (s.kind === "post")
    return "Late-May post-finals trends warm and pricey for islands. Book Greek/beach flights and any ferries 6–8 weeks out; Santorini & Mykonos stays sell out first.";
  if (s.kind === "special")
    return "Midweek trip — Tuesday/Wednesday flights are usually the cheapest of the week. Aim to book ~4–6 weeks ahead.";
  return "Weekend citybreak: budget flights are usually cheapest ~4–6 weeks out and climb steeply in the final 2 weeks. Midweek or early-Saturday departures save the most.";
}

export async function exportPlanXlsx(plan: Plan, livePrices: Record<string, LivePrice> = {}) {
  const XLSX = await import("xlsx");
  const sheets = buildXlsxSheets(plan, livePrices);
  const wb = XLSX.utils.book_new();
  const add = (aoa: Row[], name: string, cols: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cols.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(sheets.bud, "Budget", [26, 20, 44, 8, 10, 10, 10, 10, 12, 13, 10, 20, 60]);
  add(sheets.tp, "Travel Plan", [14, 34, 16, 30, 12, 8, 10, 34]);
  add(sheets.cal, "Calendar (Months)", [22, 22, 22, 22, 22, 22, 22]);
  add(sheets.wk, "Calendar (Weekends)", [16, 22, 9, 26, 44, 7, 7, 9, 55]);
  add(sheets.lk, "Booking Links", [16, 26, 13, 13, 10, 24, 16, 14, 14]);
  XLSX.writeFile(wb, `${(plan.name || "plan").replace(/[^\w-]+/g, "_")}_Travel_Plan.xlsx`);
}
