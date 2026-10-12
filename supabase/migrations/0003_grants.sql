-- 0003_grants.sql
-- Sprint 2 fix: table-level GRANTs for the API roles.
--
-- RLS policies (0001) control WHICH ROWS each caller sees; GRANTs control
-- WHETHER the role may touch the table at all. Without these, PostgREST
-- returns "permission denied for table ..." (HTTP 401/403) before RLS
-- is even evaluated. Newer Supabase projects do not always default-grant
-- to anon/authenticated, so grant explicitly — RLS still gates the data.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

-- Include tables/views created in the future as well.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

-- The stock view only needs read access.
grant select on public.supply_stock to anon, authenticated, service_role;
