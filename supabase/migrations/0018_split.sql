-- Phase 30: a shared balance sheet, never a payment processor. Re-runnable.
begin;
alter table public.group_trips add column if not exists settle_currency text not null default 'EUR' check(settle_currency in ('USD','EUR','GBP'));
create table if not exists public.trip_expenses (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.group_trips(id) on delete cascade,
 description text not null check(char_length(btrim(description)) between 1 and 80),
 amount numeric(12,2) not null check(amount>0),currency text not null check(currency in ('USD','EUR','GBP')),
 -- Ledger party UUIDs survive leaving/deletion; identities are never copied.
 paid_by uuid not null,created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),version int not null default 1,
 request_key uuid not null default gen_random_uuid(),unique(created_by,request_key)
);
create index if not exists expense_trip on public.trip_expenses(trip_id,created_at);
create table if not exists public.expense_shares (
 expense_id uuid references public.trip_expenses(id) on delete cascade,user_id uuid not null,
 amount numeric(12,2) not null check(amount>=0),primary key(expense_id,user_id)
);
create table if not exists public.settlements (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.group_trips(id) on delete cascade,
 from_user uuid not null,to_user uuid not null,amount numeric(16,2) not null check(amount>0),
 currency text not null check(currency in ('USD','EUR','GBP')),marked_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),undone_at timestamptz,undone_by uuid references auth.users(id) on delete set null,
 check(from_user<>to_user)
);
create index if not exists settlement_trip on public.settlements(trip_id,created_at);

-- Static rate contract mirrors currency.ts; exact integer-cent arithmetic.
create or replace function public.wn_split_rate(p_currency text) returns numeric
language sql immutable security definer set search_path=public as $$
 select case p_currency when 'USD' then 100 when 'EUR' then 92 when 'GBP' then 79 end::numeric;
$$;
create or replace function public.wn_split_cents(p_amount numeric,p_from text,p_to text) returns bigint
language sql immutable security definer set search_path=public as $$
 select round(p_amount*100*public.wn_split_rate(p_to)/public.wn_split_rate(p_from))::bigint;
$$;
-- Deferred constraint covers every final transaction state, including raw
-- privileged SQL and share changes. Trip/expense deletion is a valid cascade.
create or replace function public.wn_expense_sum_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare eid uuid; total numeric; actual numeric;
begin
 eid:=coalesce(to_jsonb(new)->>case when tg_table_name='trip_expenses' then 'id' else 'expense_id' end,to_jsonb(old)->>case when tg_table_name='trip_expenses' then 'id' else 'expense_id' end)::uuid;
 select amount into total from public.trip_expenses where id=eid;
 if found then
  select coalesce(sum(amount),0) into actual from public.expense_shares where expense_id=eid;
  if total<>actual then raise exception 'WN_SHARE_SUM'; end if;
 end if;
 if tg_op='UPDATE' and tg_table_name='expense_shares' and (to_jsonb(old)->>'expense_id') is distinct from (to_jsonb(new)->>'expense_id') then
  select amount into total from public.trip_expenses where id=(to_jsonb(old)->>'expense_id')::uuid;
  if found and total<>(select coalesce(sum(amount),0) from public.expense_shares where expense_id=(to_jsonb(old)->>'expense_id')::uuid) then raise exception 'WN_SHARE_SUM'; end if;
 end if;
 return null;
end; $$;
drop trigger if exists expense_sum on public.trip_expenses;
create constraint trigger expense_sum after insert or update on public.trip_expenses deferrable initially deferred for each row execute function public.wn_expense_sum_guard();
drop trigger if exists share_sum on public.expense_shares;
create constraint trigger share_sum after insert or update or delete on public.expense_shares deferrable initially deferred for each row execute function public.wn_expense_sum_guard();

