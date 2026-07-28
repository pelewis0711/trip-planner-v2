-- Pre-launch hardening: stop strangers writing to the shared price caches.
-- Run this once in the Supabase dashboard's SQL Editor, same as the earlier
-- migrations. Safe to run more than once.
--
-- 0003_flight_prices.sql and 0006_hotel_prices.sql each ended with:
--     grant execute on function public.upsert_*_price(...) to anon, authenticated;
--
-- Both files' own comments claim writes are locked to the server-side token
-- ("Writes only happen through upsert_flight_price(), never a direct table
-- grant, so the free-tier token stays the only thing that can populate this
-- table"). The grant contradicted that: the anon key ships in the browser
-- bundle by design, so anyone could read it out of the JS and call these RPCs
-- directly -- writing arbitrary prices into a cache every visitor reads, and
-- burning nothing of their own to do it. Both functions are `security
-- definer`, so the call runs with the definer's rights regardless of who asks.
--
-- After this migration the only writer is the service role, used exclusively
-- by the two server-side route handlers (src/lib/supabase/service.ts).
--
-- READS ARE DELIBERATELY UNTOUCHED. The "Anyone can read cached flight/hotel
-- prices" select policies on both tables stay exactly as they are -- the cache
-- is meant to be globally readable, that part was never the problem.

-- ---------------------------------------------------------------------------
-- `public` is doing real work in these revokes -- it is not redundant.
--
-- Postgres grants EXECUTE on a newly created function to PUBLIC by default,
-- and Supabase's anon/authenticated roles inherit PUBLIC. So revoking from
-- just `anon, authenticated` would leave the function callable anyway through
-- the inherited PUBLIC grant, and this migration would look like it worked
-- while changing nothing. Revoke PUBLIC first, then the named roles.
-- ---------------------------------------------------------------------------

revoke execute on function public.upsert_flight_price(text, text, date, numeric, text, text, timestamptz)
  from public, anon, authenticated;

revoke execute on function public.upsert_hotel_price(text, date, date, int, text, numeric, text, text)
  from public, anon, authenticated;

-- Make the one remaining caller explicit rather than relying on service_role's
-- inherited privileges. This is what the API routes authenticate as.
grant execute on function public.upsert_flight_price(text, text, date, numeric, text, text, timestamptz)
  to service_role;

grant execute on function public.upsert_hotel_price(text, date, date, int, text, numeric, text, text)
  to service_role;
