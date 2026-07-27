-- Removes the Phase 5 "AI trip discovery" feature's table. The feature was
-- decided against and its app code fully removed; this drops the table it
-- used (see 0004_custom_trips.sql for what it looked like) rather than
-- leaving an orphaned, unused table behind. Run once in the Supabase SQL
-- Editor, same as the earlier migrations.
--
-- This is destructive: if anyone ever approved a discovered trip, that data
-- is gone after this runs. Confirmed with Parker before writing this
-- migration -- full removal, including the table, was his explicit choice.

drop table if exists custom_trips;
