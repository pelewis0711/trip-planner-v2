-- Phase 6: study-abroad-anywhere onboarding. Run once in the Supabase
-- dashboard's SQL Editor, same as the earlier migrations in this folder.

-- ---------------------------------------------------------------------------
-- user_settings: one row per account, holding the onboarding answers that
-- seed every new plan's home base + semester dates. Deliberately its OWN
-- table rather than columns on `profiles` -- `profiles` is readable by any
-- authenticated user (needed so "shared by X" / "last edited by X" can show
-- an email), but host university / term / home city are nobody else's
-- business, so this table is locked to the owning user for select AND
-- update, not just update like profiles.
-- ---------------------------------------------------------------------------

create table if not exists user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  home_city text not null,
  home_country text not null,
  home_lat double precision not null,
  home_lon double precision not null,
  host_university text,
  home_university text,
  term text not null check (term in ('fall', 'spring', 'winter')),
  default_semester jsonb not null,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = id);
