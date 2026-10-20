-- Phase 26: social profiles (foundation for friends, groups and chat).
-- Run once in the Supabase dashboard's SQL Editor, same as the earlier
-- migrations. Re-runnable: every statement is if-not-exists, create-or-replace
-- or drop-then-create.
--
-- Two new tables, deliberately separate from `profiles`:
--   * `profiles` (0002) mirrors auth.users' email and stays locked down by
--     0009 -- emails are never part of the social layer.
--   * public_profiles holds what a person chooses to show. Only its owner can
--     read the table directly. Everyone else goes through get_public_profile(),
--     which returns exactly the fields that viewer is allowed to see.
--   * social_settings holds the privacy and notification choices. Own row
--     only, ever.
--
-- "Who can see what" lives in ONE function, wn_viewer_access(). In Phase 26 it
-- only knows "self" and "stranger"; Phase 27 replaces it (and only it) to add
-- friends, friends-of-friends and blocks.
--
-- Everything starts private: a new profile shows nothing beyond name and
-- username, and even those only to friends (or to anyone, if the person turns
-- on "Appear in search").

-- ---------------------------------------------------------------------------
-- Fixed lists. Kept as functions so the CHECK constraints and the app share
-- one source; src/data/interests.ts and src/lib/social/profile.ts must match
-- (src/lib/social/__tests__/profile.test.ts fails if they drift).
-- Left executable by PUBLIC on purpose: CHECK constraints run them as
-- whoever is inserting, and they return only constants.
-- ---------------------------------------------------------------------------

create or replace function public.wn_travel_interests()
returns text[] language sql immutable as $$
  select array[
    'food', 'history', 'nightlife', 'museums', 'architecture', 'hiking',
    'beaches', 'day_trips', 'festivals', 'sports_events', 'art', 'live_music',
    'markets', 'photography'
  ]::text[];
$$;

create or replace function public.wn_personal_interests()
returns text[] language sql immutable as $$
  select array[
    'fitness', 'running', 'soccer', 'basketball', 'wrestling', 'cooking',
    'coffee', 'finance', 'tech', 'reading', 'film', 'music', 'gaming',
    'fashion', 'theater', 'volunteering'
  ]::text[];
$$;

-- The profile fields a person can show or hide. Name and username are not in
-- this list: they're the identity, governed by the access level itself.
create or replace function public.wn_profile_fields()
returns text[] language sql immutable as $$
  select array[
    'photo', 'bio', 'gender', 'host_city', 'host_university', 'program',
    'home_university', 'grad_year', 'abroad_dates', 'languages',
    'budget_level', 'travel_interests', 'personal_interests', 'custom_details'
  ]::text[];
$$;

create or replace function public.wn_reserved_usernames()
returns text[] language sql immutable as $$
  select array[
    'admin', 'administrator', 'root', 'support', 'help', 'wherenext',
    'semesterly', 'moderator', 'mod', 'staff', 'team', 'official', 'system',
    'null', 'undefined', 'me', 'settings', 'profile', 'login', 'welcome',
    'privacy', 'api', 'u'
  ]::text[];
$$;

-- 3-30 chars: lowercase letters, digits, '.', '_'; can't start or end with a
-- period; no two periods in a row. The app's USERNAME_SHAPE must match.
create or replace function public.wn_username_ok(p text)
returns boolean language sql immutable as $$
  select p is not null
    and p ~ '^[a-z0-9_][a-z0-9._]{1,28}[a-z0-9_]$'
    and p !~ '\.\.'
    and not (p = any(public.wn_reserved_usernames()));
$$;

-- Every element non-blank and at most max_len characters, at most max_count
-- elements, no duplicates.
create or replace function public.wn_text_array_ok(p text[], max_count int, max_len int)
returns boolean language sql immutable as $$
  select p is not null
    and coalesce(cardinality(p), 0) <= max_count
    and not exists (
      select 1 from unnest(p) x
      where x is null or char_length(btrim(x)) = 0 or char_length(x) > max_len
    )
    and (select count(distinct x) from unnest(p) x) = coalesce(cardinality(p), 0);
$$;

-- "Your own details": a JSON array of at most 5 {label, value} objects,
-- label <= 30 characters, value <= 80, both non-blank, nothing else.
create or replace function public.wn_custom_details_ok(p jsonb)
returns boolean language sql immutable as $$
  select p is not null
    and jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 5
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or (select count(*) from jsonb_object_keys(e)) <> 2
         or jsonb_typeof(e -> 'label') is distinct from 'string'
         or jsonb_typeof(e -> 'value') is distinct from 'string'
         or char_length(btrim(e ->> 'label')) not between 1 and 30
         or char_length(btrim(e ->> 'value')) not between 1 and 80
    );
$$;

-- ---------------------------------------------------------------------------
-- public_profiles
-- ---------------------------------------------------------------------------

