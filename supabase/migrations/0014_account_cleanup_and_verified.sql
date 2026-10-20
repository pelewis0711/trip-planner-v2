-- Phase 26 follow-up: (1) deleting an account removes everything social
-- about it, however it's deleted; (2) a "verified student" flag on profiles.
-- Run once in the Supabase SQL Editor after 0013. Re-runnable.
--
-- (1) Account deletion. Every user-owned table already cascades from
-- auth.users (plans, settings, votes, comments, public_profiles,
-- social_settings). Three things didn't:
--   a. plans.last_edited_by referenced auth.users with NO on-delete rule, so
--      deleting someone who had last edited a friend's shared plan FAILED
--      outright. Now it's set to null instead.
--   b. plans.collaborator_ids is a uuid[] with no foreign key, so a deleted
--      user's id stayed stranded in other people's plans. Now removed.
--   c. Profile photos live in Storage, which no foreign key can reach -- and
--      Supabase blocks deleting Storage files with SQL (it must go through the
--      Storage API). So the database QUEUES the files to delete, and the app
--      removes them: right away when someone deletes their account in the app
--      (/api/account/delete), and in a daily sweep (/api/cron/storage-cleanup)
--      for everything else -- e.g. a user deleted from the Supabase dashboard,
--      or a replaced photo the browser didn't manage to clean up.
--
-- (b) and (c) hang off a trigger on public.profiles, not auth.users: every
-- account has a profiles row (0002's trigger + backfill) and it cascades from
-- auth.users on EVERY deletion path, while this project deliberately avoids
-- triggers on auth.users (see 0012 -- postgres can't drop them later).
--
-- (2) Verified student = the account's email is on the academic_domains
-- list (0012's is_academic_email). The 2 grandfathered gmail accounts are the
-- only unverified ones today. Returned by get_public_profile as `verified`, and
-- the "Verified students" audience now really means verified: a viewer
-- without a university email no longer qualifies.

-- ---------------------------------------------------------------------------
-- (a) plans.last_edited_by: set null on delete.
-- ---------------------------------------------------------------------------

alter table public.plans drop constraint if exists plans_last_edited_by_fkey;
alter table public.plans
  add constraint plans_last_edited_by_fkey
  foreign key (last_edited_by) references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- (c) The Storage cleanup queue. Only the service role touches it (RLS on, no
-- policies, no grants) -- no signed-in user can read or write it.
-- `path` ending in '/' means "everything in this folder".
-- ---------------------------------------------------------------------------

create table if not exists public.storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  reason text not null,
  queued_at timestamptz not null default now(),
  attempts int not null default 0,
  constraint storage_cleanup_queue_bucket check (bucket in ('avatars')),
  constraint storage_cleanup_queue_path check (char_length(path) between 1 and 300)
);

alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b)+(c) When an account goes away.
-- security definer: the delete may be run by Supabase Auth's own role (the
-- dashboard / admin API), which can't write plans or the queue itself.
-- ---------------------------------------------------------------------------

create or replace function public.wn_after_account_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
     set collaborator_ids = array_remove(collaborator_ids, old.id)
   where old.id = any(collaborator_ids);

  insert into public.storage_cleanup_queue (bucket, path, reason)
  values ('avatars', old.id::text || '/', 'account deleted');

  return old;
end;
$$;

revoke execute on function public.wn_after_account_deleted() from public, anon, authenticated;

drop trigger if exists wn_after_account_deleted on public.profiles;
create trigger wn_after_account_deleted
  after delete on public.profiles
  for each row execute function public.wn_after_account_deleted();

