# Semesterly (formerly "Trip Planner v2") — Project Memory (CLAUDE.md)

## Who you're working with

Parker Lewis — junior at University of Illinois Urbana-Champaign (Financial Planning concentration, Econ minor). Studying abroad at Anglo-American University, Prague, **Jan 24 – May 24, 2027**. Fraternity president, bartender, club VP — busy, efficient, finance-minded.

**He has never written code.** This changes how you work:

- Explain what you're doing in plain English, briefly, as you go. No unexplained jargon.
- Before any significant build step or architectural choice, ask him **multiple-choice questions** (he strongly prefers picking from options over open-ended questions).
- Small steps. Working software after every session. Commit + deploy after every working change.
- If he pastes an error, diagnose before editing. Show him how to verify fixes himself (what URL to open, what to click).
- Be concise and direct. He hates filler.

## What we're building

Rebuild `reference-v1-app.html` (a working 187KB single-file app — the source of truth for all features and formulas) as a modern, hosted, multi-user web app.

**Stack (decided):** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel free tier. Supabase free tier for Postgres + auth. PWA via service worker. Travelpayouts/Aviasales Data API (free) for live flight prices — **not** Amadeus, whose self-service program was decommissioned July 17, 2026 before Phase 3 started; see Phase 3 section below. Git + GitHub from day one.

**Never modify or delete `reference-v1-app.html`.** When in doubt about how a feature should behave, open it and read the implementation.

## Phase roadmap (build strictly in order — app must be usable after each phase)

