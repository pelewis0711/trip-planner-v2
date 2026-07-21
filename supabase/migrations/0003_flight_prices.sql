-- Phase 3: live flight prices (Travelpayouts/Aviasales Data API). Run this
-- once in the Supabase SQL Editor, same as 0001/0002.
--
-- Prices are cached globally (not per-user) keyed by route+date -- flight
-- prices aren't sensitive or user-specific, so every visitor benefits from
-- the same 24h-old cache entry instead of each triggering their own
-- external API call. Writes only happen through upsert_flight_price(),
-- never a direct table grant, so the free-tier Travelpayouts token (used
-- server-side only, see src/app/api/flights/price/route.ts) stays the only
-- thing that can populate this table with real data.

create table if not exists flight_price_cache (
  origin text not null,
  destination text not null,
  depart_date date not null,
  price numeric,
  currency text not null default 'USD',
  airline text,
  found_departure_at timestamptz,
  checked_at timestamptz not null default now(),
  primary key (origin, destination, depart_date)
);

alter table flight_price_cache enable row level security;

create policy "Anyone can read cached flight prices"
  on flight_price_cache for select
  using (true);

-- price can be null: a null row still records that we checked (and found
-- nothing) so a repeat visitor doesn't cause a repeat external API call
-- within the same 24h window.
create or replace function public.upsert_flight_price(
  p_origin text,
  p_destination text,
  p_depart_date date,
  p_price numeric,
  p_currency text,
  p_airline text,
  p_found_departure_at timestamptz
)
returns flight_price_cache
language sql
security definer
set search_path = public
as $$
  insert into flight_price_cache
    (origin, destination, depart_date, price, currency, airline, found_departure_at, checked_at)
  values
    (p_origin, p_destination, p_depart_date, p_price, p_currency, p_airline, p_found_departure_at, now())
  on conflict (origin, destination, depart_date)
  do update set
    price = excluded.price,
    currency = excluded.currency,
    airline = excluded.airline,
    found_departure_at = excluded.found_departure_at,
    checked_at = now()
  returning *;
$$;

grant execute on function public.upsert_flight_price(text, text, date, numeric, text, text, timestamptz)
  to anon, authenticated;
