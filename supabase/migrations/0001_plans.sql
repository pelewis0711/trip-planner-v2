-- Phase 1: accounts. Run this once in the Supabase dashboard's SQL Editor
-- (Project -> SQL Editor -> New query -> paste -> Run).
--
-- Stores one row per plan, owned by the signed-in user. The plan's own
-- client-generated id (e.g. "p_default") is the primary key so upserts from
-- the client are simple id-based overwrites. `data` holds everything the
-- Zustand Plan type has except id/name (home, bag, budget, placements) --
-- see src/lib/store/plan.ts. activeId/compareIds stay local-only (per-device
-- UI state, not synced).

create table if not exists plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_user_id_idx on plans(user_id);

alter table plans enable row level security;

create policy "Users can view own plans"
  on plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own plans"
  on plans for delete
  using (auth.uid() = user_id);