create or replace function public.wn_split_balances(p_trip uuid) returns table(user_id uuid,cents bigint)
language sql stable security definer set search_path=public as $$
 with costs as (
  select e.*,public.wn_split_cents(e.amount,e.currency,t.settle_currency) as total from public.trip_expenses e join public.group_trips t on t.id=e.trip_id where e.trip_id=p_trip
 ), allocations as (
  select s.user_id,c.id,c.paid_by,floor(c.total*s.amount/c.amount)::bigint as owed from costs c join public.expense_shares s on s.expense_id=c.id
 ), entries as (
  select paid_by as who,total as value from costs
  union all select user_id,-owed from allocations
  -- Conversion remainder goes to the payer, just like an even split remainder.
  union all select c.paid_by,-(c.total-coalesce((select sum(a.owed) from allocations a where a.id=c.id),0))::bigint from costs c
  union all select s.from_user,(s.amount*100)::bigint from public.settlements s where s.trip_id=p_trip and s.undone_at is null
  union all select s.to_user,-(s.amount*100)::bigint from public.settlements s where s.trip_id=p_trip and s.undone_at is null
  union all select r.user_id,0::bigint from public.trip_rsvps r where r.trip_id=p_trip
 ) select who,sum(value)::bigint from entries group by who;
$$;
create or replace function public.wn_split_transfers(p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare balances jsonb; result jsonb:='[]'; debtor text; creditor text; debt bigint; credit bigint; amount bigint;
begin
 select coalesce(jsonb_object_agg(user_id,cents),'{}') into balances from public.wn_split_balances(p_trip);
 loop
  select key,value::bigint into debtor,debt from jsonb_each_text(balances) where value::bigint<0 order by value::bigint,key limit 1;
  exit when debtor is null;
  select key,value::bigint into creditor,credit from jsonb_each_text(balances) where value::bigint>0 order by value::bigint desc,key limit 1;
  exit when creditor is null;
  amount:=least(-debt,credit);
  result:=result||jsonb_build_array(jsonb_build_object('from_user',debtor,'to_user',creditor,'cents',amount));
  balances:=jsonb_set(jsonb_set(balances,array[debtor],to_jsonb(debt+amount)),array[creditor],to_jsonb(credit-amount));
 end loop;
 return result;
end; $$;
create or replace function public.set_split_currency(p_trip uuid,p_currency text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 if exists(select 1 from public.trip_expenses where trip_id=p_trip) or exists(select 1 from public.settlements where trip_id=p_trip) then raise exception 'WN_CURRENCY_LOCKED'; end if;
 update public.group_trips set settle_currency=p_currency where id=p_trip;
end; $$;
create or replace function public.save_trip_expense(p_trip uuid,p_description text,p_amount numeric,p_currency text,p_paid_by uuid,p_users uuid[] default null,p_shares jsonb default null,p_expense uuid default null,p_version int default null,p_request uuid default gen_random_uuid(),p_expected_user uuid default auth.uid()) returns uuid
language plpgsql security definer set search_path=public as $$
declare e public.trip_expenses; eid uuid; uid uuid; people uuid[]; allowed uuid[]; count_people int; cents bigint; each_cent bigint; extra bigint; item jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise exception 'WN_AUTH_REQUIRED'; end if;
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 if p_amount is null or p_amount<=0 or p_amount>=10000000000 or p_amount<>trunc(p_amount,2) or p_currency is null or p_currency not in ('USD','EUR','GBP') or p_paid_by is null then raise exception 'WN_INVALID_COST'; end if;
 if p_expense is not null then
  select * into e from public.trip_expenses where id=p_expense and trip_id=p_trip;
  if not found or (auth.uid() is distinct from e.created_by and auth.uid() is distinct from e.paid_by) then raise exception 'WN_COST_OWNER_REQUIRED'; end if;
  if p_version is distinct from e.version then raise exception 'WN_COST_CHANGED'; end if;
 else
  select id into eid from public.trip_expenses where created_by=auth.uid() and request_key=p_request;
  if found then return eid; end if;
  if (select count(*) from public.trip_expenses where trip_id=p_trip)>=500 then raise exception 'WN_COST_LIMIT'; end if;
 end if;
 select coalesce(array_agg(user_id),'{}') into allowed from (
  select user_id from public.trip_rsvps where trip_id=p_trip
  union select user_id from public.expense_shares where expense_id=p_expense
  union select paid_by from public.trip_expenses where id=p_expense and trip_id=p_trip
 ) x;
 if not(p_paid_by=any(allowed)) then raise exception 'WN_COST_MEMBER_REQUIRED'; end if;
 if p_shares is not null then
  -- Ten selected people plus a former payer holding remainder cents can occur
  -- after membership changes. Editing must preserve that existing allocation.
  if jsonb_typeof(p_shares)<>'array' or jsonb_array_length(p_shares) not between 1 and 11 then raise exception 'WN_INVALID_SHARES'; end if;
  people:='{}';
  for item in select value from jsonb_array_elements(p_shares) loop
   if jsonb_typeof(item)<>'object' or not(item ?& array['user_id','amount']) or jsonb_typeof(item->'amount')<>'number' or (item->>'amount')::numeric<0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric,2) then raise exception 'WN_INVALID_SHARES'; end if;
   uid:=(item->>'user_id')::uuid;
   if uid is null or not(uid=any(allowed)) or uid=any(people) then raise exception 'WN_COST_MEMBER_REQUIRED'; end if;
   people:=array_append(people,uid);
  end loop;
  if (select sum((x->>'amount')::numeric) from jsonb_array_elements(p_shares) x)<>p_amount then raise exception 'WN_SHARE_SUM'; end if;
 else
  people:=p_users;
  if people is null then select array_agg(user_id order by user_id) into people from public.trip_rsvps where trip_id=p_trip and status='going'; end if;
  if coalesce(cardinality(people),0) not between 1 and 10 then raise exception 'WN_SPLIT_PEOPLE_REQUIRED'; end if;
  if exists(select 1 from unnest(people) u where u is null or not(u=any(allowed))) or cardinality(people)<>(select count(distinct u) from unnest(people) u) then raise exception 'WN_COST_MEMBER_REQUIRED'; end if;
 end if;
 if p_expense is null then
  insert into public.trip_expenses(trip_id,description,amount,currency,paid_by,created_by,request_key) values(p_trip,btrim(p_description),p_amount,p_currency,p_paid_by,auth.uid(),p_request) returning id into eid;
 else
  eid:=p_expense;
  update public.trip_expenses set description=btrim(p_description),amount=p_amount,currency=p_currency,paid_by=p_paid_by,version=version+1 where id=eid;
  delete from public.expense_shares where expense_id=eid;
 end if;
 if p_shares is not null then
  insert into public.expense_shares select eid,(x->>'user_id')::uuid,(x->>'amount')::numeric from jsonb_array_elements(p_shares) x;
 else
  cents:=(p_amount*100)::bigint;count_people:=cardinality(people);each_cent:=cents/count_people;extra:=cents-each_cent*count_people;
  insert into public.expense_shares select eid,u,each_cent/100.0 from unnest(people) u;
  if extra>0 then insert into public.expense_shares values(eid,p_paid_by,extra/100.0) on conflict(expense_id,user_id) do update set amount=expense_shares.amount+excluded.amount; end if;
 end if;
 if p_expense is null then
  insert into public.messages(conversation_id,sender_id,kind,body,payload) select conversation_id,null,'system','A cost was added: '||btrim(p_description),jsonb_build_object('event','cost_added','trip_id',p_trip,'expense_id',eid) from public.group_trips where id=p_trip;
  update public.conversations set last_message_at=now() where id=(select conversation_id from public.group_trips where id=p_trip);
 end if;
 return eid;
end; $$;
create or replace function public.delete_trip_expense(p_expense uuid,p_version int) returns void
language plpgsql security definer set search_path=public as $$
declare e public.trip_expenses; tid uuid;
begin
 select trip_id into tid from public.trip_expenses where id=p_expense;
 perform public.wn_lock_trip(tid);
 if not public.wn_trip_member(tid) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 select * into e from public.trip_expenses where id=p_expense;
 if (auth.uid() is distinct from e.created_by and auth.uid() is distinct from e.paid_by) then raise exception 'WN_COST_OWNER_REQUIRED'; end if;
 if p_version is distinct from e.version then raise exception 'WN_COST_CHANGED'; end if;
 delete from public.trip_expenses where id=p_expense;
end; $$;
create or replace function public.mark_trip_settled(p_trip uuid,p_from uuid,p_to uuid,p_amount numeric) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid; curr text;
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 if auth.uid() not in(p_from,p_to) or p_from is null or p_to is null or p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount,2) then raise exception 'WN_SETTLEMENT_PARTY_REQUIRED'; end if;
 if not exists(select 1 from jsonb_array_elements(public.wn_split_transfers(p_trip)) x where x->>'from_user'=p_from::text and x->>'to_user'=p_to::text and (x->>'cents')::bigint=p_amount*100) then raise exception 'WN_BALANCE_CHANGED'; end if;
 select settle_currency into curr from public.group_trips where id=p_trip;
 insert into public.settlements(trip_id,from_user,to_user,amount,currency,marked_by) values(p_trip,p_from,p_to,p_amount,curr,auth.uid()) returning id into sid;
 return sid;
