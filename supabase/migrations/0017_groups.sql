-- Phase 29: groups and weekends. Apply after 0016; safe to repeat.
begin;
create table if not exists public.groups (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(btrim(name)) between 1 and 100),
 created_by uuid references auth.users(id) on delete set null,
 vote_window text not null default '24h' check(vote_window in ('12h','24h','48h','3d')),
 created_at timestamptz not null default now()
);
create table if not exists public.group_members (
 group_id uuid references public.groups(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in ('admin','member')), muted boolean not null default false, joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create index if not exists group_member_user on public.group_members(user_id,group_id);
create table if not exists public.group_invites (
 token uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null, expires_at timestamptz not null default now()+interval '7 days',
 revoked boolean not null default false
);
create unique index if not exists active_group_invite on public.group_invites(group_id) where not revoked;
alter table public.conversations drop constraint if exists conversations_group_id_fkey;
alter table public.conversations add constraint conversations_group_id_fkey foreign key(group_id) references public.groups(id) on delete cascade;
create unique index if not exists one_general_chat on public.conversations(group_id) where kind='group';
create table if not exists public.group_trips (
 id uuid primary key default gen_random_uuid(), group_id uuid references public.groups(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 100), start_date date not null, end_date date not null,
 stops jsonb not null default '[]', max_per_room int not null default 2 check(max_per_room in (2,3,4)),
 couples_share_bed boolean not null default true, mixed_rooms boolean not null default true,
 conversation_id uuid not null unique references public.conversations(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 check(end_date>=start_date and end_date-start_date<=60)
);
create index if not exists group_trip_group on public.group_trips(group_id);
create table if not exists public.trip_rsvps (
 trip_id uuid references public.group_trips(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,
 status text not null default 'going' check(status in ('going','maybe','out')), primary key(trip_id,user_id)
);
create index if not exists trip_rsvp_user on public.trip_rsvps(user_id,trip_id);
create table if not exists public.lodging_shortlist (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.group_trips(id) on delete cascade,
 url text not null check(url ~ '^https://[^/[:space:]@]+([/:?][^[:space:]]*)?$' and char_length(url)<=2048),
 title text not null check(char_length(btrim(title)) between 1 and 100), nightly_price numeric(12,2) check(nightly_price>0),
 currency text not null default 'EUR' check(currency in ('USD','EUR','GBP')),
 photo_message_id uuid references public.messages(id) on delete set null,
 added_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(), unique(trip_id,id)
);
create table if not exists public.shortlist_votes (
 trip_id uuid references public.group_trips(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,
 listing_id uuid not null, primary key(trip_id,user_id),
 foreign key(trip_id,listing_id) references public.lodging_shortlist(trip_id,id) on delete cascade
);
create table if not exists public.edit_proposals (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.group_trips(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,change jsonb not null,
 status text not null default 'open' check(status in ('open','passed','failed')),
 created_at timestamptz not null default now(),closes_at timestamptz not null
);
create index if not exists trip_proposals on public.edit_proposals(trip_id,created_at);
create index if not exists due_proposals on public.edit_proposals(closes_at) where status='open';
create table if not exists public.proposal_votes (
 proposal_id uuid references public.edit_proposals(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,
 approve boolean not null,primary key(proposal_id,user_id)
);
-- System events survive the author's account deletion; clients cannot create them.
alter table public.messages alter column sender_id drop not null;

create or replace function public.wn_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid());
$$;
create or replace function public.wn_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid() and role='admin');
$$;
-- Existing shared chats become inaccessible to either person after a block.
-- Group settings remain available so they can leave/remove the conflicting member.
create or replace function public.wn_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.conversation_members m where m.conversation_id=p_chat and m.user_id=auth.uid() and m.left_at is null)
 and not exists(select 1 from public.conversation_members m join public.blocks b on
 (b.blocker=auth.uid() and b.blocked=m.user_id) or (b.blocked=auth.uid() and b.blocker=m.user_id)
 where m.conversation_id=p_chat and m.left_at is null);
$$;
create or replace function public.wn_trip_member(p_trip uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.group_trips where id=p_trip and public.wn_chat_member(conversation_id));
$$;
-- Fixed lock order across every trip/member mutation: group first, then trip.
create or replace function public.wn_lock_trip(p_trip uuid) returns void
language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 select group_id into gid from public.group_trips where id=p_trip;
 if gid is not null then perform 1 from public.groups where id=gid for update; end if;
 perform 1 from public.group_trips where id=p_trip for update;
 if not found then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
end; $$;
create or replace function public.wn_validate_trip_change(p_change jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare s jsonb; v jsonb;
begin
 if p_change is null or jsonb_typeof(p_change)<>'object' or p_change='{}' or octet_length(p_change::text)>60000
 or exists(select 1 from jsonb_object_keys(p_change) k where k not in ('start_date','end_date','stops','max_per_room','couples_share_bed','mixed_rooms')) then raise exception 'WN_INVALID_CHANGE'; end if;
 if p_change ? 'start_date' or p_change ? 'end_date' then
  if not(p_change ? 'start_date' and p_change ? 'end_date') or (p_change->>'start_date') !~ '^\d{4}-\d{2}-\d{2}$' or (p_change->>'end_date') !~ '^\d{4}-\d{2}-\d{2}$'
  or (p_change->>'end_date')::date<(p_change->>'start_date')::date or (p_change->>'end_date')::date-(p_change->>'start_date')::date>60 then raise exception 'WN_INVALID_DATES'; end if;
 end if;
 if p_change ? 'max_per_room' and (jsonb_typeof(p_change->'max_per_room')<>'number' or p_change->>'max_per_room' not in ('2','3','4')) then raise exception 'WN_INVALID_ROOMS'; end if;
 foreach v in array array[p_change->'couples_share_bed',p_change->'mixed_rooms'] loop
  if v is not null and jsonb_typeof(v)<>'boolean' then raise exception 'WN_INVALID_ROOMS'; end if;
 end loop;
 if p_change ? 'stops' then
  if jsonb_typeof(p_change->'stops')<>'array' or jsonb_array_length(p_change->'stops')>20 then raise exception 'WN_INVALID_STOPS'; end if;
  for s in select value from jsonb_array_elements(p_change->'stops') loop
   if jsonb_typeof(s)<>'object' or not(s ?& array['tripId','nights','act','sig','l','fd'])
   or exists(select 1 from jsonb_object_keys(s) k where k not in ('tripId','nights','act','sig','l','fd'))
   or jsonb_typeof(s->'tripId')<>'string' or (s->>'tripId') !~ '^[A-Za-z0-9_-]{1,80}$'
   or jsonb_typeof(s->'nights')<>'number' or (s->>'nights') !~ '^([1-9]|[1-5][0-9]|60)$'
   or jsonb_typeof(s->'l')<>'number' or jsonb_typeof(s->'fd')<>'number' or s->>'l' not in ('0','1','2','3') or s->>'fd' not in ('0','1','2')
   or jsonb_typeof(s->'act')<>'array' or jsonb_typeof(s->'sig')<>'array' then raise exception 'WN_INVALID_STOPS'; end if;
   if jsonb_array_length(s->'act')>100 or jsonb_array_length(s->'sig')>100
   or exists(select 1 from jsonb_array_elements(s->'act') x where jsonb_typeof(x)<>'string' or char_length(x#>>'{}')>160)
   or exists(select 1 from jsonb_array_elements(s->'sig') x where jsonb_typeof(x)<>'boolean') then raise exception 'WN_INVALID_STOPS'; end if;
  end loop;
 end if;
 if exists(select 1 from jsonb_each(p_change) e where e.value='null'::jsonb) then raise exception 'WN_INVALID_CHANGE'; end if;
end; $$;
create or replace function public.wn_trip_event(p_trip uuid,p_body text,p_proposal uuid default null) returns void
language sql security definer set search_path=public as $$
 insert into public.messages(conversation_id,sender_id,kind,body,payload)
 select conversation_id,null,'system',p_body,jsonb_build_object('trip_id',id,'proposal_id',p_proposal) from public.group_trips where id=p_trip;
 update public.conversations set last_message_at=now() where id=(select conversation_id from public.group_trips where id=p_trip);
$$;
create or replace function public.wn_resolve_trip(p_trip uuid) returns void
language plpgsql security definer set search_path=public as $$
declare p public.edit_proposals; n int; approvals int; outcome text;
begin
 perform public.wn_lock_trip(p_trip);
 select count(*) into n from public.trip_rsvps where trip_id=p_trip and status='going';
 for p in select * from public.edit_proposals where trip_id=p_trip and status='open' order by created_at,id for update loop
  select count(*) into approvals from public.proposal_votes v join public.trip_rsvps r on r.trip_id=p_trip and r.user_id=v.user_id and r.status='going' where v.proposal_id=p.id and v.approve;
  outcome:=case when p.closes_at<=clock_timestamp() then 'failed' when n>0 and approvals*2>n then 'passed' else 'open' end;
  if outcome='open' then continue; end if;
  if outcome='passed' then
   update public.group_trips set start_date=coalesce((p.change->>'start_date')::date,start_date),end_date=coalesce((p.change->>'end_date')::date,end_date),
    stops=coalesce(p.change->'stops',stops),max_per_room=coalesce((p.change->>'max_per_room')::int,max_per_room),
    couples_share_bed=coalesce((p.change->>'couples_share_bed')::boolean,couples_share_bed),mixed_rooms=coalesce((p.change->>'mixed_rooms')::boolean,mixed_rooms) where id=p_trip;
  end if;
  update public.edit_proposals set status=outcome where id=p.id;
  perform public.wn_trip_event(p_trip,'Suggested edit '||outcome||'.',p.id);
 end loop;
end; $$;
create or replace function public.wn_group_member_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare member_id uuid;
begin
 perform 1 from public.groups where id=new.group_id for update;
 for member_id in select user_id from public.group_members where group_id=new.group_id order by user_id loop
  perform pg_advisory_xact_lock(hashtextextended(least(new.user_id,member_id)::text || greatest(new.user_id,member_id)::text,0));
 end loop;
 if (select count(*) from public.group_members where group_id=new.group_id)>=10 then raise exception 'WN_GROUP_FULL'; end if;
 if exists(select 1 from public.group_members m join public.blocks b on (b.blocker=new.user_id and b.blocked=m.user_id) or (b.blocked=new.user_id and b.blocker=m.user_id) where m.group_id=new.group_id) then raise exception 'WN_GROUP_BLOCKED'; end if;
 return new;
end; $$;
drop trigger if exists group_member_guard on public.group_members;
create trigger group_member_guard before insert on public.group_members for each row execute function public.wn_group_member_guard();
create or replace function public.wn_sync_group_member() returns trigger
language plpgsql security definer set search_path=public as $$
declare gid uuid; tid uuid; successor uuid;
begin
 gid:=case when tg_op='DELETE' then old.group_id else new.group_id end;
 perform 1 from public.groups where id=gid for update;
 if not found then return null; end if;
 if tg_op='DELETE' then
  update public.conversation_members set left_at=now() where user_id=old.user_id and conversation_id in(select id from public.conversations where group_id=gid);
  for tid in select id from public.group_trips where group_id=gid order by id loop
   perform public.wn_lock_trip(tid);
   delete from public.trip_rsvps where trip_id=tid and user_id=old.user_id;
   perform public.wn_resolve_trip(tid);
  end loop;
  if not exists(select 1 from public.group_members where group_id=gid) then
   delete from public.groups where id=gid;
  elsif not exists(select 1 from public.group_members where group_id=gid and role='admin') then
   select user_id into successor from public.group_members where group_id=gid order by joined_at,user_id limit 1;
   update public.group_members set role='admin' where group_id=gid and user_id=successor;
  end if;
 else
  insert into public.conversation_members(conversation_id,user_id,role,accepted,muted)
   select id,new.user_id,new.role,true,new.muted from public.conversations where group_id=gid
   on conflict(conversation_id,user_id) do update set left_at=null,accepted=true,role=excluded.role,muted=excluded.muted;
  for tid in select id from public.group_trips where group_id=gid order by id loop
   perform public.wn_lock_trip(tid);
   insert into public.trip_rsvps(trip_id,user_id) values(tid,new.user_id) on conflict do nothing;
  end loop;
 end if;
 return null;
end; $$;
drop trigger if exists sync_group_member on public.group_members;
create trigger sync_group_member after insert or update or delete on public.group_members for each row execute function public.wn_sync_group_member();
create or replace function public.wn_trip_defaults() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.trip_rsvps(trip_id,user_id) select new.id,user_id from public.conversation_members where conversation_id=new.conversation_id and left_at is null on conflict do nothing;
 return new;
end; $$;
drop trigger if exists trip_default_rsvps on public.group_trips;
create trigger trip_default_rsvps after insert on public.group_trips for each row execute function public.wn_trip_defaults();
create or replace function public.wn_weekend_member_guard() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.left_at is not null then return new; end if;
 if exists(select 1 from public.conversations where id=new.conversation_id and kind<>'dm') then
  perform 1 from public.conversations where id=new.conversation_id for update;
  if (select count(*) from public.conversation_members where conversation_id=new.conversation_id and user_id<>new.user_id and left_at is null)>=10 then raise exception 'WN_GROUP_FULL'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists weekend_member_guard on public.conversation_members;
create trigger weekend_member_guard before insert or update on public.conversation_members for each row execute function public.wn_weekend_member_guard();

create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.public_profiles where id=auth.uid()) then raise exception 'WN_AUTH_REQUIRED'; end if;
 insert into public.groups(name,created_by) values(btrim(p_name),auth.uid()) returning id into gid;
 insert into public.conversations(kind,title,group_id,created_by) values('group','General',gid,auth.uid());
 insert into public.group_members(group_id,user_id,role) values(gid,auth.uid(),'admin');
 return gid;
end; $$;
create or replace function public.update_group(p_group uuid,p_name text,p_window text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.groups where id=p_group for update;
 if not public.wn_group_admin(p_group) then raise exception 'WN_ADMIN_REQUIRED'; end if;
 update public.groups set name=btrim(p_name),vote_window=p_window where id=p_group;
end; $$;
create or replace function public.add_group_friend(p_group uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.groups where id=p_group for update;
 if not public.wn_group_member(p_group) or public.wn_viewer_access(p_user)<>'friend' then raise exception 'WN_FRIEND_REQUIRED'; end if;
 insert into public.group_members(group_id,user_id) values(p_group,p_user);
 if public.wn_viewer_access(p_user)<>'friend' then raise exception 'WN_FRIEND_REQUIRED'; end if;
end; $$;
create or replace function public.group_member_action(p_group uuid,p_user uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.groups where id=p_group for update;
 if not public.wn_group_member(p_group) then raise exception 'WN_GROUP_UNAVAILABLE'; end if;
 if p_action='leave' and p_user=auth.uid() then delete from public.group_members where group_id=p_group and user_id=auth.uid();
 elsif public.wn_group_admin(p_group) and p_action='remove' and p_user<>auth.uid() then delete from public.group_members where group_id=p_group and user_id=p_user;
 elsif public.wn_group_admin(p_group) and p_action='promote' then update public.group_members set role='admin' where group_id=p_group and user_id=p_user;
 else raise exception 'WN_ADMIN_REQUIRED'; end if;
end; $$;
create or replace function public.group_invite_link(p_group uuid,p_reset boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare token_id uuid;
begin
 perform 1 from public.groups where id=p_group for update;
 if not public.wn_group_member(p_group) then raise exception 'WN_GROUP_UNAVAILABLE'; end if;
 update public.group_invites set revoked=true where group_id=p_group and not revoked and (p_reset or expires_at<=now());
 select token into token_id from public.group_invites where group_id=p_group and not revoked;
 if token_id is null then insert into public.group_invites(group_id,created_by) values(p_group,auth.uid()) returning token into token_id; end if;
 return token_id;
end; $$;
create or replace function public.join_group_by_token(p_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.public_profiles where id=auth.uid()) then raise exception 'WN_AUTH_REQUIRED'; end if;
 select group_id into gid from public.group_invites where token=p_token;
 perform 1 from public.groups where id=gid for update;
 if not exists(select 1 from public.group_invites where token=p_token and not revoked and expires_at>clock_timestamp()) then raise exception 'WN_INVITE_EXPIRED'; end if;
 if not public.wn_group_member(gid) then insert into public.group_members(group_id,user_id) values(gid,auth.uid()); end if;
 return gid;
end; $$;
create or replace function public.create_group_trip(p_title text,p_start date,p_end date,p_group uuid default null,p_friends uuid[] default '{}',p_stops jsonb default '[]') returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid; tid uuid; friend_id uuid; pair record;
begin
 if auth.uid() is null or not exists(select 1 from public.public_profiles where id=auth.uid()) then raise exception 'WN_AUTH_REQUIRED'; end if;
 perform public.wn_validate_trip_change(jsonb_build_object('start_date',p_start,'end_date',p_end,'stops',p_stops));
 if p_group is not null then
  perform 1 from public.groups where id=p_group for update;
  if not public.wn_group_member(p_group) then raise exception 'WN_GROUP_UNAVAILABLE'; end if;
 elsif coalesce(cardinality(p_friends),0)>9 then raise exception 'WN_GROUP_FULL'; end if;
 if p_group is null then
  -- Serialize friend/block changes for every pair before checking access.
  -- Canonical ordering also prevents overlapping weekend creations deadlocking.
  for pair in
   with people as (select distinct unnest(array_prepend(auth.uid(),coalesce(p_friends,'{}'::uuid[]))) as id)
   select a.id as first_id,b.id as second_id from people a join people b on a.id<b.id order by a.id,b.id
  loop
   perform pg_advisory_xact_lock(hashtextextended(pair.first_id::text || pair.second_id::text,0));
  end loop;
 end if;
 insert into public.conversations(kind,title,group_id,created_by) values('weekend',p_title,p_group,auth.uid()) returning id into cid;
 if p_group is not null then
  insert into public.conversation_members(conversation_id,user_id,role,accepted,muted) select cid,user_id,role,true,muted from public.group_members where group_id=p_group;
 else
  insert into public.conversation_members(conversation_id,user_id,role,accepted) values(cid,auth.uid(),'admin',true);
  foreach friend_id in array coalesce(p_friends,'{}') loop
   if public.wn_viewer_access(friend_id)<>'friend' then raise exception 'WN_FRIEND_REQUIRED'; end if;
   if exists(select 1 from public.conversation_members m join public.blocks b on (b.blocker=friend_id and b.blocked=m.user_id) or (b.blocked=friend_id and b.blocker=m.user_id) where m.conversation_id=cid) then raise exception 'WN_GROUP_BLOCKED'; end if;
   insert into public.conversation_members(conversation_id,user_id,accepted) values(cid,friend_id,true);
  end loop;
 end if;
 insert into public.group_trips(group_id,title,start_date,end_date,stops,conversation_id,created_by) values(p_group,p_title,p_start,p_end,p_stops,cid,auth.uid()) returning id into tid;
 return tid;
end; $$;
create or replace function public.set_trip_rsvp(p_trip uuid,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 perform public.wn_resolve_trip(p_trip);
 update public.trip_rsvps set status=p_status where trip_id=p_trip and user_id=auth.uid();
 perform public.wn_resolve_trip(p_trip);
end; $$;
create or replace function public.propose_trip_edit(p_trip uuid,p_change jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare pid uuid; duration text;
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) or not exists(select 1 from public.trip_rsvps where trip_id=p_trip and user_id=auth.uid() and status='going') then raise exception 'WN_GOING_REQUIRED'; end if;
 perform public.wn_validate_trip_change(p_change);
 perform public.wn_resolve_trip(p_trip);
 if (select count(*) from public.edit_proposals where trip_id=p_trip and status='open')>=10 then raise exception 'WN_PROPOSAL_LIMIT'; end if;
 select coalesce(g.vote_window,'24h') into duration from public.group_trips t left join public.groups g on g.id=t.group_id where t.id=p_trip;
 insert into public.edit_proposals(trip_id,created_by,change,closes_at) values(p_trip,auth.uid(),p_change,now()+case duration when '12h' then interval '12 hours' when '48h' then interval '48 hours' when '3d' then interval '3 days' else interval '24 hours' end) returning id into pid;
 perform public.wn_trip_event(p_trip,'A suggested edit needs your vote.',pid);
 return pid;
end; $$;
create or replace function public.vote_trip_proposal(p_proposal uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=public as $$
declare tid uuid;
begin
 select trip_id into tid from public.edit_proposals where id=p_proposal;
 perform public.wn_lock_trip(tid);
 if not public.wn_trip_member(tid) or not exists(select 1 from public.trip_rsvps where trip_id=tid and user_id=auth.uid() and status='going') then raise exception 'WN_GOING_REQUIRED'; end if;
 perform public.wn_resolve_trip(tid);
 if not exists(select 1 from public.edit_proposals where id=p_proposal and status='open') then return; end if;
 insert into public.proposal_votes(proposal_id,user_id,approve) values(p_proposal,auth.uid(),p_approve) on conflict(proposal_id,user_id) do update set approve=excluded.approve;
 perform public.wn_resolve_trip(tid);
end; $$;
create or replace function public.resolve_trip_proposals(p_trip uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 perform public.wn_resolve_trip(p_trip);
end; $$;
create or replace function public.resolve_due_trip_proposals() returns int
language plpgsql security definer set search_path=public as $$
declare tid uuid; n int:=0;
begin
 for tid in select distinct trip_id from public.edit_proposals where status='open' and closes_at<=now() order by trip_id limit 500 loop
  perform public.wn_resolve_trip(tid); n:=n+1;
 end loop;
 return n;
end; $$;
create or replace function public.add_lodging_listing(p_trip uuid,p_url text,p_title text,p_price numeric default null,p_currency text default 'EUR',p_photo text default null,p_expected_user uuid default auth.uid()) returns uuid
language plpgsql security definer set search_path=public as $$
declare lid uuid; photo_id uuid; cid uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise exception 'WN_AUTH_REQUIRED'; end if;
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 if (select count(*) from public.lodging_shortlist where trip_id=p_trip)>=50 then raise exception 'WN_SHORTLIST_FULL'; end if;
 if p_photo is not null then
  select conversation_id into cid from public.group_trips where id=p_trip;
  photo_id:=public.send_message(cid,'photo','Lodging: '||btrim(p_title),jsonb_build_object('path',p_photo),p_expected_user);
 end if;
 insert into public.lodging_shortlist(trip_id,url,title,nightly_price,currency,added_by,photo_message_id) values(p_trip,p_url,btrim(p_title),p_price,p_currency,auth.uid(),photo_id) returning id into lid;
 return lid;
end; $$;
create or replace function public.vote_lodging_listing(p_trip uuid,p_listing uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 insert into public.shortlist_votes(trip_id,user_id,listing_id) values(p_trip,auth.uid(),p_listing) on conflict(trip_id,user_id) do update set listing_id=excluded.listing_id;
end; $$;
create or replace function public.mute_group(p_group uuid,p_muted boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_group_member(p_group) then raise exception 'WN_GROUP_UNAVAILABLE'; end if;
 perform 1 from public.groups where id=p_group for update;
 update public.group_members set muted=p_muted where group_id=p_group and user_id=auth.uid();
end; $$;

-- All UI reads use serializers: profile visibility remains governed by 0013/14.
create or replace function public.get_group(p_group uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_group_member(p_group) then return null; end if;
 return (select to_jsonb(g)||jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'profile',public.wn_profile_json(m.user_id)) order by m.joined_at,m.user_id) from public.group_members m where m.group_id=g.id),'[]'::jsonb),
 'chats',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'kind',c.kind,'trip_id',t.id) order by c.created_at) from public.conversations c left join public.group_trips t on t.conversation_id=c.id where c.group_id=g.id),'[]'::jsonb),
 'muted',coalesce((select m.muted from public.group_members m where m.group_id=g.id and m.user_id=auth.uid()),false)) from public.groups g where g.id=p_group);
end; $$;
create or replace function public.list_groups() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.created_at),'[]'::jsonb) from public.groups g join public.group_members m on m.group_id=g.id and m.user_id=auth.uid();
$$;
create or replace function public.get_group_trip(p_trip uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_trip_member(p_trip) then return null; end if;
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then return null; end if;
 perform public.wn_resolve_trip(p_trip);
 return (select to_jsonb(t)||jsonb_build_object(
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'status',r.status,'profile',public.wn_profile_json(r.user_id))) from public.trip_rsvps r where r.trip_id=t.id),'[]'::jsonb),
 'shortlist',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('thumbnail_path',(select payload->>'path' from public.messages where id=l.photo_message_id and deleted_at is null),'votes',(select count(*) from public.shortlist_votes v where v.listing_id=l.id),'my_vote',exists(select 1 from public.shortlist_votes v where v.listing_id=l.id and v.user_id=auth.uid())) order by l.created_at) from public.lodging_shortlist l where l.trip_id=t.id),'[]'::jsonb),
 'proposals',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('approvals',(select count(*) from public.proposal_votes v join public.trip_rsvps r on r.user_id=v.user_id and r.trip_id=t.id and r.status='going' where v.proposal_id=p.id and v.approve),
 'rejections',(select count(*) from public.proposal_votes v join public.trip_rsvps r on r.user_id=v.user_id and r.trip_id=t.id and r.status='going' where v.proposal_id=p.id and not v.approve),
 'my_vote',(select approve from public.proposal_votes where proposal_id=p.id and user_id=auth.uid())) order by p.created_at desc) from public.edit_proposals p where p.trip_id=t.id),'[]'::jsonb)) from public.group_trips t where t.id=p_trip);
