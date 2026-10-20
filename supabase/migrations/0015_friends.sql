-- Phase 27. Run after 0014; safe to run twice. All social writes use RPCs.
begin;
create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(), accepted_at timestamptz,
  primary key (user_low,user_high), check (user_low < user_high),
  check (requested_by in (user_low,user_high)),
  check ((status='accepted') = (accepted_at is not null))
);
create index if not exists friendships_high_status on public.friendships(user_high,status);
create index if not exists friendships_low_status on public.friendships(user_low,status);
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker,blocked), check(blocker <> blocked)
);
create index if not exists blocks_reverse on public.blocks(blocked,blocker);
create table if not exists public.free_weekends (
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null, end_date date not null,
  primary key(user_id,start_date,end_date),
  check(end_date >= start_date and end_date-start_date <= 6)
);
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.free_weekends enable row level security;
revoke all on public.friendships, public.blocks, public.free_weekends from public, anon, authenticated;
grant select on public.friendships, public.blocks, public.free_weekends to authenticated;
drop policy if exists friendship_participants on public.friendships;
create policy friendship_participants on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_low,user_high));
drop policy if exists own_blocks on public.blocks;
create policy own_blocks on public.blocks for select to authenticated using (blocker=(select auth.uid()));

-- Internal pair lock serializes requests, acceptance and blocking together.
create or replace function public.wn_lock_social_pair(p_other uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or p_other is null or p_other=auth.uid() then raise exception 'WN_INVALID_PERSON'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),p_other)::text || greatest(auth.uid(),p_other)::text,0));
end; $$;
revoke execute on function public.wn_lock_social_pair(uuid) from public,anon,authenticated;

-- Keep 0013/0014's rendering and field visibility functions unchanged.
create or replace function public.wn_viewer_access(p_target uuid) returns text
language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null or p_target is null then 'none'
    when auth.uid()=p_target then 'self'
    when exists(select 1 from public.blocks where (blocker=auth.uid() and blocked=p_target) or (blocked=auth.uid() and blocker=p_target)) then 'blocked'
    when exists(select 1 from public.friendships where user_low=least(auth.uid(),p_target) and user_high=greatest(auth.uid(),p_target) and status='accepted') then 'friend'
    when exists (
      select 1 from public.friendships a join public.friendships b
        on (case when a.user_low=auth.uid() then a.user_high else a.user_low end)
         = (case when b.user_low=p_target then b.user_high else b.user_low end)
      where auth.uid() in (a.user_low,a.user_high) and p_target in (b.user_low,b.user_high)
        and a.status='accepted' and b.status='accepted'
    ) then 'friend_of_friend' else 'stranger' end;
$$;
revoke execute on function public.wn_viewer_access(uuid) from public,anon;
grant execute on function public.wn_viewer_access(uuid) to authenticated;

create or replace function public.wn_mutual_friend_count(p_target uuid) returns integer
language sql stable security definer set search_path=public as $$
  select case when auth.uid() is not null and public.wn_can_see_identity(p_target)
    and exists(select 1 from public.social_settings where id=p_target and show_mutual_friends)
  then (select count(*)::int from public.friendships a join public.friendships b
    on (case when a.user_low=auth.uid() then a.user_high else a.user_low end)
     = (case when b.user_low=p_target then b.user_high else b.user_low end)
    where auth.uid() in (a.user_low,a.user_high) and p_target in (b.user_low,b.user_high)
      and a.status='accepted' and b.status='accepted') else null end;
$$;
revoke execute on function public.wn_mutual_friend_count(uuid) from public,anon;
grant execute on function public.wn_mutual_friend_count(uuid) to authenticated;

