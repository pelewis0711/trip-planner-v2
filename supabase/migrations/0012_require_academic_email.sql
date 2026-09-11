-- Require a university email address to create a Semesterly account.
-- Run once in the Supabase dashboard's SQL Editor, same as the earlier migrations.
-- Safe to run more than once (see "Privilege caveat" below).
--
-- What this creates:
--   1. public.academic_domains         the allow-list. Add a school from the Table Editor;
--                                      no code change, no deploy (CLAUDE.md, "Adding a
--                                      school domain").
--   2. public.is_academic_email(text)  the one matching rule. src/lib/auth/academicEmail.ts
--                                      mirrors it for the login form's error messages only.
--   3. A BEFORE INSERT trigger on auth.users -- the real gate. Calling the Supabase Auth
--      API directly can't get around it.
--   4. public.semesterly_before_user_created(jsonb) -- a "Before User Created" auth hook
--      running the same check. Supabase Auth hides a trigger's error behind a generic
--      "Database error saving new user"; a hook's message is passed through to the app,
--      which is what lets a rejected Google signup see a real explanation. The hook only
--      runs once you switch it on (Authentication -> Hooks). The trigger works without it.
--
-- EXISTING ACCOUNTS ARE GRANDFATHERED. The trigger is INSERT-only, never UPDATE, and
-- Supabase Auth only inserts into auth.users when it creates a brand-new account. A
-- returning user -- magic link or Google -- updates their existing row, so neither the
-- trigger nor the hook ever runs for them. That includes email-change flows.
--
-- WHO ELSE THIS BLOCKS: anything that creates a user without a university email --
-- including "Add user" / "Invite" in the Supabase dashboard, phone sign-ups and anonymous
-- sign-ins (no email at all). None are used today. To create a non-school test account,
-- add its domain to academic_domains first and delete the row afterwards.
--
-- NO ORPHANED ROWS: when the trigger raises, the INSERT aborts before the row is written,
-- the AFTER INSERT trigger that fills `profiles` (0002) never fires, and Supabase Auth
-- rolls back its whole signup transaction. A rejected signup leaves nothing behind.
--
-- ---------------------------------------------------------------------------
-- PRIVILEGE CAVEAT -- auth.users is not ours
--
-- auth.users is owned by supabase_auth_admin. The SQL Editor runs as `postgres`, which
-- is not the owner and not a member of supabase_auth_admin, but has been granted
-- privileges on the table, TRIGGER among them (checked on this project). In Postgres
-- that is enough to CREATE a trigger -- 0002's `on_auth_user_created` was created the
-- same way -- but DROP TRIGGER requires owning the table. So
--     drop trigger if exists ... on auth.users;
-- only succeeds when there is nothing to drop; once the trigger exists, every re-run
-- would fail with "must be owner of relation users". This file therefore does NOT open
-- with a drop trigger. Instead the trigger is created only if it's missing (step 3),
-- and everything that could ever need changing lives in the trigger FUNCTION, which
-- postgres owns and `create or replace` updates in place. Result: this whole file
-- runs cleanly from the SQL Editor, the first time and every time after.
--
-- UNDO, in one paste. postgres owns the function, and CASCADE takes the trigger with
-- it -- Supabase's own troubleshooting docs use this route for exactly this ownership
-- problem. A plain `drop trigger ... on auth.users` fails for the reason above.
--
--   drop function if exists public.semesterly_enforce_academic_email() cascade;
--
-- If you switched the auth hook on, switch it OFF first (Authentication -> Hooks ->
-- Before User Created). Never drop semesterly_before_user_created while the hook still
-- points at it: every signup would fail.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. The allow-list.
--
-- pattern: lowercase, no leading dot. A pattern covers itself and its subdomains, so
-- one rule handles TLD suffixes (edu -> illinois.edu), country academic suffixes
-- (ac.uk -> ox.ac.uk) and a single school (uva.nl -> uva.nl, student.uva.nl).
--
-- The CHECK constraint turns a typo made in the Table Editor (".edu", "UVA.nl",
-- "uva.nl " with a trailing space) into an immediate error naming the rule, instead
-- of a row that silently never matches anything.
-- ---------------------------------------------------------------------------

create table if not exists public.academic_domains (
  pattern  text primary key,
  label    text,
  added_at timestamptz not null default now(),
  constraint pattern_is_lowercase_domain_no_leading_dot check (
    pattern ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'
  )
);

-- The login page reads the list (anon and signed-in alike) for its error messages.
-- Nobody writes it through the API: there are no insert/update/delete policies, and
-- the grants are revoked too (same belt-and-braces as 0010/0011). Parker edits it in
-- the Table Editor, which runs as postgres -- the owner, which has BYPASSRLS.
alter table public.academic_domains enable row level security;

drop policy if exists "Anyone can read academic domains" on public.academic_domains;
create policy "Anyone can read academic domains"
  on public.academic_domains for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.academic_domains from anon, authenticated;
grant select on public.academic_domains to anon, authenticated;

-- Seed. `on conflict do nothing`: re-running never overwrites a label edited in the
-- Table Editor. It would re-add a seed row deleted since -- to drop a seed school for
-- good, remove it here AND from src/data/academicDomains.ts.
-- Keep this list identical to src/data/academicDomains.ts (a test enforces it).
insert into public.academic_domains (pattern, label) values
  -- Broad academic suffixes
  ('edu', 'US universities'),
  ('ac.uk', 'United Kingdom'),
  ('ac.nz', 'New Zealand'),
  ('ac.jp', 'Japan'),
  ('ac.kr', 'South Korea'),
  ('ac.in', 'India'),
  ('ac.il', 'Israel'),
  ('ac.za', 'South Africa'),
  ('ac.at', 'Austria'),
  ('ac.be', 'Belgium'),
  ('ac.th', 'Thailand'),
  ('ac.id', 'Indonesia'),
  ('ac.cn', 'China'),
  ('edu.au', 'Australia'),
  ('edu.sg', 'Singapore'),
  ('edu.hk', 'Hong Kong'),
  ('edu.cn', 'China'),
  ('edu.mx', 'Mexico'),
  ('edu.br', 'Brazil'),
  ('edu.co', 'Colombia'),
  ('edu.ar', 'Argentina'),
  ('edu.pe', 'Peru'),
  ('edu.ec', 'Ecuador'),
  ('edu.pl', 'Poland'),
  ('edu.tr', 'Turkey'),
  ('edu.gr', 'Greece'),
  ('edu.my', 'Malaysia'),
  ('edu.ph', 'Philippines'),
  ('edu.vn', 'Vietnam'),
  ('edu.pt', 'Portugal'),
  -- European schools on plain country TLDs
  ('cuni.cz', 'Charles University, Prague'),
  ('vse.cz', 'Prague University of Economics'),
  ('cvut.cz', 'Czech Technical University'),
  ('sciencespo.fr', 'Sciences Po'),
  ('escp.eu', 'ESCP Business School'),
  ('em-lyon.com', 'emlyon'),
  ('unibocconi.it', 'Bocconi'),
  ('luiss.it', 'LUISS'),
  ('unicatt.it', 'Università Cattolica'),
  ('uc3m.es', 'Carlos III Madrid'),
  ('ucm.es', 'Complutense Madrid'),
  ('unav.es', 'Universidad de Navarra'),
  ('uva.nl', 'University of Amsterdam'),
  ('tudelft.nl', 'TU Delft'),
  ('ru.nl', 'Radboud'),
  ('eur.nl', 'Erasmus Rotterdam'),
  ('uni-heidelberg.de', 'Heidelberg'),
  ('lmu.de', 'LMU Munich'),
  ('fu-berlin.de', 'Freie Universität Berlin'),
  ('tum.de', 'TU Munich'),
  ('uni-mannheim.de', 'Mannheim'),
  ('ku.dk', 'University of Copenhagen'),
  ('cbs.dk', 'Copenhagen Business School'),
  ('ruc.dk', 'Roskilde'),
  ('lu.se', 'Lund'),
  ('kth.se', 'KTH Stockholm'),
  ('su.se', 'Stockholm University'),
  ('gu.se', 'Gothenburg'),
  ('uio.no', 'University of Oslo'),
  ('nhh.no', 'NHH Bergen'),
  ('bi.no', 'BI Norwegian Business School'),
  ('aalto.fi', 'Aalto'),
  ('helsinki.fi', 'University of Helsinki'),
  ('hi.is', 'University of Iceland'),
  ('tcd.ie', 'Trinity College Dublin'),
  ('ucd.ie', 'University College Dublin'),
  ('ucc.ie', 'University College Cork'),
  ('universityofgalway.ie', 'University of Galway'),
  ('dcu.ie', 'Dublin City University'),
  ('unil.ch', 'Lausanne'),
  ('unige.ch', 'Geneva'),
  ('ethz.ch', 'ETH Zurich'),
  ('epfl.ch', 'EPFL'),
  ('unisg.ch', 'University of St. Gallen'),
  ('kuleuven.be', 'KU Leuven'),
  ('vub.be', 'Vrije Universiteit Brussel'),
  ('ulb.be', 'Université libre de Bruxelles'),
  ('ucp.pt', 'Universidade Católica Portuguesa'),
  ('novasbe.pt', 'Nova SBE'),
  ('ulisboa.pt', 'Universidade de Lisboa'),
  ('corvinus.hu', 'Corvinus Budapest'),
  ('sgh.waw.pl', 'SGH Warsaw'),
  ('auth.gr', 'Aristotle University'),
  ('aueb.gr', 'Athens Univ. of Economics and Business'),
  -- Canada (.ca, so each school needs its own entry)
  ('mcgill.ca', 'McGill'),
  ('utoronto.ca', 'University of Toronto'),
  ('ubc.ca', 'UBC'),
  ('uwaterloo.ca', 'Waterloo'),
  ('queensu.ca', 'Queen''s'),
  ('yorku.ca', 'York'),
  ('sfu.ca', 'Simon Fraser'),
  ('ualberta.ca', 'Alberta'),
  ('mcmaster.ca', 'McMaster'),
  ('uottawa.ca', 'University of Ottawa')
on conflict (pattern) do nothing;


-- ---------------------------------------------------------------------------
-- 2. The matching rule. src/lib/auth/academicEmail.ts must stay identical to this.
--
--   domain = everything after the LAST '@', edge whitespace trimmed, lowercased
--   academic  <=>  some pattern p has  domain = p  OR  domain ends with '.' || p
--
-- That's the "lower(domain) = pattern OR lower(domain) LIKE '%.' || pattern" rule,
-- written with right() instead of LIKE so a '_' or '%' could never act as a wildcard.
-- The leading '.' is what stops lookalikes: illinois.edu.attacker.com doesn't end in
-- '.edu', and notuva.nl doesn't end in '.uva.nl'.
--
-- Null, empty or malformed input returns false rather than throwing: no '@', nothing
-- before the '@', or a domain that isn't an ASCII hostname with at least two labels.
-- That last check is what rejects `x@edu` -- a bare suffix isn't a school. It runs
-- BEFORE lowercasing so Postgres and JavaScript agree on every input (a few non-ASCII
-- characters lowercase to ASCII in one language and not the other).
--
-- security definer: the trigger and the hook both call this from roles that have no
-- RLS policy on academic_domains (the hook runs as supabase_auth_admin). As definer
-- it reads the table as its owner, so it always sees every row. search_path is pinned,
-- as it must be for any security definer function.
-- ---------------------------------------------------------------------------

create or replace function public.is_academic_email(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email  text;
  v_rev_at int;
  v_at     int;
  v_domain text;
begin
  if p_email is null then
    return false;
  end if;

  -- same six characters as the JS rule: space \t \n \r \f and \v (chr(11))
  v_email := btrim(p_email, E' \t\n\r\f' || chr(11));

  v_rev_at := strpos(reverse(v_email), '@');
  if v_rev_at = 0 then
    return false;                                -- no '@' at all
  end if;
  v_at := length(v_email) - v_rev_at + 1;        -- position of the LAST '@'
  if v_at = 1 then
    return false;                                -- nothing before it
  end if;

  v_domain := substr(v_email, v_at + 1);
  -- DOMAIN_REGEX -- keep identical to DOMAIN_SHAPE in academicEmail.ts
  if v_domain !~ '^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then
    return false;
  end if;
  v_domain := lower(v_domain);

  return exists (
    select 1
    from public.academic_domains d
    where v_domain = d.pattern
       or right(v_domain, length(d.pattern) + 1) = '.' || d.pattern
  );
end;
$$;

grant execute on function public.is_academic_email(text) to anon, authenticated, supabase_auth_admin;


-- ---------------------------------------------------------------------------
-- 3. The gate: BEFORE INSERT on auth.users. INSERT only -- never UPDATE -- so every
--    existing account keeps working forever.
--
-- errcode P0001 with the literal token SEMESTERLY_NOT_ACADEMIC_EMAIL, so the rejection
-- is greppable in the Postgres and Auth logs. Supabase Auth does NOT pass this message
-- to the app -- it answers "Database error saving new user" (HTTP 500) -- which is why
-- step 4 exists. The email itself stays out of the message; the logs already record who
-- tried.
-- ---------------------------------------------------------------------------

create or replace function public.semesterly_enforce_academic_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_academic_email(new.email) then
    raise exception using
      errcode = 'P0001',
      message = 'SEMESTERLY_NOT_ACADEMIC_EMAIL: new Semesterly accounts need a university email address',
      hint    = 'Allowed domains live in public.academic_domains.';
  end if;
  return new;
end;
$$;

-- Create-if-missing rather than drop-and-recreate: see "Privilege caveat" at the top.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'semesterly_require_academic_email'
  ) then
    create trigger semesterly_require_academic_email
      before insert on auth.users
      for each row
      execute function public.semesterly_enforce_academic_email();
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. The readable rejection: a Before User Created auth hook.
--
-- Supabase Auth runs this before it creates any new user -- magic link, Google, or a
-- direct API call -- and never for a returning one (it only fires when Auth has decided
-- to create a new account). Returning {"error": {...}} cancels the signup and hands the
-- message to the app: the JSON body for a magic-link request, `error_description` on
-- the redirect back to /auth/callback for Google. The app looks for the token.
--
-- Inert until switched on: Authentication -> Hooks -> Before User Created -> Postgres
-- function -> public.semesterly_before_user_created. With it off, the trigger still
-- blocks the same signups, just with the generic error.
--
-- Deliberately NOT security definer (Supabase's recommendation for hooks): it runs as
-- supabase_auth_admin, and the one thing it needs, is_academic_email(), is granted to
-- that role above.
-- ---------------------------------------------------------------------------

create or replace function public.semesterly_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if public.is_academic_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'SEMESTERLY_NOT_ACADEMIC_EMAIL: new Semesterly accounts need a university email address.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.semesterly_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.semesterly_before_user_created(jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Confirmation -- the SQL Editor shows this one row after "Success". Expect:
--   domains_loaded >= 94 | trigger_installed = true | illinois_allowed = true | gmail_allowed = false
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.academic_domains) as domains_loaded,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and tgname = 'semesterly_require_academic_email'
  ) as trigger_installed,
  public.is_academic_email('pel4@illinois.edu') as illinois_allowed,
  public.is_academic_email('someone@gmail.com') as gmail_allowed;
