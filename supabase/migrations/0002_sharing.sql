-- Phase 2: sharing, collaboration, votes/comments, editable semesters.
-- Run this once in the Supabase dashboard's SQL Editor, same as 0001_plans.sql.

-- ---------------------------------------------------------------------------
-- profiles: a public-readable mirror of auth.users (id, email) so the app can
-- show "shared with you by X" / "last edited by X" without needing direct
-- access to the protected auth.users table.
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Authenticated users can view profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- backfill profiles for anyone who already signed in before this migration
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------------------------------------------------------------------------
-- plans: sharing + collaboration columns
-- ---------------------------------------------------------------------------

alter table plans
  add column if not exists share_view_token text unique,
  add column if not exists share_collab_token text unique,
  add column if not exists collaborator_ids uuid[] not null default '{}',
  add column if not exists last_edited_by uuid references auth.users(id),
  add column if not exists last_edited_at timestamptz;

-- collaborators need to read and edit plan content too, not just the owner
drop policy if exists "Users can view own plans" on plans;
create policy "Owners and collaborators can view plans"
  on plans for select
  using (auth.uid() = user_id or auth.uid() = any(collaborator_ids));

drop policy if exists "Users can update own plans" on plans;
create policy "Owners and collaborators can update plans"
  on plans for update
  using (auth.uid() = user_id or auth.uid() = any(collaborator_ids));

-- insert/delete stay owner-only (unchanged from 0001_plans.sql)

-- ---------------------------------------------------------------------------
-- Sharing control functions. These are the ONLY way share tokens and
-- collaborator_ids ever change -- the app never writes those columns
-- directly -- so a collaborator editing plan content can never rotate a
-- share link or add/remove other collaborators. Each one re-checks
-- ownership itself rather than relying on the (deliberately broader) table
-- RLS policy above.
-- ---------------------------------------------------------------------------

create or replace function public.enable_view_share(p_id text)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from plans where id = p_id and user_id = auth.uid()) then
    raise exception 'Only the plan owner can manage sharing';
  end if;

  return query
  update plans
  set share_view_token = coalesce(share_view_token, replace(gen_random_uuid()::text, '-', ''))
  where id = p_id
  returning *;
end;
$$;

create or replace function public.disable_view_share(p_id text)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from plans where id = p_id and user_id = auth.uid()) then
    raise exception 'Only the plan owner can manage sharing';
  end if;

  return query
  update plans set share_view_token = null where id = p_id
  returning *;
end;
$$;

create or replace function public.enable_collab_share(p_id text)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from plans where id = p_id and user_id = auth.uid()) then
    raise exception 'Only the plan owner can manage sharing';
  end if;

  return query
  update plans
  set share_collab_token = coalesce(share_collab_token, replace(gen_random_uuid()::text, '-', ''))
  where id = p_id
  returning *;
end;
$$;

create or replace function public.disable_collab_share(p_id text)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from plans where id = p_id and user_id = auth.uid()) then
    raise exception 'Only the plan owner can manage sharing';
  end if;

  return query
  update plans set share_collab_token = null, collaborator_ids = '{}' where id = p_id
  returning *;
end;
$$;

grant execute on function public.enable_view_share(text) to authenticated;
grant execute on function public.disable_view_share(text) to authenticated;
grant execute on function public.enable_collab_share(text) to authenticated;
grant execute on function public.disable_collab_share(text) to authenticated;

-- Looks up a plan by either share token. security definer + a narrow return
-- (exactly the one row matching the token you supply) is what makes this
-- safe to expose to anon: knowing the random token is the only way in, same
-- trust model as a Google Docs "anyone with the link" share.
create or replace function public.get_shared_plan(p_token text)
returns setof plans
language sql
security definer
set search_path = public
stable
as $$
  select * from plans
  where share_view_token = p_token or share_collab_token = p_token
  limit 1;
$$;

grant execute on function public.get_shared_plan(text) to anon, authenticated;

-- Joining requires an account (per spec: "collaborate = anyone with the
-- link and an account can edit"), so this one is authenticated-only.
create or replace function public.join_plan_as_collaborator(p_token text)
returns setof plans
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first to join as a collaborator';
  end if;

  return query
  update plans
  set collaborator_ids = case
    when uid = any(collaborator_ids) or uid = user_id then collaborator_ids
    else array_append(collaborator_ids, uid)
  end
  where share_collab_token = p_token
  returning *;
end;
$$;

grant execute on function public.join_plan_as_collaborator(text) to authenticated;

-- Content saves for owners AND collaborators go through this (plain SQL
-- function, security invoker by default) so they're checked against the
-- UPDATE policy above -- and it stamps who/when server-side, which is what
-- powers "last edited by".
create or replace function public.update_plan_data(p_id text, p_name text, p_data jsonb)
returns setof plans
language sql
set search_path = public
as $$
  update plans
  set name = p_name,
      data = p_data,
      updated_at = now(),
      last_edited_by = auth.uid(),
      last_edited_at = now()
  where id = p_id
  returning *;
$$;

grant execute on function public.update_plan_data(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-slot emoji votes and comments -- collaborators only (owner included).
-- ---------------------------------------------------------------------------

create table if not exists plan_votes (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references plans(id) on delete cascade,
  slot_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, slot_id, user_id)
);

alter table plan_votes enable row level security;

create policy "Owners and collaborators can view votes"
  on plan_votes for select
  using (
    exists (
      select 1 from plans p
      where p.id = plan_votes.plan_id
        and (p.user_id = auth.uid() or auth.uid() = any(p.collaborator_ids))
    )
  );

create policy "Owners and collaborators can vote"
  on plan_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from plans p
      where p.id = plan_votes.plan_id
        and (p.user_id = auth.uid() or auth.uid() = any(p.collaborator_ids))
    )
  );

create policy "Users can change own vote"
  on plan_votes for update
  using (auth.uid() = user_id);

create policy "Users can remove own vote"
  on plan_votes for delete
  using (auth.uid() = user_id);

create table if not exists plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references plans(id) on delete cascade,
  slot_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table plan_comments enable row level security;

create policy "Owners and collaborators can view comments"
  on plan_comments for select
  using (
    exists (
      select 1 from plans p
      where p.id = plan_comments.plan_id
        and (p.user_id = auth.uid() or auth.uid() = any(p.collaborator_ids))
    )
  );

create policy "Owners and collaborators can comment"
  on plan_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from plans p
      where p.id = plan_comments.plan_id
        and (p.user_id = auth.uid() or auth.uid() = any(p.collaborator_ids))
    )
  );

create policy "Users can delete own comments"
  on plan_comments for delete
  using (auth.uid() = user_id);