create table if not exists public.public_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  -- null until the first change after creation, so a typo can be fixed right
  -- away; after that, at most one change per 30 days (trigger below).
  username_changed_at timestamptz,
  display_name text not null,
  avatar_path text,
  bio text not null default '',
  gender text,
  gender_custom text,
  host_city text,
  host_country text,
  host_university text,
  program text,
  home_university text,
  grad_year int,
  abroad_start date,
  abroad_end date,
  languages text[] not null default '{}',
  budget_level text,
  travel_interests text[] not null default '{}',
  personal_interests text[] not null default '{}',
  custom_details jsonb not null default '[]'::jsonb,
  -- 18+ only. Not null: no confirmation, no profile. Stamped server-side by
  -- the trigger, never trusted from the client's clock.
  adult_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint public_profiles_username_ok check (public.wn_username_ok(username)),
  constraint public_profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 60),
  constraint public_profiles_bio_len check (char_length(bio) <= 160),
  constraint public_profiles_gender check (
    gender is null or gender in ('man', 'woman', 'non_binary', 'self_describe', 'prefer_not')
  ),
  constraint public_profiles_gender_custom check (
    gender_custom is null
    or (gender = 'self_describe' and char_length(btrim(gender_custom)) between 1 and 40)
  ),
  constraint public_profiles_text_lens check (
    coalesce(char_length(host_city), 0) <= 100
    and coalesce(char_length(host_country), 0) <= 100
    and coalesce(char_length(host_university), 0) <= 120
    and coalesce(char_length(program), 0) <= 120
    and coalesce(char_length(home_university), 0) <= 120
  ),
  constraint public_profiles_grad_year check (grad_year is null or grad_year between 1990 and 2100),
  constraint public_profiles_abroad_dates check (
    abroad_start is null or abroad_end is null or abroad_end >= abroad_start
  ),
  constraint public_profiles_languages check (public.wn_text_array_ok(languages, 10, 40)),
  constraint public_profiles_budget check (
    budget_level is null or budget_level in ('shoestring', 'moderate', 'comfortable')
  ),
  constraint public_profiles_travel_interests check (
    public.wn_text_array_ok(travel_interests, 20, 40)
    and travel_interests <@ public.wn_travel_interests()
  ),
  constraint public_profiles_personal_interests check (
    public.wn_text_array_ok(personal_interests, 20, 40)
    and personal_interests <@ public.wn_personal_interests()
  ),
  constraint public_profiles_custom_details check (public.wn_custom_details_ok(custom_details)),
  -- Your avatar lives in your own Storage folder, nobody else's.
  constraint public_profiles_avatar_path check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[a-z0-9-]{1,40}\.(jpg|png|webp)$')
  )
);

create unique index if not exists public_profiles_username_key on public.public_profiles (username);
create index if not exists public_profiles_host_city_idx on public.public_profiles (lower(host_city));

-- Server-side stamps and the 30-day username rule.
create or replace function public.wn_public_profiles_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.username_changed_at := null;
    new.created_at := now();
    if new.adult_confirmed_at is not null then
      new.adult_confirmed_at := now();
    end if;
    return new;
  end if;

  -- UPDATE: identity and the age confirmation can't be rewritten.
  new.id := old.id;
  new.created_at := old.created_at;
  new.adult_confirmed_at := old.adult_confirmed_at;

  if new.username is distinct from old.username then
    if old.username_changed_at is not null
       and old.username_changed_at > now() - interval '30 days' then
      raise exception 'WN_USERNAME_CHANGE_TOO_SOON: usernames can be changed once every 30 days'
        using errcode = 'P0001';
    end if;
    new.username_changed_at := now();
  else
    new.username_changed_at := old.username_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists wn_public_profiles_before_write on public.public_profiles;
create trigger wn_public_profiles_before_write
  before insert or update on public.public_profiles
  for each row execute function public.wn_public_profiles_before_write();

alter table public.public_profiles enable row level security;

drop policy if exists "Owner can read own public profile" on public.public_profiles;
create policy "Owner can read own public profile"
  on public.public_profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Owner can create own public profile" on public.public_profiles;
create policy "Owner can create own public profile"
  on public.public_profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Owner can update own public profile" on public.public_profiles;
create policy "Owner can update own public profile"
  on public.public_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- social_settings: privacy + notification choices. Own row only.
-- ---------------------------------------------------------------------------

create table if not exists public.social_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  visible_fields text[] not null default '{}',
  audience text not null default 'friends',
  discoverable boolean not null default false,
  suggest_in_host_city boolean not null default false,
  suggest_at_host_university boolean not null default false,
  show_mutual_friends boolean not null default false,
  allow_message_requests boolean not null default false,
  read_receipts boolean not null default false,
  show_active_status boolean not null default false,
  share_free_weekends boolean not null default false,
  show_trips boolean not null default false,
  notify_messages boolean not null default true,
  notify_friend_requests boolean not null default true,
  notify_votes boolean not null default true,
  notify_costs boolean not null default true,
  updated_at timestamptz not null default now(),

  constraint social_settings_audience check (audience in ('friends', 'friends_of_friends', 'verified')),
  constraint social_settings_visible_fields check (
    public.wn_text_array_ok(visible_fields, 20, 40)
    and visible_fields <@ public.wn_profile_fields()
  )
);