-- A replaced or removed profile photo: queue the old file. (The app also
-- deletes it right away; this catches the times that call didn't happen.)
create or replace function public.wn_queue_replaced_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.avatar_path is not null and old.avatar_path is distinct from new.avatar_path then
    insert into public.storage_cleanup_queue (bucket, path, reason)
    values ('avatars', old.avatar_path, 'photo replaced');
  end if;
  return new;
end;
$$;

revoke execute on function public.wn_queue_replaced_avatar() from public, anon, authenticated;

drop trigger if exists wn_queue_replaced_avatar on public.public_profiles;
create trigger wn_queue_replaced_avatar
  after update of avatar_path on public.public_profiles
  for each row execute function public.wn_queue_replaced_avatar();

-- ---------------------------------------------------------------------------
-- (2) Verified students.
-- ---------------------------------------------------------------------------

create or replace function public.wn_is_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_academic_email((select email from public.profiles where id = p_user)), false);
$$;

revoke execute on function public.wn_is_verified(uuid) from public, anon;
grant execute on function public.wn_is_verified(uuid) to authenticated;

-- Same as 0013, except a stranger only gets audience='verified' details when
-- the VIEWER is a verified student too.
create or replace function public.wn_visible_fields_for(p_target uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  acc text := public.wn_viewer_access(p_target);
  s public.social_settings;
begin
  if acc = 'self' then
    return public.wn_profile_fields();
  end if;
  if acc in ('none', 'blocked') then
    return '{}';
  end if;

  select * into s from public.social_settings where id = p_target;
  if not found then
    return '{}'; -- never saved settings = everything private
  end if;

  if acc = 'friend'
     or (acc = 'friend_of_friend' and s.audience in ('friends_of_friends', 'verified'))
     or (acc = 'stranger' and s.audience = 'verified' and public.wn_is_verified(auth.uid())) then
    return s.visible_fields;
  end if;
  return '{}';
end;
$$;

-- Same as 0013, plus `verified`.
create or replace function public.wn_profile_json(p_target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.public_profiles;
  f text[];
  out jsonb;
begin
  select * into p from public.public_profiles where id = p_target;
  if not found or not public.wn_can_see_identity(p_target) then
    return null;
  end if;

  f := public.wn_visible_fields_for(p_target);
  out := jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'access', public.wn_viewer_access(p_target),
    'verified', public.wn_is_verified(p.id)
  );

  if 'photo' = any(f) then out := out || jsonb_build_object('avatar_path', p.avatar_path); end if;
  if 'bio' = any(f) then out := out || jsonb_build_object('bio', p.bio); end if;
  if 'gender' = any(f) then
    out := out || jsonb_build_object('gender', p.gender, 'gender_custom', p.gender_custom);
  end if;
  if 'host_city' = any(f) then
    out := out || jsonb_build_object('host_city', p.host_city, 'host_country', p.host_country);
  end if;
  if 'host_university' = any(f) then out := out || jsonb_build_object('host_university', p.host_university); end if;
  if 'program' = any(f) then out := out || jsonb_build_object('program', p.program); end if;
  if 'home_university' = any(f) then out := out || jsonb_build_object('home_university', p.home_university); end if;
  if 'grad_year' = any(f) then out := out || jsonb_build_object('grad_year', p.grad_year); end if;
  if 'abroad_dates' = any(f) then
    out := out || jsonb_build_object('abroad_start', p.abroad_start, 'abroad_end', p.abroad_end);
  end if;
  if 'languages' = any(f) then out := out || jsonb_build_object('languages', to_jsonb(p.languages)); end if;
  if 'budget_level' = any(f) then out := out || jsonb_build_object('budget_level', p.budget_level); end if;
  if 'travel_interests' = any(f) then out := out || jsonb_build_object('travel_interests', to_jsonb(p.travel_interests)); end if;
  if 'personal_interests' = any(f) then out := out || jsonb_build_object('personal_interests', to_jsonb(p.personal_interests)); end if;
  if 'custom_details' = any(f) then out := out || jsonb_build_object('custom_details', p.custom_details); end if;

  return out;
end;
$$;

-- create or replace keeps existing grants, but restate them so this file is
-- correct on its own.
revoke execute on function public.wn_visible_fields_for(uuid) from public, anon;
grant execute on function public.wn_visible_fields_for(uuid) to authenticated;
revoke execute on function public.wn_profile_json(uuid) from public, anon, authenticated;
