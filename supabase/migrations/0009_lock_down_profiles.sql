-- Phase 11 hardening: stop every signed-in user from reading every user's email.
-- Run this once in the Supabase dashboard's SQL Editor, same as the earlier migrations.
--
-- 0002_sharing.sql created `profiles` with:
--     create policy "Authenticated users can view profiles"
--       on profiles for select to authenticated using (true);
-- That was fine while the only accounts were Parker's own test users. Before
-- opening the app to strangers it is a user-enumeration hole: one signed-in
-- account can `select id, email from profiles` and dump the whole user list.
--
-- This migration narrows it to: you may read a profile row if it is your own,
-- or if that person is the owner or a collaborator on a plan you are also on.
-- Re-runnable: every statement is drop-if-exists / create-or-replace.

-- ---------------------------------------------------------------------------
-- Helper: do the caller and p_target both sit on some shared plan?
--
-- security definer on purpose. The check has to read `plans`, and a subquery
-- inside an RLS policy is itself subject to the *other* table's RLS -- so an
-- inline `exists (select 1 from plans ...)` would only ever see plans the
-- caller can already read. That happens to produce the right answer today,
-- which means it would be correct by accident and would break quietly the day
-- someone edits the `plans` policies. Running the check as definer makes it
-- explicit and independent of that.
--
-- Not a recursion risk: this reads `plans`, and the `plans` policies reference
-- only `plans` columns (auth.uid() = user_id / = any(collaborator_ids)) -- they
-- never read `profiles`, so profiles -> plans terminates. (The classic Postgres
-- RLS infinite-recursion trap is a policy on a table that queries that same
-- table; this is not that shape. security definer also short-circuits it
-- outright, so it stays safe even if `plans` policies later change.)
--
-- auth.uid() still resolves to the *caller* inside a security definer function
-- -- it reads the request JWT, not the definer role -- so this cannot be used
-- to impersonate anyone.
-- ---------------------------------------------------------------------------

create or replace function public.shares_plan_with(p_target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from plans p
    where (p.user_id = auth.uid() or auth.uid() = any(p.collaborator_ids))
      and (p.user_id = p_target or p_target = any(p.collaborator_ids))
  );
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and Supabase's
-- `anon` role inherits PUBLIC -- so a bare `grant ... to authenticated` would
-- NOT actually keep anon out. Revoke first, then grant.
revoke execute on function public.shares_plan_with(uuid) from public, anon;
grant execute on function public.shares_plan_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The narrowed policy.
--
-- Still scoped `to authenticated`, exactly like the policy it replaces, so
-- signed-out visitors keep seeing no profile rows at all (unchanged behavior).
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can view profiles" on profiles;
drop policy if exists "Users can view own and shared-plan profiles" on profiles;

create policy "Users can view own and shared-plan profiles"
  on profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.shares_plan_with(id)
  );

-- "Users can update own profile" from 0002 is unchanged and still correct.

-- ---------------------------------------------------------------------------
-- Share-link owner email.
--
-- src/app/shared/[token]/page.tsx shows "Shared by <owner email>" to someone
-- who has NOT joined as a collaborator yet -- which the policy above correctly
-- refuses, since a not-yet-joined visitor shares no plan with the owner. Rather
-- than widen the table policy to accommodate one page, this returns exactly one
-- string: the owner's email for the single plan matching the token you already
-- hold. Same trust model as get_shared_plan(p_token) in 0002 -- knowing the
-- random token is the only way in.
--
-- Deliberately returns ONLY the owner. Collaborator and last-editor emails stay
-- unreadable to a link visitor, so a share link never leaks the roster of who
-- else is on the plan.
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_plan_owner_email(p_token text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select pr.email
  from plans p
  join profiles pr on pr.id = p.user_id
  where p.share_view_token = p_token
     or p.share_collab_token = p_token
  limit 1;
$$;

-- authenticated only. get_shared_plan is granted to anon as well, but signed-out
-- visitors never saw the owner's email under the old `to authenticated` policy
-- either, so granting anon here would newly widen exposure rather than preserve
-- it. Revoke-then-grant for the PUBLIC-by-default reason noted above.
revoke execute on function public.get_shared_plan_owner_email(text) from public, anon;
grant execute on function public.get_shared_plan_owner_email(text) to authenticated;
