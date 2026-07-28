-- Pre-launch hardening, round 2: close the gaps an audit of 0001/0002 turned up.
-- Run once in the Supabase dashboard's SQL Editor. Safe to run more than once.
--
-- Background. 0002_sharing.sql claims, in its own comments, that the sharing
-- RPCs are "the ONLY way share tokens and collaborator_ids ever change -- the
-- app never writes those columns directly". That is true of this app's code and
-- false of the database. Row Level Security cannot restrict *columns*; only
-- column-level GRANTs can, and no migration ever issued one. Supabase grants
-- every column to `authenticated` by default, and PostgREST exposes a PATCH
-- endpoint, so the app's own code was never the boundary.
--
-- Same shape as the bug 0010 fixed: a comment asserting a restriction that the
-- grants did not actually impose.
--
-- Three concrete holes closed here:
--
--   1. OWNERSHIP HIJACK. 0002's UPDATE policy is
--        using (auth.uid() = user_id or auth.uid() = any(collaborator_ids))
--      with no WITH CHECK, so it defaults to that same expression. A
--      collaborator could PATCH plans directly and set user_id to themselves:
--      the new row still satisfies the policy (they are now the owner), so it
--      passes, and the real owner is locked out of their own plan. They could
--      equally rewrite collaborator_ids or rotate share_view_token.
--
--   2. UNSOLICITED COLLABORATION. INSERT only checks auth.uid() = user_id, so a
--      new plan could be created with collaborator_ids pre-filled with other
--      people, injecting a plan into their plan list uninvited.
--
--   3. EMAIL SPOOFING. profiles' UPDATE policy is `using (auth.uid() = id)`
--      with nothing constraining `email`, so a user could set their own profile
--      email to any string. Since 0009 is precisely what lets collaborators see
--      each other's emails, a collaborator could make "last edited by" -- or the
--      owner line on a share link -- display someone else's address.
--
-- No application code changes with this migration: the app already routes every
-- plan update through update_plan_data() and never writes profiles at all.

-- ---------------------------------------------------------------------------
-- 1. update_plan_data becomes security definer.
--
-- It has to, because the next statement revokes UPDATE on plans from
-- `authenticated`, and this function is `security invoker` -- it runs with the
-- caller's rights and would start failing. As definer it runs as the owner, so
-- it needs to make the permission check itself rather than leaning on the table
-- policy. That is the same pattern every other sharing RPC in 0002 already
-- uses ("Each one re-checks ownership itself").
--
-- Behaviour is otherwise identical: same columns written, same last_edited_by
-- stamp, same return shape.
-- ---------------------------------------------------------------------------

create or replace function public.update_plan_data(p_id text, p_name text, p_data jsonb)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first to edit this plan';
  end if;

  if not exists (
    select 1 from plans
    where id = p_id
      and (user_id = uid or uid = any(collaborator_ids))
  ) then
    raise exception 'Only the plan owner or a collaborator can edit this plan';
  end if;

  return query
  update plans
  set name = p_name,
      data = p_data,
      updated_at = now(),
      last_edited_by = uid,
      last_edited_at = now()
  where id = p_id
  returning *;
end;
$$;

revoke execute on function public.update_plan_data(text, text, jsonb) from public, anon;
grant execute on function public.update_plan_data(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. plans: no direct UPDATE at all; INSERT restricted to safe columns.
--
-- The app never issues a direct UPDATE on plans (verified across the whole
-- source tree -- only .insert(), .select() and .delete()), so revoking UPDATE
-- outright costs nothing and makes update_plan_data the single write path, as
-- 0002 always intended.
--
-- INSERT keeps working but only for the columns the app actually inserts
-- (see planToInsertRow in src/lib/supabase/sharing.ts). collaborator_ids and
-- both share tokens fall back to their column defaults and can then only be
-- changed through the security definer sharing RPCs.
--
-- DELETE is left alone: it is already owner-only via 0001's policy, and the app
-- deletes plans directly.
--
-- The security definer RPCs (enable_view_share, disable_view_share,
-- enable_collab_share, disable_collab_share, join_plan_as_collaborator,
-- update_plan_data) all run as the function owner, so none of them are affected
-- by these revokes.
-- ---------------------------------------------------------------------------

revoke update on plans from anon, authenticated;

revoke insert on plans from anon, authenticated;
grant insert (id, user_id, name, data, updated_at) on plans to authenticated;

-- Defence in depth: even though UPDATE is now revoked, make the policy state
-- the intent explicitly, so re-granting UPDATE later can't silently reopen the
-- ownership hijack. WITH CHECK is what stops a row being rewritten into a shape
-- that still satisfies the policy but changes who owns it.
drop policy if exists "Owners and collaborators can update plans" on plans;
create policy "Owners and collaborators can update plans"
  on plans for update
  using (auth.uid() = user_id or auth.uid() = any(collaborator_ids))
  with check (auth.uid() = user_id or auth.uid() = any(collaborator_ids));

-- ---------------------------------------------------------------------------
-- 3. profiles: writable only by the trigger, never by a client.
--
-- profiles is a mirror of auth.users maintained entirely by
-- handle_new_user() (0002), which is security definer and therefore unaffected
-- by these revokes. The app only ever SELECTs from this table -- verified
-- across the source tree -- so no client write privilege is needed at all.
-- Removing it is what stops a user rewriting their own displayed email.
-- ---------------------------------------------------------------------------

drop policy if exists "Users can update own profile" on profiles;

revoke insert, update, delete on profiles from anon, authenticated;