create or replace function public.request_friend(p_target uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.wn_lock_social_pair(p_target);
  if not exists(select 1 from public.public_profiles where id=auth.uid()) or not public.wn_can_see_identity(p_target)
    or public.wn_viewer_access(p_target)='blocked' then raise exception 'WN_PERSON_UNAVAILABLE'; end if;
  insert into public.friendships(user_low,user_high,requested_by)
    values(least(auth.uid(),p_target),greatest(auth.uid(),p_target),auth.uid());
exception when unique_violation then raise exception 'WN_REQUEST_EXISTS';
end; $$;
create or replace function public.respond_friend(p_target uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$
declare f public.friendships;
begin
  perform public.wn_lock_social_pair(p_target);
  select * into f from public.friendships where user_low=least(auth.uid(),p_target) and user_high=greatest(auth.uid(),p_target) for update;
  if not found or public.wn_viewer_access(p_target)='blocked' then raise exception 'WN_REQUEST_UNAVAILABLE'; end if;
  if p_action in ('accept','decline') and f.status='pending' and f.requested_by<>auth.uid() then
    if p_action='accept' then
      update public.friendships set status='accepted',accepted_at=now() where user_low=f.user_low and user_high=f.user_high;
    else delete from public.friendships where user_low=f.user_low and user_high=f.user_high; end if;
  elsif (p_action='cancel' and f.status='pending' and f.requested_by=auth.uid()) or (p_action='unfriend' and f.status='accepted') then
    delete from public.friendships where user_low=f.user_low and user_high=f.user_high;
  else raise exception 'WN_INVALID_FRIEND_ACTION'; end if;
end; $$;
create or replace function public.block_person(p_target uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.wn_lock_social_pair(p_target);
  if not exists(select 1 from public.public_profiles where id=p_target) then raise exception 'WN_PERSON_UNAVAILABLE'; end if;
  insert into public.blocks(blocker,blocked) values(auth.uid(),p_target) on conflict do nothing;
  delete from public.friendships where user_low=least(auth.uid(),p_target) and user_high=greatest(auth.uid(),p_target);
end; $$;
create or replace function public.unblock_person(p_target uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.wn_lock_social_pair(p_target);
  delete from public.blocks where blocker=auth.uid() and blocked=p_target;
end; $$;
revoke execute on function public.request_friend(uuid),public.respond_friend(uuid,text),public.block_person(uuid),public.unblock_person(uuid) from public,anon;
grant execute on function public.request_friend(uuid),public.respond_friend(uuid,text),public.block_person(uuid),public.unblock_person(uuid) to authenticated;

create or replace function public.wn_can_read_free(p_target uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (auth.uid()=p_target or
    (public.wn_viewer_access(p_target)='friend' and exists(select 1 from public.social_settings where id=p_target and share_free_weekends)));
$$;
revoke execute on function public.wn_can_read_free(uuid) from public,anon;
grant execute on function public.wn_can_read_free(uuid) to authenticated;
drop policy if exists friends_read_free_weekends on public.free_weekends;
create policy friends_read_free_weekends on public.free_weekends for select to authenticated using (public.wn_can_read_free(user_id));

create or replace function public.sync_free_weekends(p_weekends jsonb,p_user_id uuid default auth.uid()) returns void
language plpgsql security definer set search_path=public as $$
declare sharing boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then raise exception 'WN_AUTH_REQUIRED'; end if;
  -- The same row lock as a privacy update prevents an in-flight sync restoring
  -- dates after the user turns sharing off.
  select share_free_weekends into sharing from public.social_settings where id=auth.uid() for update;
  delete from public.free_weekends where user_id=auth.uid();
  if not coalesce(sharing,false) then return; end if;
  if p_weekends is null or jsonb_typeof(p_weekends)<>'array' then raise exception 'WN_INVALID_WEEKENDS'; end if;
  if jsonb_array_length(p_weekends)>156 then raise exception 'WN_TOO_MANY_WEEKENDS'; end if;
  insert into public.free_weekends(user_id,start_date,end_date)
    select distinct auth.uid(),(e->>'start_date')::date,(e->>'end_date')::date
    from jsonb_array_elements(p_weekends) e;
end; $$;
revoke execute on function public.sync_free_weekends(jsonb,uuid) from public,anon;
grant execute on function public.sync_free_weekends(jsonb,uuid) to authenticated;
create or replace function public.wn_clear_free_weekends() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not new.share_free_weekends then delete from public.free_weekends where user_id=new.id; end if;
  return new;
end; $$;
revoke execute on function public.wn_clear_free_weekends() from public,anon,authenticated;
drop trigger if exists wn_clear_free_weekends on public.social_settings;
create trigger wn_clear_free_weekends after insert or update of share_free_weekends on public.social_settings for each row execute function public.wn_clear_free_weekends();

create or replace function public.wn_friend_status(p_target uuid) returns text
language sql stable security definer set search_path=public as $$
  select case when public.wn_viewer_access(p_target)='blocked' then 'blocked' else coalesce((
    select case when status='accepted' then 'friends' when requested_by=auth.uid() then 'requested' else 'incoming' end
    from public.friendships where user_low=least(auth.uid(),p_target) and user_high=greatest(auth.uid(),p_target)
  ),'none') end;
$$;
revoke execute on function public.wn_friend_status(uuid) from public,anon;
grant execute on function public.wn_friend_status(uuid) to authenticated;

create or replace function public.search_people(p_query text default '',p_filters jsonb default '{}',p_page integer default 0) returns setof jsonb
language sql stable security definer set search_path=public as $$
  select public.wn_profile_json(p.id) || jsonb_build_object('mutual_count',public.wn_mutual_friend_count(p.id),'friendship_status',public.wn_friend_status(p.id))
  from public.public_profiles p left join public.social_settings s on s.id=p.id
  cross join lateral (select public.wn_visible_fields_for(p.id) as fields) v
  where auth.uid() is not null and p.id<>auth.uid() and public.wn_can_see_identity(p.id)
    and (coalesce(s.discoverable,false) or public.wn_viewer_access(p.id)='friend')
    and (starts_with(lower(p.display_name),lower(btrim(coalesce(p_query,''))))
      or starts_with(p.username,ltrim(lower(btrim(coalesce(p_query,''))),'@')))
    and (not(p_filters ? 'host_city') or ('host_city'=any(v.fields) and lower(p.host_city)=lower(p_filters->>'host_city')))
    and (not(p_filters ? 'host_university') or ('host_university'=any(v.fields) and lower(p.host_university)=lower(p_filters->>'host_university')))
    and (not(p_filters ? 'home_university') or ('home_university'=any(v.fields) and lower(p.home_university)=lower(p_filters->>'home_university')))
    and (not(p_filters ? 'interests') or exists(select 1 from jsonb_array_elements_text(p_filters->'interests') i where
      ('travel_interests'=any(v.fields) and i=any(p.travel_interests)) or ('personal_interests'=any(v.fields) and i=any(p.personal_interests))))
    and (not(p_filters ? 'free_weekend') or (public.wn_can_read_free(p.id) and exists(select 1 from public.free_weekends w
      where w.user_id=p.id and (p_filters->>'free_weekend')::date between w.start_date and w.end_date)))
  order by lower(p.display_name),p.username,p.id limit 20 offset (least(greatest(coalesce(p_page,0),0),5000)*20);
$$;
revoke execute on function public.search_people(text,jsonb,integer) from public,anon;
grant execute on function public.search_people(text,jsonb,integer) to authenticated;

create or replace function public.suggest_people() returns setof jsonb
language sql stable security definer set search_path=public as $$
  select public.wn_profile_json(p.id) || jsonb_build_object('mutual_count',public.wn_mutual_friend_count(p.id),'friendship_status',public.wn_friend_status(p.id))
  from public.public_profiles p join public.social_settings s on s.id=p.id
  join public.public_profiles me on me.id=auth.uid()
  cross join lateral (select public.wn_visible_fields_for(p.id) as fields) v
  where auth.uid() is not null and p.id<>auth.uid() and public.wn_can_see_identity(p.id)
    and (s.discoverable or public.wn_viewer_access(p.id)='friend')
    and 'abroad_dates'=any(v.fields) and p.abroad_start<=me.abroad_end and p.abroad_end>=me.abroad_start
    and ((s.suggest_in_host_city and 'host_city'=any(v.fields) and lower(p.host_city)=lower(me.host_city))
      or (s.suggest_at_host_university and 'host_university'=any(v.fields) and lower(p.host_university)=lower(me.host_university)))
  order by lower(p.display_name),p.id limit 20;
$$;
revoke execute on function public.suggest_people() from public,anon;
grant execute on function public.suggest_people() to authenticated;

create or replace function public.list_friendships() returns setof jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',other_id,'profile',public.wn_profile_json(other_id),'friendship_status',public.wn_friend_status(other_id))
  from (select case when user_low=auth.uid() then user_high else user_low end other_id,created_at
    from public.friendships where auth.uid() in (user_low,user_high)) f order by created_at desc;
$$;
revoke execute on function public.list_friendships() from public,anon;
grant execute on function public.list_friendships() to authenticated;

create or replace function public.social_profile_context(p_target uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select case when auth.uid() is null or not public.wn_can_see_identity(p_target) then null else
    jsonb_build_object('friendship_status',public.wn_friend_status(p_target),'mutual_count',public.wn_mutual_friend_count(p_target),
      'free_weekends',coalesce((select jsonb_agg(jsonb_build_object('start_date',start_date,'end_date',end_date) order by start_date)
      from public.free_weekends where user_id=p_target and public.wn_can_read_free(p_target)),'[]'::jsonb)) end;
$$;
revoke execute on function public.social_profile_context(uuid) from public,anon;
grant execute on function public.social_profile_context(uuid) to authenticated;

-- Block management returns only the caller's own block records.
create or replace function public.list_blocked_people() returns setof jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',blocked,'created_at',created_at)
  from public.blocks where blocker=auth.uid() order by created_at desc;
$$;
revoke execute on function public.list_blocked_people() from public,anon;
grant execute on function public.list_blocked_people() to authenticated;
commit;
