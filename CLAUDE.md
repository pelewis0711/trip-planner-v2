# Trip Planner v2 — Project Memory (CLAUDE.md)

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
- [x] **Phase 2 — Sharing.** Share a plan via link (read-only or collaborate). Friend plans appear in Compare. Per-trip votes/comments. Friends at other schools can set their own home city + semester dates (editable slots — v1 hard-codes AAU's). *(Built — needs `0002_sharing.sql` run + Vercel deploy before it's live; see Phase 2 section below.)*
- [x] **Phase 3 — Live prices.** Flight-offers lookup per leg, cached server-side (respect free-tier rate limits). Live price shown next to the estimate with a "last checked" stamp; estimates remain the fallback everywhere. Lodging has no good free API — keep tier estimates + deep links with dates. *(Built — needs `0003_flight_prices.sql` run + `TRAVELPAYOUTS_API_TOKEN` in Vercel + deploy; see Phase 3 section below. Uses Travelpayouts, not Amadeus — see why.)*
- [x] **Phase 4 — PWA.** Installable on phone; itinerary, calendar, and booked actuals work offline; syncs when back online. He'll be using this on trains in Europe. *(Built — needs a deploy (no new migration or env var this time); see Phase 4 section below.)*
- [x] **Phase 5 — Trip discovery.** "Find me more trips" — an API route that uses an LLM to propose trips NOT in the catalog matching his filters/dates/budget, returned in the exact trip schema, human-approved before joining the catalog. *(Built — needs `0004_custom_trips.sql` run + `ANTHROPIC_API_KEY` in Vercel + deploy; see Phase 5 section below. This is the first paid API in the project — real per-run cost, shown to Parker every run.)*

## v1 feature inventory (everything below must survive the port)

Five tabs: Overview · Trip Catalog · My Calendar · Itinerary & Totals · Plans & Compare.

