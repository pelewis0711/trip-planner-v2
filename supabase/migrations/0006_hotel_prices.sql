-- Phase 8: live hotel prices, mirroring 0003_flight_prices.sql's pattern
-- exactly. Run this once in the Supabase SQL Editor.
--
-- Cached globally (not per-user) keyed by city+dates+guests+tier -- hotel
-- prices aren't sensitive or user-specific. Writes only happen through
-- upsert_hotel_price(), never a direct table grant, so a server-only
-- Travelpayouts token stays the only thing that can populate this table.
--
-- NOTE (see CLAUDE.md's Phase 8 section): as of this migration, the
-- intended provider (Travelpayouts/Hotellook cached hotel prices) could not
-- be reached at its documented endpoint, and Travelpayouts' own docs say
-- hotel-data access requires a separate support request beyond standard
-- flight-API registration. This table/RPC are real and ready -- only
-- src/app/api/hotels/price/route.ts's upstream call needs updating once
-- real access/endpoint details are confirmed.

create table if not exists hotel_price_cache (
  city text not null,
  check_in date not null,
  check_out date not null,
  guests int not null,
  tier text not null check (tier in ('private', 'boutique')),
  price numeric,
  currency text not null default 'USD',
  hotel_name text,
  checked_at timestamptz not null default now(),
  primary key (city, check_in, check_out, guests, tier)
);

alter table hotel_price_cache enable row level security;

create policy "Anyone can read cached hotel prices"
  on hotel_price_cache for select
  using (true);

create or replace function public.upsert_hotel_price(
  p_city text,
  p_check_in date,
  p_check_out date,
  p_guests int,
  p_tier text,
  p_price numeric,
  p_currency text,
  p_hotel_name text
)
returns hotel_price_cache
language sql
security definer
set search_path = public
as $$
  insert into hotel_price_cache
    (city, check_in, check_out, guests, tier, price, currency, hotel_name, checked_at)
  values
    (p_city, p_check_in, p_check_out, p_guests, p_tier, p_price, p_currency, p_hotel_name, now())
  on conflict (city, check_in, check_out, guests, tier)
  do update set
    price = excluded.price,
    currency = excluded.currency,
    hotel_name = excluded.hotel_name,
    checked_at = now()
  returning *;
$$;

grant execute on function public.upsert_hotel_price(text, date, date, int, text, numeric, text, text)
  to anon, authenticated;
