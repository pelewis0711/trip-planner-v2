-- Phase 28: private messaging. Apply after 0015. Re-runnable.
begin;
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('dm','group','weekend')),
 title text not null default '' check(char_length(title)<=100), group_id uuid,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),last_message_at timestamptz,
 dm_low uuid references auth.users(id) on delete cascade,dm_high uuid references auth.users(id) on delete cascade,
 check((kind='dm' and dm_low is not null and dm_high is not null and dm_low<dm_high) or (kind<>'dm' and dm_low is null and dm_high is null))
);
create unique index if not exists one_dm_per_pair on public.conversations(dm_low,dm_high) where kind='dm';
create table if not exists public.conversation_members (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'member' check(role in ('admin','member')),
 joined_at timestamptz not null default now(),last_read_at timestamptz,accepted boolean not null default false,muted boolean not null default false,
 left_at timestamptz, primary key(conversation_id,user_id)
);
create index if not exists member_inbox on public.conversation_members(user_id,conversation_id);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('text','photo','trip_card','poll','system')),
 body text not null default '' check(char_length(body)<=2000),payload jsonb not null default '{}',
 created_at timestamptz not null default now(),edited_at timestamptz,deleted_at timestamptz
);
create index if not exists message_history on public.messages(conversation_id,created_at desc,id);
create index if not exists message_rate_window on public.messages(sender_id,created_at desc);
create table if not exists public.message_reactions (
 message_id uuid not null references public.messages(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(emoji in ('👍','❤️','😂','😮','😢','🎉')),active boolean not null default true,
 primary key(message_id,user_id,emoji)
);
create table if not exists public.poll_votes (
 message_id uuid not null references public.messages(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 option_index integer not null check(option_index between 0 and 5),primary key(message_id,user_id)
);
create table if not exists public.chat_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,last_active_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.poll_votes enable row level security;
alter table public.chat_presence enable row level security;
revoke all on public.conversations,public.conversation_members,public.messages,public.message_reactions,public.poll_votes,public.chat_presence from public,anon,authenticated;
grant select on public.conversations,public.messages,public.message_reactions,public.poll_votes to authenticated;
-- Never expose read timestamps, acceptance, muted or leave state through table
-- reads or Realtime. Those are returned only through privacy-aware RPCs.
grant select(conversation_id,user_id,role,joined_at) on public.conversation_members to authenticated;

create or replace function public.wn_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.conversation_members m join public.conversations c on c.id=m.conversation_id
 where m.conversation_id=p_chat and m.user_id=auth.uid() and m.left_at is null
 and (c.kind<>'dm' or not exists(select 1 from public.blocks b where
 (b.blocker=c.dm_low and b.blocked=c.dm_high) or (b.blocker=c.dm_high and b.blocked=c.dm_low))));
$$;
create or replace function public.wn_chat_can_send(p_chat uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.wn_chat_member(p_chat) and exists(select 1 from public.conversation_members where conversation_id=p_chat and user_id=auth.uid() and accepted);
$$;
revoke execute on function public.wn_chat_member(uuid),public.wn_chat_can_send(uuid) from public,anon;
grant execute on function public.wn_chat_member(uuid),public.wn_chat_can_send(uuid) to authenticated;
drop policy if exists chat_members_read on public.conversations;
create policy chat_members_read on public.conversations for select to authenticated using(public.wn_chat_member(id));
drop policy if exists chat_member_list on public.conversation_members;
create policy chat_member_list on public.conversation_members for select to authenticated using(public.wn_chat_member(conversation_id));
drop policy if exists chat_messages_read on public.messages;
create policy chat_messages_read on public.messages for select to authenticated using(public.wn_chat_member(conversation_id));
drop policy if exists chat_reactions_read on public.message_reactions;
create policy chat_reactions_read on public.message_reactions for select to authenticated using(exists(select 1 from public.messages where id=message_id and public.wn_chat_member(conversation_id)));
drop policy if exists chat_votes_read on public.poll_votes;
create policy chat_votes_read on public.poll_votes for select to authenticated using(exists(select 1 from public.messages where id=message_id and public.wn_chat_member(conversation_id)));

create or replace function public.start_dm(p_other uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid; friends boolean;
begin
 perform public.wn_lock_social_pair(p_other);
 if public.wn_viewer_access(p_other)='blocked' or not public.wn_can_see_identity(p_other)
 or not exists(select 1 from public.public_profiles where id=auth.uid()) then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
 friends:=public.wn_viewer_access(p_other)='friend';
 select id into cid from public.conversations where kind='dm' and dm_low=least(auth.uid(),p_other) and dm_high=greatest(auth.uid(),p_other);
 if cid is not null then
   update public.conversation_members set left_at=null where conversation_id=cid and user_id=auth.uid();
   return cid; -- never re-open a recipient's deleted request
 end if;
 if not friends and not exists(select 1 from public.social_settings where id=p_other and allow_message_requests) then raise exception 'WN_MESSAGE_REQUESTS_OFF'; end if;
 insert into public.conversations(kind,created_by,dm_low,dm_high) values('dm',auth.uid(),least(auth.uid(),p_other),greatest(auth.uid(),p_other)) returning id into cid;
 insert into public.conversation_members(conversation_id,user_id,accepted) values(cid,auth.uid(),true),(cid,p_other,friends);
 return cid;
end; $$;

-- All client message writes go through this locked transaction. Deleting a
-- message cannot evade the rate limit: soft-deleted rows still count.
create or replace function public.send_message(p_chat uuid,p_kind text,p_body text default '',p_payload jsonb default '{}',p_expected_user uuid default auth.uid()) returns uuid
language plpgsql security definer set search_path=public as $$
declare c public.conversations; mid uuid; n int; token text;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise exception 'WN_AUTH_REQUIRED'; end if;
 select * into c from public.conversations where id=p_chat;
 if c.kind='dm' then perform public.wn_lock_social_pair(case when c.dm_low=auth.uid() then c.dm_high else c.dm_low end); end if;
 if not public.wn_chat_can_send(p_chat) then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('message-rate:'||auth.uid()::text,0));
 if (select count(*) from public.messages where sender_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'WN_MESSAGE_RATE_LIMIT'; end if;
 if p_body is null or char_length(p_body)>2000 or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'WN_INVALID_MESSAGE'; end if;
 if p_kind='text' then
   if char_length(btrim(p_body))=0 then raise exception 'WN_EMPTY_MESSAGE'; end if; p_payload:='{}';
 elsif p_kind='photo' then
   if coalesce(p_payload->>'path','') !~ ('^'||p_chat::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
   or not exists(select 1 from storage.objects where bucket_id='chat-photos' and name=p_payload->>'path') then raise exception 'WN_INVALID_PHOTO'; end if;
   p_payload:=jsonb_build_object('path',p_payload->>'path');
 elsif p_kind='poll' then
   if jsonb_typeof(p_payload->'options') is distinct from 'array' then raise exception 'WN_INVALID_POLL'; end if;
   n:=jsonb_array_length(p_payload->'options');
   if n not between 2 and 6 or char_length(btrim(p_body))=0 or exists(select 1 from jsonb_array_elements(p_payload->'options') x where jsonb_typeof(x)<>'string' or char_length(btrim(x#>>'{}')) not between 1 and 100)
     or (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(p_payload->'options') x)<>n then raise exception 'WN_INVALID_POLL'; end if;
   p_payload:=jsonb_build_object('options',p_payload->'options');
 elsif p_kind='trip_card' then
   token:=p_payload->>'share_token';
   if not exists(select 1 from public.plans where share_view_token=token and (user_id=auth.uid() or auth.uid()=any(collaborator_ids)))
     or coalesce(p_payload->>'slot_id','') !~ '^[a-zA-Z0-9_-]{1,100}$' or char_length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 120 then raise exception 'WN_INVALID_TRIP_CARD'; end if;
   p_payload:=jsonb_build_object('share_token',token,'slot_id',p_payload->>'slot_id','title',p_payload->>'title');
 else raise exception 'WN_INVALID_MESSAGE_KIND'; end if;
 insert into public.messages(conversation_id,sender_id,kind,body,payload) values(p_chat,auth.uid(),p_kind,p_body,p_payload) returning id into mid;
 update public.conversations set last_message_at=clock_timestamp() where id=p_chat;
 return mid;
end; $$;

create or replace function public.edit_message(p_message uuid,p_body text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'WN_INVALID_MESSAGE'; end if;
 update public.messages set body=p_body,edited_at=now() where id=p_message and sender_id=auth.uid() and kind='text' and deleted_at is null and public.wn_chat_can_send(conversation_id);
 if not found then raise exception 'WN_MESSAGE_UNAVAILABLE'; end if;
end; $$;
create or replace function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m public.messages;
begin
 select * into m from public.messages where id=p_message and sender_id=auth.uid() and deleted_at is null and public.wn_chat_can_send(conversation_id) for update;
 if not found then raise exception 'WN_MESSAGE_UNAVAILABLE'; end if;
 if m.kind='photo' then insert into public.storage_cleanup_queue(bucket,path,reason) values('chat-photos',m.payload->>'path','message deleted'); end if;
 update public.messages set body='',payload='{}',deleted_at=now() where id=p_message;
end; $$;
create or replace function public.chat_request(p_chat uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$
declare other_user uuid;
begin
 if not public.wn_chat_member(p_chat) then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
 if not exists(select 1 from public.conversation_members where conversation_id=p_chat and user_id=auth.uid() and not accepted) then raise exception 'WN_NOT_A_REQUEST'; end if;
 if p_action='accept' then update public.conversation_members set accepted=true,last_read_at=now() where conversation_id=p_chat and user_id=auth.uid();
 elsif p_action in ('delete','block') then
   if p_action='block' then
     select case when dm_low=auth.uid() then dm_high else dm_low end into other_user from public.conversations where id=p_chat and kind='dm';
     if other_user is null then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
     perform public.block_person(other_user);
   end if;
   update public.conversation_members set left_at=now() where conversation_id=p_chat and user_id=auth.uid();
 else raise exception 'WN_INVALID_REQUEST_ACTION'; end if;
end; $$;
create or replace function public.mark_chat_read(p_chat uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_chat_member(p_chat) then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
 update public.conversation_members set last_read_at=now() where conversation_id=p_chat and user_id=auth.uid();
end; $$;
create or replace function public.mute_chat(p_chat uuid,p_muted boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.wn_chat_member(p_chat) or p_muted is null then raise exception 'WN_CHAT_UNAVAILABLE'; end if;
 update public.conversation_members set muted=p_muted where conversation_id=p_chat and user_id=auth.uid();
end; $$;
create or replace function public.chat_heartbeat() returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'WN_AUTH_REQUIRED'; end if;
 insert into public.chat_presence(user_id,last_active_at) values(auth.uid(),now()) on conflict(user_id) do update set last_active_at=excluded.last_active_at;
end; $$;
create or replace function public.react_to_message(p_message uuid,p_emoji text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_emoji not in ('👍','❤️','😂','😮','😢','🎉') or p_emoji is null or not exists(select 1 from public.messages where id=p_message and deleted_at is null and public.wn_chat_can_send(conversation_id)) then raise exception 'WN_INVALID_REACTION'; end if;
 insert into public.message_reactions(message_id,user_id,emoji) values(p_message,auth.uid(),p_emoji)
 on conflict(message_id,user_id,emoji) do update set active=not public.message_reactions.active;
end; $$;
create or replace function public.vote_message_poll(p_message uuid,p_option integer) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_option is null or p_option<0 or not exists(select 1 from public.messages where id=p_message and kind='poll' and deleted_at is null and public.wn_chat_can_send(conversation_id) and p_option<jsonb_array_length(payload->'options')) then raise exception 'WN_INVALID_POLL_VOTE'; end if;
 insert into public.poll_votes(message_id,user_id,option_index) values(p_message,auth.uid(),p_option) on conflict(message_id,user_id) do update set option_index=excluded.option_index;
end; $$;

-- Privacy-aware metadata. last_read_at is unavailable through raw tables,
-- and suppressed for Requests even if both people enabled read receipts.
create or replace function public.wn_chat_summary(p_chat uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.conversations; me public.conversation_members; other_user uuid; other_member public.conversation_members; p jsonb; seen timestamptz; active_now boolean:=false; last_msg public.messages;
begin
 if not public.wn_chat_member(p_chat) then return null; end if;
 select * into c from public.conversations where id=p_chat;
 select * into me from public.conversation_members where conversation_id=p_chat and user_id=auth.uid();
 select * into other_member from public.conversation_members where conversation_id=p_chat and user_id<>auth.uid() limit 1;
 other_user:=other_member.user_id; p:=public.wn_profile_json(other_user);
 if me.accepted and other_member.accepted and other_member.left_at is null then
   if exists(select 1 from public.social_settings where id=auth.uid() and read_receipts) and exists(select 1 from public.social_settings where id=other_user and read_receipts) then seen:=other_member.last_read_at; end if;
   if exists(select 1 from public.social_settings where id=other_user and show_active_status) then
     select coalesce(last_active_at>now()-interval '2 minutes',false) into active_now from public.chat_presence where user_id=other_user;
   end if;
 end if;
 select * into last_msg from public.messages where conversation_id=p_chat order by created_at desc,id desc limit 1;
 return jsonb_build_object('id',c.id,'kind',c.kind,'title',c.title,'person',p,'accepted',me.accepted,'muted',me.muted,'last_message_at',c.last_message_at,
 'last_message',case when last_msg.id is null then null else jsonb_build_object('body',case when last_msg.deleted_at is not null then 'Message deleted' else last_msg.body end,'kind',last_msg.kind) end,
 'unread_count',(select count(*) from public.messages where conversation_id=p_chat and sender_id<>auth.uid() and deleted_at is null and created_at>coalesce(me.last_read_at,'-infinity'::timestamptz)),
 'seen_at',seen,'active_now',coalesce(active_now,false));
end; $$;
revoke execute on function public.wn_chat_summary(uuid) from public,anon,authenticated;
create or replace function public.get_chat(p_chat uuid) returns jsonb
language sql stable security definer set search_path=public as $$ select public.wn_chat_summary(p_chat); $$;
create or replace function public.list_chats() returns setof jsonb
language sql stable security definer set search_path=public as $$
 select public.wn_chat_summary(c.id) from public.conversations c join public.conversation_members m on m.conversation_id=c.id
 where m.user_id=auth.uid() and m.left_at is null and public.wn_chat_member(c.id) order by c.last_message_at desc nulls last,c.created_at desc;
$$;
-- Explicit EXECUTE grants for every exposed RPC; helpers remain private.
revoke execute on function public.start_dm(uuid),public.send_message(uuid,text,text,jsonb,uuid),public.edit_message(uuid,text),public.delete_message(uuid),public.chat_request(uuid,text),public.mark_chat_read(uuid),public.mute_chat(uuid,boolean),public.chat_heartbeat(),public.react_to_message(uuid,text),public.vote_message_poll(uuid,integer),public.get_chat(uuid),public.list_chats() from public,anon;
grant execute on function public.start_dm(uuid),public.send_message(uuid,text,text,jsonb,uuid),public.edit_message(uuid,text),public.delete_message(uuid),public.chat_request(uuid,text),public.mark_chat_read(uuid),public.mute_chat(uuid,boolean),public.chat_heartbeat(),public.react_to_message(uuid,text),public.vote_message_poll(uuid,integer),public.get_chat(uuid),public.list_chats() to authenticated;

-- Private photos, no public URL or signed-URL lifetime to leak after blocking.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-photos','chat-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.wn_chat_photo_access(p_path text,p_write boolean default false) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare cid uuid;
begin
 if p_path is null or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then return false; end if;
 cid:=split_part(p_path,'/',1)::uuid;
 return case when p_write then public.wn_chat_can_send(cid) else public.wn_chat_member(cid) end;
end; $$;
revoke execute on function public.wn_chat_photo_access(text,boolean) from public,anon;
grant execute on function public.wn_chat_photo_access(text,boolean) to authenticated;
drop policy if exists chat_photo_read on storage.objects;
create policy chat_photo_read on storage.objects for select to authenticated using(bucket_id='chat-photos' and public.wn_chat_photo_access(name));
drop policy if exists chat_photo_upload on storage.objects;
create policy chat_photo_upload on storage.objects for insert to authenticated with check(bucket_id='chat-photos' and public.wn_chat_photo_access(name,true));
drop policy if exists chat_photo_remove_unused on storage.objects;
create policy chat_photo_remove_unused on storage.objects for delete to authenticated using(bucket_id='chat-photos' and public.wn_chat_photo_access(name,true) and not exists(select 1 from public.messages where kind='photo' and payload->>'path'=name and deleted_at is null));
alter table public.storage_cleanup_queue drop constraint if exists storage_cleanup_queue_bucket;
alter table public.storage_cleanup_queue add constraint storage_cleanup_queue_bucket check(bucket in ('avatars','chat-photos'));
create or replace function public.wn_queue_chat_photos() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.storage_cleanup_queue(bucket,path,reason) values('chat-photos',old.id::text||'/','conversation deleted'); return old;
end; $$;
revoke execute on function public.wn_queue_chat_photos() from public,anon,authenticated;
drop trigger if exists wn_queue_chat_photos on public.conversations;
create trigger wn_queue_chat_photos after delete on public.conversations for each row execute function public.wn_queue_chat_photos();
-- Members/read timestamps/presence are intentionally NOT published.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   foreach t in array array['conversations','messages','message_reactions','poll_votes'] loop
     if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
   end loop;
 end if;
end; $$;
commit;