end; $$;
create or replace function public.list_group_trips() returns jsonb
language plpgsql security definer set search_path=public as $$
declare tid uuid;
begin
 for tid in select t.id from public.group_trips t join public.trip_rsvps r on r.trip_id=t.id and r.user_id=auth.uid() where public.wn_trip_member(t.id) order by t.id loop perform public.wn_resolve_trip(tid); end loop;
 return (select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('my_status',r.status) order by t.start_date),'[]'::jsonb) from public.group_trips t join public.trip_rsvps r on r.trip_id=t.id and r.user_id=auth.uid() where public.wn_trip_member(t.id));
end; $$;
create or replace function public.get_chat_context(p_chat uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_chat_member(p_chat) then return null; end if;
 return (select jsonb_build_object('group_id',c.group_id,'group_name',g.name,'trip_id',t.id,
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'profile',public.wn_profile_json(m.user_id))) from public.conversation_members m where m.conversation_id=c.id and m.left_at is null),'[]'::jsonb))
 from public.conversations c left join public.groups g on g.id=c.group_id left join public.group_trips t on t.conversation_id=c.id where c.id=p_chat);
end; $$;

create or replace function public.wn_chat_summary(p_chat uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.conversations; me public.conversation_members; other_user uuid; other_member public.conversation_members; p jsonb; seen timestamptz; active_now boolean:=false; last_msg public.messages;
begin
 if not public.wn_chat_member(p_chat) then return null; end if;
 select * into c from public.conversations where id=p_chat;
 select * into me from public.conversation_members where conversation_id=p_chat and user_id=auth.uid();
 select * into other_member from public.conversation_members where conversation_id=p_chat and user_id<>auth.uid() limit 1;
 other_user:=other_member.user_id; p:=public.wn_profile_json(other_user);
 if c.kind='dm' and me.accepted and other_member.accepted and other_member.left_at is null then
   if exists(select 1 from public.social_settings where id=auth.uid() and read_receipts) and exists(select 1 from public.social_settings where id=other_user and read_receipts) then seen:=other_member.last_read_at; end if;
   if exists(select 1 from public.social_settings where id=other_user and show_active_status) then
     select coalesce(last_active_at>now()-interval '2 minutes',false) into active_now from public.chat_presence where user_id=other_user;
   end if;
 end if;
 select * into last_msg from public.messages where conversation_id=p_chat order by created_at desc,id desc limit 1;
 return jsonb_build_object('id',c.id,'kind',c.kind,'title',c.title,'person',case when c.kind='dm' then p else null end,'group_id',c.group_id,'group_name',(select name from public.groups where id=c.group_id),'trip_id',(select id from public.group_trips where conversation_id=c.id),'accepted',me.accepted,'muted',me.muted,'last_message_at',c.last_message_at,
 'last_message',case when last_msg.id is null then null else jsonb_build_object('body',case when last_msg.deleted_at is not null then 'Message deleted' else last_msg.body end,'kind',last_msg.kind) end,
 'unread_count',(select count(*) from public.messages where conversation_id=p_chat and sender_id is distinct from auth.uid() and deleted_at is null and created_at>coalesce(me.last_read_at,'-infinity'::timestamptz)),
 'seen_at',seen,'active_now',coalesce(active_now,false));
end; $$;

create or replace function public.wn_remove_weekend_member(p_trip uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
declare cid uuid; successor uuid;
begin
 perform public.wn_lock_trip(p_trip);
 select conversation_id into cid from public.group_trips where id=p_trip and group_id is null;
 if cid is null then raise exception 'WN_USE_GROUP_SETTINGS'; end if;
 update public.conversation_members set left_at=now() where conversation_id=cid and user_id=p_user;
 delete from public.trip_rsvps where trip_id=p_trip and user_id=p_user;
 perform public.wn_resolve_trip(p_trip);
 if not exists(select 1 from public.conversation_members where conversation_id=cid and left_at is null) then
  delete from public.conversations where id=cid;
 elsif not exists(select 1 from public.conversation_members where conversation_id=cid and left_at is null and role='admin') then
  select user_id into successor from public.conversation_members where conversation_id=cid and left_at is null order by joined_at,user_id limit 1;
  update public.conversation_members set role='admin' where conversation_id=cid and user_id=successor;
 end if;
end; $$;
create or replace function public.leave_weekend(p_trip uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.wn_lock_trip(p_trip);
 if auth.uid() is null or not exists(select 1 from public.trip_rsvps where trip_id=p_trip and user_id=auth.uid()) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 perform public.wn_remove_weekend_member(p_trip,auth.uid());
end; $$;

-- Account cleanup fires on public.profiles, before FK cascades can remove the
-- departing group member without successor election or trip re-evaluation.
create or replace function public.wn_group_account_cleanup() returns trigger
language plpgsql security definer set search_path=public as $$
declare gid uuid; tid uuid;
begin
 for gid in select group_id from public.group_members where user_id=old.id order by group_id loop
  perform 1 from public.groups where id=gid for update;
  delete from public.group_members where group_id=gid and user_id=old.id;
 end loop;
 for tid in select t.id from public.group_trips t join public.trip_rsvps r on r.trip_id=t.id where t.group_id is null and r.user_id=old.id order by t.id loop
  perform public.wn_remove_weekend_member(tid,old.id);
 end loop;
 return old;
end; $$;
drop trigger if exists group_account_cleanup on public.profiles;
create trigger group_account_cleanup before delete on public.profiles for each row execute function public.wn_group_account_cleanup();

-- No direct client data access is needed: authenticated RPCs are the boundary.
do $$ declare tab text; fn record; begin
 foreach tab in array array['groups','group_members','group_invites','group_trips','trip_rsvps','lodging_shortlist','shortlist_votes','edit_proposals','proposal_votes'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
 end loop;
 for fn in select oid::regprocedure as sig,proname from pg_proc where pronamespace='public'::regnamespace and proname=any(array[
 'wn_remove_weekend_member','leave_weekend','wn_group_member','wn_group_admin','wn_trip_member','wn_lock_trip','wn_validate_trip_change','wn_trip_event','wn_resolve_trip','wn_group_member_guard','wn_sync_group_member','wn_trip_defaults','wn_weekend_member_guard','wn_group_account_cleanup',
 'create_group','update_group','add_group_friend','group_member_action','group_invite_link','join_group_by_token','create_group_trip','set_trip_rsvp','propose_trip_edit','vote_trip_proposal','resolve_trip_proposals','resolve_due_trip_proposals','add_lodging_listing','vote_lodging_listing','mute_group','get_group','list_groups','get_group_trip','list_group_trips','get_chat_context']) loop
  execute format('revoke execute on function %s from public,anon,authenticated',fn.sig);
  if fn.proname='resolve_due_trip_proposals' then execute format('grant execute on function %s to service_role',fn.sig);
  elsif fn.proname not like 'wn\_%' escape '\' then execute format('grant execute on function %s to authenticated',fn.sig); end if;
 end loop;
end $$;
commit;