end; $$;
create or replace function public.undo_trip_settlement(p_settlement uuid) returns void
language plpgsql security definer set search_path=public as $$
declare tid uuid; s public.settlements;
begin
 select trip_id into tid from public.settlements where id=p_settlement;
 perform public.wn_lock_trip(tid);
 if not public.wn_trip_member(tid) then raise exception 'WN_TRIP_UNAVAILABLE'; end if;
 select * into s from public.settlements where id=p_settlement;
 if auth.uid() not in(s.from_user,s.to_user) then raise exception 'WN_SETTLEMENT_PARTY_REQUIRED'; end if;
 update public.settlements set undone_at=now(),undone_by=auth.uid() where id=p_settlement and undone_at is null;
end; $$;
create or replace function public.get_trip_split(p_trip uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform public.wn_lock_trip(p_trip);
 if not public.wn_trip_member(p_trip) then return null; end if;
 return (select jsonb_build_object('id',t.id,'title',t.title,'settle_currency',t.settle_currency,
 'my_currency',coalesce((select currency from public.user_settings where id=auth.uid()),'EUR'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'profile',public.wn_profile_json(p.user_id),'status',(select status from public.trip_rsvps where trip_id=p_trip and user_id=p.user_id))) from public.wn_split_balances(p_trip) p),'[]'::jsonb),
 'balances',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from public.wn_split_balances(p_trip) b),'transfers',public.wn_split_transfers(p_trip),
 'expenses',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('shares',(select jsonb_agg(to_jsonb(s)) from public.expense_shares s where expense_id=e.id)) order by e.created_at desc,e.id) from public.trip_expenses e where trip_id=p_trip),'[]'::jsonb),
 'settlements',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from public.settlements s where trip_id=p_trip),'[]'::jsonb)) from public.group_trips t where t.id=p_trip);
end; $$;
do $$ declare tab text; fn record; begin
 foreach tab in array array['trip_expenses','expense_shares','settlements'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
 end loop;
 for fn in select oid::regprocedure as sig,proname from pg_proc where pronamespace='public'::regnamespace and proname=any(array['wn_split_rate','wn_split_cents','wn_expense_sum_guard','wn_split_balances','wn_split_transfers','set_split_currency','save_trip_expense','delete_trip_expense','mark_trip_settled','undo_trip_settlement','get_trip_split']) loop
  execute format('revoke execute on function %s from public,anon,authenticated',fn.sig);
  if fn.proname not like 'wn\_%' escape '\' then execute format('grant execute on function %s to authenticated',fn.sig); end if;
 end loop;
end $$;
commit;