1. **212-trip catalog**, 43 countries, 11 regions. Trip schema: `{id, n(name), c(country), reg, co:[lat,lon], t:[types], cats:[categories], m:[best months], g(suggested nights), ci(cost index 1-5), wx(weather), w(blurb), a:[[activity,price]...], f:[[signature food,price]...]}`. Lodging/travel are NOT in the data — derived at runtime.
2. **9 multi-select filter groups** (region, best-time, travel-time-from-home [dynamic], weather, cost, trip type, length, activity type, country) + text search. OR within group, AND across groups.
3. **16 calendar slots** (13 weekends, St. Patrick's midweek Mar 16–18, spring break Mar 26–Apr 4, post-finals May 15–24) with weekend-list AND month-grid views. Drag-drop, tap-to-place, tap-slot picker. Multi-stop trips per slot (ordered cities, auto-routed).
4. **Cost model** (per-person USD): `CI_BASE={1:{lodg:13,food:12},2:{20,18},3:{28,24},4:{38,32},5:{52,42}}`. 4 lodging tiers/night: hostel(b), Airbnb split(1.5b), private(2.1b), boutique(3.6b). 3 food tiers/day: street(b), mid(1.8b), foodie(2.9b). days = nights+1. Activities & signature foods are individually checkable one-offs that do NOT scale with nights (deliberate).
5. **Auto travel routing**: HOME → stops → HOME. Great-circle km; ≤60km local $0; ≤350km train/bus max(14, 0.11·km); else flight max(40, 35+0.028·km). The 0.028 was calibrated against real budget fares — don't "fix" it upward.
6. **Real-world pricing layer**: seasonal multipliers (St. Pat's Dublin flights ×2.2, other holiday-week flights ×1.15; spring-break flights ×1.5, rail ×1.15; post-finals beach flights ×1.3), per-plan bag setting (none / cabin +$28 / checked +$45 per flight), secondary-airport transfer fees (Paris-Beauvais $22, Milan-Bergamo $14, Barcelona $18, London $16, Brussels $18, Rome $9, Stockholm $16, Venice $12, Vienna-Bratislava $14, Frankfurt-Hahn $20, Oslo-Torp $18). Legs carry pricing-note strings.
7. **Feasibility warnings** (non-blocking, red/amber): nights exceed slot days; total transit hours > days×4; stop off-season for the slot month.
8. **Schengen 90/180 tracker**: days = Σ(nights+1) per stop in a Schengen country other than the home country (study-visa country exempt). Amber >80, red >90. UK nations, Ireland, Cyprus, most Balkans, Morocco, Turkey are non-Schengen; Andorra/Monaco count as Schengen.
9. **Budget features**: per-plan budget cap with remaining/over; per-slot "booked actuals" (travel/lodging/food/activities) that blend with estimates and show variance; 20 selectable home-base cities that reprice everything.
10. **Multi-plan system**: auto-save, new/duplicate/rename/delete, JSON export/import for sharing, side-by-side compare table (green lowest / red highest per row).
11. **Booking links with dates**: per-leg Google Flights (dated), lodging links with check-in/out prefilled (sequential allocation from slot start by nights), GetYourGuide/Viator/Tiqets per city + per-activity, Google Maps "best <dish> <city>" per signature food, when-to-book cheat sheet + per-slot timing tips.
12. **Excel export per plan** (SheetJS): Budget / Travel Plan / Calendar-Months / Calendar-Weekends / Booking Links sheets, with actuals, variance, flags, Schengen row, live hyperlinks.

## Decisions already made — do not re-litigate

Activities don't scale with nights. Start plans empty. Warnings never block or delete user choices. Estimates are conservative on purpose (Schengen counter over-counts, +12% buffer, Eurail $296 shown as optional). Both calendar views stay. Itemized per-item pricing stays. Bag default = cabin. Declined features: daily transit line-items, Eurail as a toggle, auto-backup nudges, crowd-level/popularity filters.

## Known simplifications (fine to improve WITH his sign-off, never silently)

Seasonal multipliers are calibrated guesses. Stop dates assume departure on slot start. Schengen counter ignores non-slot travel. Flight estimates assume direct budget routes exist.

## His non-negotiable trips (keep working well in recommendations)

Dublin for St. Patrick's (Mar 17, 2027 — midweek), Marrakech, Rome, Paris.

## Session protocol

At the start of each session: state which phase is active. At the end: update the roadmap checkboxes above and append any new decisions to this file. He may say "commit and deploy" — that means: git commit with a clear message, push, verify the Vercel build succeeded, give him the URL.

## Phase 0 — complete

Built in 9 stages per `/Users/pelewis0711/.claude/plans/glittery-waddling-storm.md`: scaffold+deploy → data extraction → calc engine → Overview/Catalog → Calendar → Itinerary → Plans/Compare → Excel export → mobile polish. Every stage committed, pushed, and verified live. All 5 v1 tabs are up at trip-planner-v2-gamma.vercel.app with feature parity, including the multi-plan system, Schengen tracker, seasonal pricing, and Excel export.

Parker chose to **modernize the visual design** (Tailwind, cleaner spacing) rather than pixel-match v1's CSS — same dark theme spirit, same functionality. Stack additions beyond the original decision: npm, Vitest for calc-engine tests, Zustand for global state (`src/lib/store/plan.ts` — multi-plan store with home/bag/budget per plan, replacing the single-plan precursor from Stage 4), `xlsx` package for Excel export **installed from SheetJS's own CDN** (`cdn.sheetjs.com`), not the npm registry — the npm release is frozen on an old build with unpatched high-severity CVEs.

Data safety: the plan store has a `migrate()` path (in `plan.ts`) that carries forward anyone's pre-Stage-6 localStorage data into a real named plan — don't remove this without checking whether it's still needed for existing users.

Note: this project's Next.js version has breaking changes vs. older Next.js — `AGENTS.md` (generated by create-next-app) points to `node_modules/next/dist/docs/` for the current APIs/conventions. Check there before writing routing/data-fetching code that might rely on stale patterns.

Testing note: Playwright's fullPage screenshots produce misleading artifacts around `position: sticky`/`fixed` elements (duplicated headers, apparently "blank" content underneath) — not real bugs. Verify with a viewport-only screenshot or direct DOM inspection before trusting what a fullPage screenshot seems to show.

## Phase 1 — complete

Built on branch `worktree-phase1-accounts` (merged via PR #1): Supabase client/server utilities (`src/lib/supabase/`), a custom-styled `/login` page (email magic link + Google OAuth), `src/app/auth/callback/route.ts`, an `AuthSync` client component that auto-merges local plans into the account on first sign-in and then keeps Postgres in sync (write-through, debounced), and a new `plans` table with RLS (`supabase/migrations/0001_plans.sql`).

**Gotcha hit during setup, worth knowing for Phase 2/3**: Supabase's **Authentication → URL Configuration → Site URL** defaults to `http://localhost:3000` and silently overrides any `redirectTo`/`emailRedirectTo` passed from the client if the target URL isn't in the **Redirect URLs** allow-list — sign-in "worked" (no error) but bounced back to localhost instead of the live site. Fixed by setting Site URL to `https://trip-planner-v2-gamma.vercel.app` and adding `https://trip-planner-v2-gamma.vercel.app/auth/callback` to the allow-list. Any new deploy domain (custom domain, etc.) will need the same treatment.

Decisions made this session:
- **Passwordless email auth** (magic link via `signInWithOtp`), not password-based — simpler UX, no forgot-password flow to build. Google OAuth alongside it.
- **Auto-merge on sign-in** (not a confirmation prompt): the moment someone signs in, their local plans are merged into their account automatically, last-write-wins by each plan's `updated` timestamp.
- **localStorage stays authoritative for anonymous use** — Postgres is a sync target, not a replacement. `activeId`/`compareIds` (per-device UI state) are NOT synced, only `plans` (home/bag/budget/placements) are.
- Supabase project: `ngrwkofyvaspcweptbyp`. Anon key lives in `.env.local` (gitignored) — same two vars need adding to Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Confirmed via `node_modules/next/dist/docs`**: this Next.js version (16.2.10) renamed the `middleware.ts` file convention to `proxy.ts` (function name `proxy`, not `middleware`) — don't write a `middleware.ts` file, it won't run. Session-cookie refresh logic lives in `src/proxy.ts` / `src/lib/supabase/proxy.ts`.

## Phase 2 — built, needs migration + deploy to go live

Branch `phase2-sharing`. Migration: `supabase/migrations/0002_sharing.sql` (run once in the Supabase SQL Editor, same as 0001). No new secrets needed — sharing works entirely through Postgres RPC functions callable with the existing anon key.

**How sharing works**: `plans` gained `share_view_token`/`share_collab_token` (nullable — null means that kind of sharing is off) and `collaborator_ids uuid[]`. A view link works with **no login at all** — `get_shared_plan(token)` is a `security definer` function granted to the `anon` role that returns only the one row matching the token, same trust model as a Google Docs link. A collab link requires signing in; `join_plan_as_collaborator(token)` appends the caller's `auth.uid()` to `collaborator_ids`, after which normal RLS (`owner OR auth.uid() = ANY(collaborator_ids)`) grants ongoing access — no need to keep re-using the link. Toggling sharing on/off and reading `collaborator_ids` is owner-only, enforced inside each RPC (not by the broader table RLS, which deliberately also allows collaborators to view/edit content) so a collaborator can never rotate a share link or add/remove other collaborators.

Content saves for **both** owners and collaborators go through `update_plan_data()` (a plain, non-definer SQL function, so it's still checked against the row's own RLS) instead of a raw client-side `upsert` — this is what stamps `last_edited_by`/`last_edited_at` server-side and is also what makes collaborator edits work at all: an `upsert`'s `ON CONFLICT DO UPDATE` path is checked against the **INSERT** policy too (owner-only), which would silently block every collaborator save if the client tried to upsert directly. `AuthSync` now branches: brand-new plans (no `ownerId` yet) get a plain `insert`; already-synced plans (own or collaborated) go through `update_plan_data`.

`profiles` is a public mirror of `auth.users(id, email)`, kept in sync by an `on_auth_user_created` trigger — needed because the client can't query `auth.users` directly, and the UI needs emails to show "last edited by" / comment authors / collaborator counts.

Votes (`plan_votes`, fixed 5-emoji palette, one per user per slot, upsert-to-replace) and comments (`plan_comments`, flat list, delete-own-only) are both scoped to owner-or-collaborators only, matching the spec's "from collaborators" wording — a view-only visitor doesn't see them. They live in Calendar's `EditModal` (per-slot detail view), not the slot-grid cards, so opening the calendar doesn't fire 16 queries at once.

**Editable semesters**: `Plan.semester` is `undefined` by default, which means "use the exact hand-authored `SLOTS` list, unchanged" — zero behavior/regression risk for Parker's existing AAU plan. Setting it (via the per-plan-card "📅 Semester" panel, owner-only) switches that one plan to slots generated from its own start/end + custom breaks (`src/lib/calc/semester.ts`). Compare's per-slot rows now use the **union** of slots across the plans being compared (`unionSlots`), since two plans can have entirely different slot sets once semesters diverge — for same-semester plans (the common case) this is identical to the old fixed list. Booking-link dates (`stopDates`) and the Excel month-grid now take the plan's actual semester year instead of hardcoding 2027.

**Read-only shared plans** (added via "Add to my Compare") live in the same `plans` map as your own, marked `readOnly: true`. `switchPlan` refuses to activate them (Compare-only, by design — no read-only mode was built for Calendar/Itinerary, to keep scope bounded) and the write-through sync skips them entirely. `duplicatePlan` explicitly strips `ownerId`/`readOnly`/share tokens/`collaboratorIds` from the copy — without that, duplicating a shared plan would silently produce a copy that's permanently stuck read-only and never syncs (caught and fixed during this build, before it shipped).

**Known simplification**: leaving a collaboration isn't wired up (removing yourself from `collaborator_ids`) — only the owner can revoke access, by disabling collab sharing entirely (which clears the whole list). Fine to add later with his sign-off.

Next: run the migration + Vercel env are already set from Phase 1, so this should just need the SQL run + PR merge. Then Phase 3 (live prices).

**PR queue as of Phase 3**: three branches are built and pushed but none are merged into `main` yet — `phase1-wrapup` (docs only, trivial), `phase2-sharing` (needs `0002_sharing.sql`), `phase3-live-prices` (needs `0003_flight_prices.sql` + a Vercel env var). Merge in that order since later ones build on earlier ones.

## Phase 3 — built, needs migration + env var + deploy to go live

Branch `phase3-live-prices`. Migration: `supabase/migrations/0003_flight_prices.sql`. New Vercel env var: `TRAVELPAYOUTS_API_TOKEN` (server-only — do **not** prefix with `NEXT_PUBLIC_`, it must never reach the browser; already in `.env.local` for local dev).

**Provider switch, mid-project**: the original plan was Amadeus Self-Service. Amadeus announced in February 2026 that the self-service portal was closing, paused new registrations in spring 2026, and fully decommissioned it (existing keys included) on July 17, 2026 — three days before Phase 3 work started, so there was never a walkthrough to give. Researched alternatives and picked **Travelpayouts/Aviasales Data API** instead: free, no card, no approval/traffic-minimum gate (that only applies to their separate real-time Search API), and it's real fare data (cheapest fares actual Aviasales users found on a route in the last 2–7 days) rather than a sandbox. Trade-off, told to Parker upfront: it's "cheapest recently-found fare for this route," not a guaranteed exact-date match — for dates far in the future (most of Spring 2027 still is, from where this was built) many route/date combos will simply have no cached data yet and fall back to the estimate. Coverage should improve as departure dates get closer.

**How it works**: `/api/flights/price?origin=&destination=&date=` (Route Handler, the *only* thing holding `TRAVELPAYOUTS_API_TOKEN` — never called from client code with the token). Checks `flight_price_cache` (Postgres, 24h TTL, keyed by origin+destination+date, globally shared across all users since flight prices aren't user-specific) before ever calling Travelpayouts; writes go through `upsert_flight_price()` (security definer, same reasoning as Phase 2's RPC-only-writes pattern) so the free-tier token's usage stays bounded by real cache misses, not by how many people are looking at the app. A negative result (route found, no fares) is cached too, so a dead route doesn't get re-queried every page load.

**City → airport mapping**: `src/data/iata.ts`, compiled by a research agent from general knowledge (not extracted from a source file like the other `src/data/*` files — spot-check before fully trusting). 209 of 214 catalog+home cities mapped; 5 left genuinely unmapped because there's no defensible single answer: **Dolomites (Bolzano), Black Forest, Andorra, Mostar, Ios**. A live price silently isn't offered for those — the estimate is the only number, same as any leg whose IATA lookup fails. A number of the 209 are "nearest reasonable airport" substitutions for region/valley-style catalog names (e.g. Cinque Terre → Pisa) flagged at moderate confidence in the file's comments — worth a skim if a specific one looks off.

**Calc engine stays untouched on purpose**: `slotCosts()`/`grandTotals()` (tested, Phase 0) are pure estimates, unchanged. `src/lib/calc/livePricing.ts` is a separate overlay layer (`liveSlotCosts`, `liveAdjustedGrandTotals`) that swaps in a live price for flight legs where one's been fetched and falls back to the estimate everywhere else (train/bus, local, unmapped city, not-yet-fetched). The per-plan **"use live prices" toggle** (`Plan.useLivePrices`, Itinerary page) decides which one the UI actually displays/sums — off by default, so nothing changes for a plan that's never touched the feature.

Fetched prices live in a session-only Zustand store (`useLivePriceStore`, not persisted) — every page load re-asks `/api/flights/price`, which is cheap since it's almost always a Postgres read, not a real Travelpayouts call. `SlotItinerary` triggers the fetch per flight leg on mount; the page-level grand total and the Excel export both read from the same store, so **Excel only includes live numbers for legs you've already viewed on the Itinerary page in this session** — a real limitation, told to Parker rather than hidden.

Next: run the migration, add the Vercel env var, merge the PR queue (see note above), then Phase 4 (PWA).

## Phase 4 — built, needs a deploy to go live

Branch `phase4-pwa`. No new migration or env var this time — installability and offline are entirely client-side/static.

**Why this was simpler than it sounds**: the app's data has been local-first since Phase 0 (Zustand + localStorage) — Postgres is a sync target, not the source of truth for an open session. That means "view the itinerary/calendar offline" is almost entirely just "make sure the page's HTML/JS/CSS loads without a network round trip" — the plan data itself is already sitting in localStorage regardless of connectivity. The real gap, and the actual engineering in this phase, was that a plan edit made offline (e.g. typing in a booked actual on a train) would fail to sync to Supabase and then **silently vanish from the sync attempt entirely** — the data was always safe locally, but it would never reach the account once back online. That's fixed now (see below).

**Manifest + icons**: `app/manifest.ts` (standard Next.js file convention). Icons are generated at build time with `next/og`'s `ImageResponse` (`src/lib/appIcon.tsx` — a simple dark/emerald "TP" mark matching the site's existing theme, no external image tool or asset needed) via `app/apple-icon.tsx` and three tiny route handlers under `app/manifest-icon/`. **`apple-icon.tsx` is the one that actually matters for iOS** — Safari uses the `apple-touch-icon` link tag for the home-screen icon, not the manifest's `icons` array (that's for Android/desktop). All four icon routes are `force-static` so they're built once, not regenerated per request.

**Service worker**: hand-written (`public/sw.js`), not a library. Next's own PWA guide recommends Serwist for offline support, but it "requires webpack configuration" and this project already builds with Turbopack — rather than risk that friction, and since the actual caching need here is simple (app-shell only, no push notifications), a ~50-line hand-rolled worker covers it: precaches the five main routes on install, cache-first for `_next/static/*` (content-hashed, safe to cache forever), network-first-falling-back-to-cache for page navigations, and explicitly bypasses `/api/*` and any cross-origin request (Supabase, Travelpayouts, booking sites) so those are never served stale. Registered by `src/components/RegisterServiceWorker.tsx`, mounted in the root layout.

**Offline sync queue** (the actual new logic, in `AuthSync.tsx`): `syncPlansUp()` now returns which plan ids succeeded and which failed instead of just logging failures. A failed id gets added to `pendingSyncIds` (new field on the plan store, persisted — survives closing the app while still offline). Three triggers retry the queue: the `online` window event, a 30s fallback interval (installed PWAs, especially on iOS, don't reliably fire `online`), and once on mount/sign-in. The Header shows a small pill — "📴 Offline" when disconnected, "🔄 Syncing N changes…" when there's a queue draining — so it's never a silent, invisible state.

**iOS install**: no native install prompt exists on iOS (Safari doesn't support `beforeinstallprompt`), so `src/components/InstallPrompt.tsx` is a dismissible in-app banner shown only to iOS Safari visitors who haven't already installed it, pointing at Share → Add to Home Screen. Uses `useSyncExternalStore` (not `useEffect` + `setState`) for the iOS/standalone detection — avoids a lint rule (`react-hooks/set-state-in-effect`) flagging the classic "detect browser-only fact after mount" pattern, and is the more correct tool for it anyway since `getServerSnapshot` makes the SSR-vs-client mismatch explicit and handled rather than papered over.

**Known limitation**: booking links (Google Flights, hotel sites, etc.) are just external URLs — the page and its links render fine offline, but tapping one still needs a real connection to actually load, same as any offline web page linking out. Told to Parker, not hidden.

Next: deploy (see below for iPhone install + airplane-mode verification steps given directly to Parker), then Phase 5 (trip discovery).

## Phase 5 — built, needs migration + env var + deploy to go live (final phase in the original roadmap)

Branch `phase5-discovery`. Migration: `supabase/migrations/0004_custom_trips.sql`. New Vercel env var: `ANTHROPIC_API_KEY` (server-only). Uses `@anthropic-ai/sdk`, model `claude-opus-4-8` with `thinking: {type: "adaptive"}` and `output_config.format` (structured outputs / JSON schema) — no manual JSON-parsing-and-praying.

**This is the first paid API in the project** — Supabase, Travelpayouts, and everything else so far were free-tier. A discovery run costs real money (a few cents, typically well under 15¢ — exact figure is computed from real `usage.input_tokens`/`output_tokens` off Opus 4.8 pricing and shown to Parker after every run, not just estimated upfront).

**How it works**: Catalog page → "✨ Discover more trips" button (uses whatever filters are currently active there) → `/api/discover` gathers the real context (home base, active filters, open calendar slots from `getSlotsForPlan`, remaining budget via `blendedTotals`, remaining Schengen days via `schengenDays`) → sends one request to Claude with the full existing 212+-trip catalog listed in the prompt (so it knows what NOT to repeat) and a JSON schema constraining the response shape. The LLM-facing schema uses named objects (`{name, price}`) instead of the app's internal `[name, price]` tuples, since structured-outputs JSON schema doesn't support fixed-length tuples well — `src/lib/discover/schema.ts` converts after validation rather than fighting the schema format.

**"Validate every field; reject malformed ones" is real, not just a schema constraint**: structured outputs guarantees shape (right field names/types), not semantics — a `costIndex` of 47 or an empty `activities` array is valid JSON but not a valid trip. `validateAndConvertTrip()` re-checks every field's actual range/enum/non-emptiness server-side regardless of what the schema already enforced, plus a duplicate check (case-insensitive name+country) against both the static catalog and the account's already-discovered trips. Rejected suggestions are dropped with a logged reason and a visible count in the UI; only what survives validation reaches the approve/reject cards.

**Per-account, not global**: approved trips never touch `src/data/trips.ts` (shared code, same for every user). They live in a new `custom_trips` table (owner-only RLS, no sharing/collaboration — simpler than plans, since a discovered trip is either yours or it isn't) plus a parallel local-first Zustand store (`src/lib/store/customTrips.ts`) so approving one works fully offline/anonymously too, consistent with everything else in this app. `makeCtx()` (`src/lib/calc/context.ts`) now merges the current account's custom trips into the trip lookup by reading the store's current snapshot directly (not as a function argument) — same for the Catalog page's browse/filter list and Calendar's trip tray, so an approved trip is immediately placeable, priceable, and filterable exactly like one of the 212 built-in ones. `buildFilterGroups()` also takes an optional trips list now so filter options (region/country/activity-type dropdowns) pick up whatever a discovered trip introduces.

**Known simplification**: no offline retry queue for custom-trip sync (unlike the plan store's Phase 4 queue) — a sync failure here just means re-approving a discovery, not losing real trip-planning work, so it wasn't worth the same complexity.

This was the last phase in the original roadmap. Everything from here is enhancement, not the planned build.
