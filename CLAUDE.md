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

**Stack (decided):** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel free tier. Supabase free tier for Postgres + auth. PWA via service worker. Amadeus Self-Service API (free tier) for live flight prices. Git + GitHub from day one.

**Never modify or delete `reference-v1-app.html`.** When in doubt about how a feature should behave, open it and read the implementation.

## Phase roadmap (build strictly in order — app must be usable after each phase)

- [x] **Phase 0 — Port.** Reproduce v1 feature-for-feature in Next.js/TS with real components. Trip data → typed data module. State in localStorage (same as v1) plus JSON import so his existing plans carry over. Deploy to Vercel. *(Done — live at trip-planner-v2-gamma.vercel.app.)*
- [x] **Phase 1 — Accounts.** Supabase email/Google auth. Plans move from localStorage to Postgres (keep localStorage as offline cache). Anonymous visitors can still play; signing up keeps their work. *(Done — merged and verified live on trip-planner-v2-gamma.vercel.app; both email magic link and Google sign-in confirmed working.)*
- [x] **Phase 2 — Sharing.** Share a plan via link (read-only or collaborate). Friend plans appear in Compare. Per-trip votes/comments. Friends at other schools can set their own home city + semester dates (editable slots — v1 hard-codes AAU's). *(Built — needs `0002_sharing.sql` run + Vercel deploy before it's live; see Phase 2 section below.)*
- [ ] **Phase 3 — Live prices.** Amadeus flight-offers lookup per leg, cached server-side (respect free-tier rate limits). Live price shown next to the estimate with a "last checked" stamp; estimates remain the fallback everywhere. Lodging has no good free API — keep tier estimates + deep links with dates.
- [ ] **Phase 4 — PWA.** Installable on phone; itinerary, calendar, and booked actuals work offline; syncs when back online. He'll be using this on trains in Europe.
- [ ] **Phase 5 — Trip discovery.** "Find me more trips" — an API route that uses an LLM to propose trips NOT in the catalog matching his filters/dates/budget, returned in the exact trip schema, human-approved before joining the catalog.

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
