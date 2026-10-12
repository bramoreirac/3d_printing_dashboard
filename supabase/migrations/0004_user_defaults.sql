-- 0004_user_defaults.sql
-- Sprint 2 fix: stamp new rows with their owner automatically.
--
-- Problem: client-side INSERTs (e.g. creating a machine) never sent
-- user_id, so the RLS WITH CHECK (user_id = auth.uid()) rejected every
-- new row. Rather than threading the user id through every client
-- insert, default the column to the signed-in user — the standard
-- Supabase pattern. Explicit values (the seed function) still win,
-- and WITH CHECK still validates ownership on every write.

alter table public.global_settings      alter column user_id set default auth.uid();
alter table public.supplies             alter column user_id set default auth.uid();
alter table public.materials            alter column user_id set default auth.uid();
alter table public.machines             alter column user_id set default auth.uid();
alter table public.orders               alter column user_id set default auth.uid();
alter table public.maintenance_records  alter column user_id set default auth.uid();
alter table public.stock_adjustments    alter column user_id set default auth.uid();