- [x] **Phase 0 — Port.** Reproduce v1 feature-for-feature in Next.js/TS with real components. Trip data → typed data module. State in localStorage (same as v1) plus JSON import so his existing plans carry over. Deploy to Vercel. *(Done — live at trip-planner-v2-gamma.vercel.app.)*
- [x] **Phase 1 — Accounts.** Supabase email/Google auth. Plans move from localStorage to Postgres (keep localStorage as offline cache). Anonymous visitors can still play; signing up keeps their work. *(Done — merged and verified live on trip-planner-v2-gamma.vercel.app; both email magic link and Google sign-in confirmed working.)*
- [x] **Phase 2 — Sharing.** Share a plan via link (read-only or collaborate). Friend plans appear in Compare. Per-trip votes/comments. Friends at other schools can set their own home city + semester dates (editable slots — v1 hard-codes AAU's). *(Shipped and live. Detail in `docs/PROJECT-LOG.md`.)*
- [x] **Phase 3 — Live prices.** Flight-offers lookup per leg, cached server-side (respect free-tier rate limits). Live price shown next to the estimate with a "last checked" stamp; estimates remain the fallback everywhere. Lodging has no good free API — keep tier estimates + deep links with dates. *(Shipped and live; verified end-to-end 2026-07-28. Uses Travelpayouts, not Amadeus — see the log for why.)*
- [x] **Phase 4 — PWA.** Installable on phone; itinerary, calendar, and booked actuals work offline; syncs when back online. He'll be using this on trains in Europe. *(Shipped and live.)*
- [x] **Phase 6 — Study abroad anywhere.** Onboarding flow (host city/university, home university, term, semester dates) so the app works for any study-abroad student, not just AAU Prague. Dynamic calendar slots generated from confirmed dates instead of the hardcoded 16. Schengen tracker uses the onboarded host country. *(Not in the original roadmap — added by Parker's own request. Shipped and live.)*
- [x] **Phase 7 — Activity depth, selection autonomy, food fix.** Activities expand from ~4/city to 15-25/city (hand-authored, in batches). Placing a trip checks NO activities by default; price ranges (floor/ceiling) replace single numbers; quick presets (Highlights/Balanced/Everything/None) speed up picking. Signature dishes become a $0 bucket list — the food tier already covers a day's eating, so a checked dish no longer adds its price on top (the old double-count bug). *(Not in the original roadmap — added by Parker's own request. Shipped and live — all 212 trips expanded.)*
- [x] **Phase 8 — Party size + live hotel pricing.** Every slot gets a travelers count; lodging math becomes group-aware (per person per night, room/unit-sharing formulas); totals show per-person and group amounts everywhere. Live hotel prices for the private-room/boutique tiers. *(Not in the original roadmap — added by Parker's own request. Party size is fully complete and live-ready. Live hotel pricing's plumbing is complete but the upstream provider isn't actually reachable yet — see Phase 8 section below for why, and what unblocks it.)*
- [x] **Phase 9 — Personal-profile layer.** So a brand-new visitor never looks like Parker specifically: no hardcoded "Prague" defaults anywhere, extending the Phase 6 onboarding/Settings system (not a second parallel one) with a couple of new fields (studying-in-Europe flag, currency), a proper setup wizard and dynamic calendar generator that now work for anonymous visitors too, not just signed-in accounts. *(Not in the original roadmap — added by Parker's own request. Done in 3 steps — see Phase 9 section below.)*
- [x] **Phase 10 — Rename to "Semesterly" + full visual restyle.** Replace "Trip Planner v2" everywhere user-visible (wordmark, title/metadata, PWA manifest, favicon). Move off the all-dark zinc theme to a light, roomy "clean + playful/college" look: indigo primary + coral accent, Poppins headings, rounded cards, design tokens in `globals.css`. Restyle every screen, mobile-first. *(Not in the original roadmap — added by Parker's own request. Shipped and live.)*

## v1 feature inventory (everything below must survive the port)

Five tabs: Overview · Trip Catalog · My Calendar · Itinerary & Totals · Plans & Compare.

1. **212-trip catalog**, 43 countries, 11 regions. Trip schema: `{id, n(name), c(country), reg, co:[lat,lon], t:[types], cats:[categories], m:[best months], g(suggested nights), ci(cost index 1-5), wx(weather), w(blurb), a:[[activity,price]...], f:[[signature food,price]...]}`. Lodging/travel are NOT in the data — derived at runtime.
2. **9 multi-select filter groups** (region, best-time, travel-time-from-home [dynamic], weather, cost, trip type, length, activity type, country) + text search. OR within group, AND across groups.
3. **16 calendar slots** (13 weekends, St. Patrick's midweek Mar 16–18, spring break Mar 26–Apr 4, post-finals May 15–24) with weekend-list AND month-grid views. Drag-drop, tap-to-place, tap-slot picker. Multi-stop trips per slot (ordered cities, auto-routed).
4. **Cost model** (per-person USD): `CI_BASE={1:{lodg:13,food:12},2:{20,18},3:{28,24},4:{38,32},5:{52,42}}`. 4 lodging tiers/night: hostel(b), Airbnb split(1.5b), private(2.1b), boutique(3.6b). 3 food tiers/day: street(b), mid(1.8b), foodie(2.9b). days = nights+1. Activities are individually checkable one-offs that do NOT scale with nights (deliberate). **Superseded by Phase 7**: signature foods are no longer priced line-items added on top of the food tier — the tier is the whole day's food budget; dishes are a $0 checkable bucket list (reference price shown, not counted). Placing a trip no longer auto-checks activities (was: all checked by default; now: none, with Highlights/Balanced/Everything/None quick presets). Catalog/itinerary pricing shows a floor-ceiling range, not one number, for the same reason. See Phase 7 section below. **Superseded again by Phase 8**: the 4 lodging tiers are no longer flat per-person numbers — they're group-aware (hostel stays flat; Airbnb/private/boutique scale with a per-slot travelers count, splitting a whole unit/room across the group). Food/activities/travel stay per-person always (they don't split). Every total shows both the per-person figure and the whole-group figure. See Phase 8 section below for the exact formulas.
5. **Auto travel routing**: HOME → stops → HOME. Great-circle km; ≤60km local $0; ≤350km train/bus max(14, 0.11·km); else flight max(40, 35+0.028·km). The 0.028 was calibrated against real budget fares — don't "fix" it upward.
6. **Real-world pricing layer**: seasonal multipliers (St. Pat's Dublin flights ×2.2, other holiday-week flights ×1.15; spring-break flights ×1.5, rail ×1.15; post-finals beach flights ×1.3), per-plan bag setting (none / cabin +$28 / checked +$45 per flight), secondary-airport transfer fees (Paris-Beauvais $22, Milan-Bergamo $14, Barcelona $18, London $16, Brussels $18, Rome $9, Stockholm $16, Venice $12, Vienna-Bratislava $14, Frankfurt-Hahn $20, Oslo-Torp $18). Legs carry pricing-note strings.
7. **Feasibility warnings** (non-blocking, red/amber): nights exceed slot days; total transit hours > days×4; stop off-season for the slot month.
8. **Schengen 90/180 tracker**: days = Σ(nights+1) per stop in a Schengen country other than the home country (study-visa country exempt). Amber >80, red >90. UK nations, Ireland, Cyprus, most Balkans, Morocco, Turkey are non-Schengen; Andorra/Monaco count as Schengen.
9. **Budget features**: per-plan budget cap (stays per-person even after Phase 8's group-aware lodging — see Phase 8 section) with remaining/over; per-slot "booked actuals" (travel/lodging/food/activities) that blend with estimates and show variance; 20 selectable home-base cities that reprice everything.
10. **Multi-plan system**: auto-save, new/duplicate/rename/delete, JSON export/import for sharing, side-by-side compare table (green lowest / red highest per row).
11. **Booking links with dates**: per-leg Google Flights (dated), lodging links with check-in/out prefilled (sequential allocation from slot start by nights) and, since Phase 8, the slot's actual guest count (`&group_adults=`/`&adults=`/`&number_of_guests=`), GetYourGuide/Viator/Tiqets per city + per-activity, Google Maps "best <dish> <city>" per signature food, when-to-book cheat sheet + per-slot timing tips.
12. **Excel export per plan** (SheetJS): Budget / Travel Plan / Calendar-Months / Calendar-Weekends / Booking Links sheets, with actuals, variance, flags, Schengen row, live hyperlinks.

## Decisions already made — do not re-litigate

Activities don't scale with nights. Start plans empty. Warnings never block or delete user choices. Estimates are conservative on purpose (Schengen counter over-counts, +12% buffer, Eurail $296 shown as optional). Both calendar views stay. Itemized per-item pricing stays. Bag default = cabin. Declined features: daily transit line-items, Eurail as a toggle, auto-backup nudges, crowd-level/popularity filters, **AI/LLM trip discovery ("Find me more trips")** — this was built in full (API route, UI, its own Supabase table, the `@anthropic-ai/sdk` dependency) as the original roadmap's Phase 5, then intentionally removed at Parker's request. Do not rebuild it.

## Known simplifications (fine to improve WITH his sign-off, never silently)

Seasonal multipliers are calibrated guesses. Stop dates assume departure on slot start. Schengen counter ignores non-slot travel. Flight estimates assume direct budget routes exist.

**Phase 6 additions**: the `UNIVERSITY_SEMESTERS` seed database (`src/data/universitySemesters.ts`) covers Fall 2026/Spring 2027 only — dates drift a bit year to year and will need a refresh for later academic years. Post-finals windows in generated slots are always *computed* (last ~9 days before the program end date), never individually researched, even when the rest of a university's dates come from a real cited source. National-holiday midweek windows are included only where a research pass happened to turn one up, not guaranteed for every university. Winter term has no seed data at all yet (smart manual defaults only). A handful of researched universities have flagged uncertainties — see the comment block at the top of `universitySemesters.ts` before fully trusting an edge case.

**Flag, not yet resolved**: Phase 6's research turned up that AAU Prague's actually-published Spring 2027 calendar is **Jan 29 – May 14, 2027**, not the Jan 24 – May 24 baked into `src/data/slots.ts` / `DEFAULT_SEMESTER` (and this file's own header). That baseline was deliberately left untouched — Parker's existing plan and all its placements are keyed to those exact slot dates — but it's a real discrepancy worth his own look (source: `aauni.edu`'s 2026-2027 academic calendar page, cited in `universitySemesters.ts`).

## His non-negotiable trips (keep working well in recommendations)

Dublin for St. Patrick's (Mar 17, 2027 — midweek), Marrakech, Rome, Paris.

## Session protocol

At the start of each session: state which phase is active. At the end: update the roadmap checkboxes above and append any new decisions to this file — but keep it small: a shipped phase's writeup moves to `docs/PROJECT-LOG.md` and leaves only a one-line status here (see "Log discipline" at the end). He may say "commit and deploy" — that means: git commit with a clear message, push, verify the Vercel build succeeded, give him the URL.

## Where every phase stands

Full detail for every phase below lives in `docs/PROJECT-LOG.md` — read it when a question actually touches that history. Phase 5 does not exist: it was the AI/LLM trip-discovery feature, built then removed at Parker's request (see "Decisions already made").

| # | What | Status |
|---|---|---|
| 0 | Core app — catalog, calendar, itinerary, plans/compare, Excel export | shipped |
| 1 | Accounts | shipped |
| 2 | Sharing | shipped |
| 3 | Live flight prices | shipped — verified live 2026-07-28 |
| 4 | PWA | shipped |
| 6 | Onboarding + university calendars | shipped |
| 7 | Activity expansion + food-model fix | complete — all 212 trips carry 15–25 authored activities |
| 8 | Party size (A) / live hotel prices (B) | A complete; **B blocked upstream** |
| 9 | Personal-profile layer (steps 1–8) | complete — nothing further planned |
| 10 | "Semesterly" rename + visual restyle | shipped |
| 11 | Privacy note + pre-launch pass | shipped |
| 12 | Trip photos via Unsplash | shipped; **photo fetch mid-run** — 147/212 |
| 13 | Program-calendar picker + provider research | picker built; research **paused between batches** |
| 14 | UIUC exchange-partner calendars | **paused** — batch 6 hit a WebSearch quota wall |
| 15 | Catalog detail sheet "Add to weekend" picker | shipped |
| 16 | Plans-tab semester panel program search | shipped |
| 17 | UIUC "Illinois program center" retry | 3 of 4 resolved |
| 18 | Hardening for a public test | shipped |
| 19 | Setup-loop fix + edge-to-edge weekend generation | shipped |
| 20 | Consistent button language + Home/Plan picker | shipped |
| 21 | Pre-launch security hardening — migrations `0009`–`0011` | shipped — verified live 2026-07-28 |

`PROGRAM_CALENDARS` currently holds **142 rows** — 44 provider entries (Phase 13) + 98 university entries (Phase 14).

**Every migration `0001`–`0011` is applied, and every phase branch is merged into `main`.** There is no deploy backlog — an earlier version of this file claimed Phases 2/3/6 still needed their migrations run, which was already untrue when written. Confirmed 2026-07-28 by querying the live database catalog directly, not by reading these notes.

## Security posture (Phase 21 — read before touching RLS or the API routes)

Three real holes were found and closed just before opening the app to the public. Detail in `docs/PROJECT-LOG.md`; the rules that outlive them:

- **A comment claiming a restriction is not a restriction.** All three bugs were migrations whose own comments asserted access was locked down while the actual `grant` said otherwise. Check the grants, not the prose.
- **Postgres grants `EXECUTE` on new functions to `PUBLIC` by default**, and Supabase's `anon`/`authenticated` inherit it. A `revoke ... from anon, authenticated` without `public` silently accomplishes nothing.
- **RLS cannot restrict columns** — only column-level `GRANT` can. An UPDATE policy with no `WITH CHECK` let a collaborator rewrite `user_id` and seize a plan.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. Server-only, never `NEXT_PUBLIC_`, never imported by a client component — `src/lib/supabase/__tests__/service-boundary.test.ts` enforces this by scanning the source.
- Rate limiting (`src/lib/rateLimit.ts`) is in-memory and therefore **per-instance and approximate on Vercel**. Fine at this scale; the upgrade path is documented in that file.
- Still untested by Vitest, because it has no database: the RLS policies themselves. Verify those against a real instance as two different users.

**1. Phase 8 Part B — blocked upstream, not by us.** Travelpayouts' cached hotel pricing "requires special access" via a support request, separate from the flight token — unlike flights, it is not self-serve. Everything downstream is finished (migration `0006`, the route, store, `LiveHotelPrice.tsx`, Excel labels); `api/hotels/price/route.ts` honestly returns 502 "unavailable" (uncached, so it retries cleanly) until access exists. The city→Hotellook location-ID map was deliberately **not** built, since there is no working endpoint to validate it against. To unblock: request hotel-data access on the same account as the flight token, then expect a small tweak to the route's upstream URL/params.

**2. Phase 12 photo fetch — mid-run.** 147/212 as of 2026-07-28. Blocked only on `UNSPLASH_ACCESS_KEY` being present in `.env.local`. Resume with `npm run fetch-photos` (which is `node --env-file=.env.local scripts/fetch-photos.mjs`) (plain Node does not auto-load `.env.local` — that is a Next.js convention). Unsplash's free demo tier is 50 req/hour at 2 requests per trip, so roughly 21 trips/hour; the script is resumable, rewrites its manifest after every trip, and stops itself cleanly on the rate-limit header. Photos are committed to the repo (`public/trips/*.jpg` + `src/data/tripPhotos.ts`); Vercel never talks to Unsplash and needs no key.

**3. Phases 13 & 14 research — paused by Parker's own rule** of checking in between batches, to keep usage cost bounded. Do not run the remaining batches in one shot without asking.

Known-blocked sources, each a distinct kind of gap rather than "couldn't find it":
- **WHU** — `robots.txt` explicitly disallows this project's crawler. Treated as a policy boundary to respect, not routed around. Do not work around it.
- **CEA CAPA** — domain-wide 403 bot-blocking (Dublin, Rome); partner mirrors show "TBA"/"Forthcoming", so the dates may genuinely not be published yet.
- **Bologna** — calendars are genuinely decentralized per school/degree; no central page exists.
- **Tilburg** — its own 2026-27 PDF is explicitly labelled DRAFT with no end date.
- **Arcadia, Humboldt, AIFS London, EBS, Bergen, Universidade Catolica Portuguesa** — each unreachable or insufficiently dated; detail in the log.

Unresolved UIUC "Illinois program center" entries: **Athens** (no host institution found at all), **Paris** (a genuine multi-institution consortium — no single calendar exists to cite), and **Pavia / Granada CLM / IAU College / Barcelona-El Vallès / Arles** (hosts identified or partly identified, dates still needed — worth a retry once search quota resets).

**4. Browser-verification debt.** Phases 9, 12, and 13 each shipped with "not independently verified — no browser automation tool exists in this environment," so several click-throughs were never actually done. That disclaimer reflects the environment those sessions ran in, not a permanent fact: **check whether the current session has browser tooling before repeating it.** Outstanding click-throughs: the program search in Settings, Catalog plus two trip detail sheets, the same plan viewed in USD/EUR/GBP, and toggling the studying-in-Europe switch both directions.

**5. Two known cosmetic/data flags, deliberately left alone.** The static `<meta description>` still reads "Spring 2027, Prague" — same for every visitor, never part of any ask. And the AAU Prague date discrepancy is recorded under "Known simplifications" above.

## Standing conventions (earned across phases — follow these)

**Sourcing and honesty**
- Never guess or fabricate a date, price, or host institution. Omit the entry and state the gap explicitly — "probably doesn't exist" and "exists but unsourceable" are different findings and worth distinguishing.
- Verify a provider actually works *before* building on it. Phase 3 lost Amadeus this way; Phase 8 caught Hotellook's access gate the same way, before writing throwaway code.
- Every program-calendar entry carries `VERIFY_NOTE`, surfaced in the UI whenever the entry is applied.
- Term start is the first day of **teaching**, not orientation or welcome week. Where a university publishes both an administrative semester and a narrower lecture period, record the lecture period.
- Program and city names are plain ASCII even where the real name has diacritics ("Bogazici", "Krakow", "Catolica") — matches the rest of the dataset.
- Ship features labelled honestly. A stored-but-inert field says so ("doesn't change any prices yet"); an estimate says it is an estimate rather than showing a fabricated live number.

**Code discipline**
- When a function grows a parameter, make it **required** so `tsc --noEmit` enumerates every call site, rather than optional-with-a-default that silently misses one. Used deliberately in Phases 8 and 9.
- Prefer one shared resolver over a widening special case (`resolveHome.ts`, `formatMoney`), and delete the duplicated local helpers it replaces.
- An obviously-wrong fallback beats a plausible-wrong one: `[0, 0]` null island, never a Prague guess.
- Warn before destroying. Preview what a regenerate would drop (`slotsToBeLost`) and confirm by name first — never silently delete a user's placements.
- Auto-generated files (`trips.ts`, `homes.ts`, via `scripts/extract-trips.mjs`) get fully overwritten on re-run; never hand-add an export to one.
- Standard gate before calling anything done: `tsc --noEmit`, the Vitest suite, `eslint`, `next build`.

## Log discipline (this file must stay small)

This file is loaded into context at the start of every session, so its size is a running cost. It reached 171 KB / ~43k tokens before being trimmed on 2026-07-27.

When a phase ships: move its writeup to `docs/PROJECT-LOG.md` and leave a one-line status in the table above. Keep here only what is **not** recoverable from the repo — decisions, constraints, preferences, blockers, and conventions. Root-cause write-ups for fixed bugs belong in the commit message and the log, not here.