alter table public.social_settings enable row level security;

drop policy if exists "Owner can read own social settings" on public.social_settings;
create policy "Owner can read own social settings"
  on public.social_settings for select to authenticated
  using (id = auth.uid());

drop policy if exists "Owner can create own social settings" on public.social_settings;
create policy "Owner can create own social settings"
  on public.social_settings for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Owner can update own social settings" on public.social_settings;
create policy "Owner can update own social settings"
  on public.social_settings for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Access level. THE function Phase 27 replaces: it will add 'friend',
-- 'friend_of_friend' and 'blocked'. Everything else below is written against
-- these level names already, so that replacement is the whole change.
--
-- security definer + pinned search_path (it will need to read friendships and
-- blocks the caller can't see directly). auth.uid() still resolves to the
-- caller inside a definer function, so it can't be used to impersonate.
-- ---------------------------------------------------------------------------

create or replace function public.wn_viewer_access(p_target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or p_target is null then 'none'
    when auth.uid() = p_target then 'self'
    else 'stranger'
  end;
$$;

-- Which profile fields the caller may see for p_target. Empty array = only
-- what the identity rule allows (or nothing at all, see wn_can_see_identity).
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
     or (acc = 'stranger' and s.audience = 'verified') then
    return s.visible_fields;
  end if;
  return '{}';
end;
$$;

-- Name and username. Friends always; anyone else only if the person turned on
-- "Appear in search". (Phase 28 adds "people you share a chat or group with".)
create or replace function public.wn_can_see_identity(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.wn_viewer_access(p_target)
    when 'self' then true
    when 'friend' then true
    when 'friend_of_friend' then coalesce((select discoverable from public.social_settings where id = p_target), false)
    when 'stranger' then coalesce((select discoverable from public.social_settings where id = p_target), false)
    else false
  end;
$$;

-- The one place a profile is turned into what a given viewer may see. Not
-- granted to anyone: get_public_profile (and Phase 27's search) call it.
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
    'access', public.wn_viewer_access(p_target)
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

create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.wn_profile_json(id)
  from public.public_profiles
  where username = lower(btrim(p_username))
  limit 1;
$$;

-- Live "is this username free?" check for the profile form. True also when
-- the name is already yours.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.wn_username_ok(lower(btrim(p_username)))
    and not exists (
      select 1 from public.public_profiles
      where username = lower(btrim(p_username))
        and id is distinct from auth.uid()
    );
$$;

-- Avatar read check for the Storage policy below. Takes the folder name as
-- text so a malformed object name returns false instead of a cast error.
create or replace function public.wn_can_see_avatar(p_owner text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null
     or p_owner !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.wn_can_see_identity(p_owner::uuid)
    and 'photo' = any(public.wn_visible_fields_for(p_owner::uuid));
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase's anon role
-- inherits it -- revoke first, then grant (same reasoning as 0009).
revoke execute on function public.wn_viewer_access(uuid) from public, anon;
revoke execute on function public.wn_visible_fields_for(uuid) from public, anon;
revoke execute on function public.wn_can_see_identity(uuid) from public, anon;
revoke execute on function public.wn_profile_json(uuid) from public, anon, authenticated;
revoke execute on function public.get_public_profile(text) from public, anon;
revoke execute on function public.username_available(text) from public, anon;
revoke execute on function public.wn_can_see_avatar(text) from public, anon;

grant execute on function public.wn_viewer_access(uuid) to authenticated;
grant execute on function public.wn_visible_fields_for(uuid) to authenticated;
grant execute on function public.wn_can_see_identity(uuid) to authenticated;
grant execute on function public.get_public_profile(text) to authenticated;
grant execute on function public.username_available(text) to authenticated;
-- The Storage read policy runs as the requesting user.
grant execute on function public.wn_can_see_avatar(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars: a PRIVATE bucket (the photo can be hidden, so no public URLs).
-- 2 MB cap, jpeg/png/webp only; the app resizes to 512px before uploading.
-- Path: <user id>/<name>.<ext>. The app downloads with the user's session and
-- shows a blob: URL, so the CSP doesn't need a new img-src entry.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar owner can upload" on storage.objects;
create policy "Avatar owner can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owner can replace" on storage.objects;
create policy "Avatar owner can replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owner can delete" on storage.objects;
create policy "Avatar owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar visible to allowed viewers" on storage.objects;
create policy "Avatar visible to allowed viewers"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.wn_can_see_avatar((storage.foldername(name))[1]));

-- Undo (if ever needed), in this order:
--   drop policy "Avatar visible to allowed viewers" on storage.objects; (and the 3 owner policies)
--   drop table public.social_settings; drop table public.public_profiles;
--   drop function public.get_public_profile(text), public.username_available(text),
--     public.wn_profile_json(uuid), public.wn_can_see_avatar(text),
--     public.wn_can_see_identity(uuid), public.wn_visible_fields_for(uuid),
--     public.wn_viewer_access(uuid), public.wn_public_profiles_before_write();
--   (the wn_* list/validation functions can stay; they're inert.)
