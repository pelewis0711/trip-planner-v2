-- Phase 9: two new fields on the existing user_settings row (studying-in-Europe
-- flag, display currency). Run once in the Supabase dashboard's SQL Editor,
-- same as the earlier migrations in this folder.
--
-- Both are additive, not-null-with-default columns, so this is safe to run
-- against existing rows (every current account gets studying_in_europe=true,
-- currency='USD' -- the same values the app already assumed for everyone
-- before this migration existed).

alter table user_settings
  add column if not exists studying_in_europe boolean not null default true,
  add column if not exists currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP'));
