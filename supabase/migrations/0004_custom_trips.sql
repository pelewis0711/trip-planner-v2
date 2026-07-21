-- Phase 5: per-account discovered trips. Run once in the Supabase SQL
-- Editor, same as the earlier migrations.
--
-- Unlike plans, these are never shared/collaborated on -- strictly
-- owner-only, so this is a simple owner-scoped table with no sharing RPCs.
-- Approving a discovered trip is an insert; un-approving is a delete
-- (discovered trips are immutable once approved -- delete and re-approve
-- rather than edit).

create table if not exists custom_trips (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table custom_trips enable row level security;

create policy "Users can view own custom trips"
  on custom_trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own custom trips"
  on custom_trips for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own custom trips"
  on custom_trips for delete
  using (auth.uid() = user_id);
