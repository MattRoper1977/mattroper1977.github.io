-- P1 step 1.1 — enumerate every database object reachable with the anon key.
-- Run in the Supabase SQL editor for the madebymatt.uk project.
-- Read-only. Paste each result block into reports/proofs/P1_isolation.md.
--
-- WHY THIS FILE EXISTS SEPARATELY FROM THE RUNTIME HARNESS:
-- pg_class.relrowsecurity, view security_invoker and prosecdef are catalogue
-- facts. The anon key cannot read them over PostgREST, so they cannot be
-- proven by the black-box harness in p1_isolation.mjs. Both halves are needed.

-- 1. TABLES: is RLS actually ENABLED, and is it FORCED?
--    A table with policies but relrowsecurity=false is WIDE OPEN. Policies on
--    such a table are inert. This is the commonest silent failure.
select n.nspname   as schema,
       c.relname   as object,
       c.relkind   as kind,          -- r=table, v=view, m=matview, p=partitioned
       c.relrowsecurity  as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','storage')
  and c.relkind in ('r','p','v','m')
order by 1,2;

-- 2. EVERY POLICY with its USING and WITH CHECK clauses.
--    A policy with qual but no with_check cannot stop an UPDATE that reassigns
--    the owning column to another user. That is test 1.3 row 3.
select schemaname, tablename, policyname, cmd, roles,
       qual        as using_clause,
       with_check  as with_check_clause
from pg_policies
where schemaname in ('public','storage')
order by tablename, cmd, policyname;

-- 3. VIEWS: a view runs as its OWNER and bypasses the underlying table's RLS
--    unless security_invoker is on. Any 'false'/absent here is a finding.
select c.relname as view_name,
       c.reloptions as options,   -- look for security_invoker=true
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
order by 1;

-- 4. SECURITY DEFINER functions: each one is an RLS bypass by design.
--    Justify or flag every row. Also check search_path is pinned.
select n.nspname as schema, p.proname as function,
       p.prosecdef as security_definer,
       p.proconfig as config,        -- expect search_path=... on secdef
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public')
order by p.prosecdef desc, 2;

-- 5. WHAT THE BROWSER ROLES CAN ACTUALLY TOUCH.
--    Grants are a second, independent gate in front of RLS. Column-level
--    grants matter: profiles is intentionally update(name,display_name) only.
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where grantee in ('anon','authenticated')
  and table_schema in ('public','storage')
order by table_name, grantee, privilege_type;

select table_schema, table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where grantee in ('anon','authenticated') and table_schema = 'public'
order by table_name, grantee, column_name;

-- 6. EXECUTABLE FUNCTIONS exposed to the browser roles (RPC surface).
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       r.rolname as grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral (select rolname from pg_roles where rolname in ('anon','authenticated')) r
where n.nspname='public'
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
order by 1,3;

-- 7. REALTIME publications: what is broadcast, and to whom.
--    Realtime respects RLS only where the publication is filtered and RLS is on.
select pubname, schemaname, tablename
from pg_publication_tables
order by 1,2,3;

-- 8. STORAGE buckets (public buckets bypass every policy you wrote).
select id, name, public, created_at from storage.buckets order by 1;

-- 9. ANY OTHER public table that is NOT one of the two expected ones.
--    R25: a non-zero census must classify every hit individually.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname not in ('profiles','member_data')
order by 1;
