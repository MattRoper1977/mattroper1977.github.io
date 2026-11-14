-- ============================================================================
-- Made by Matt — cross-device sync
-- Run once:  Supabase Dashboard → SQL Editor → paste → Run.
-- ----------------------------------------------------------------------------
-- READ THIS BEFORE CHANGING THE TABLE.
--
-- There is deliberately NO email column, NO name column, NO user id, and no
-- way to tell whose row is whose. `blob` is AES-GCM ciphertext encrypted in the
-- browser; the key is derived from a code that never leaves the device and is
-- never sent here. Nobody with access to this database — including whoever owns
-- it — can read a single save.
--
-- That is the entire reason this can be run by one teacher without a
-- compliance apparatus. Add a plaintext identifier to this table and you have
-- changed what the site is, and the privacy page becomes false the same day.
--
-- Region: create the project in London (eu-west-2). It cannot be changed later
-- without recreating the project.
-- ============================================================================

create table if not exists public.sync_blobs (
  id             text primary key,        -- SHA-256(code || '|id'), 64 hex chars
  blob           text not null,           -- "<b64 iv>.<b64 ciphertext>"
  bytes          integer not null default 0,
  write_key_hash text not null,           -- SHA-256(SHA-256(code || '|write'))
  updated_at     timestamptz not null default now()
);

alter table public.sync_blobs add column if not exists write_key_hash text;

-- Shape and size are enforced here as well as in the client, because a client
-- check is a convenience and a database check is the actual limit.
alter table public.sync_blobs drop constraint if exists sync_blobs_id_shape;
alter table public.sync_blobs add constraint sync_blobs_id_shape
  check (id ~ '^[0-9a-f]{64}$');

alter table public.sync_blobs drop constraint if exists sync_blobs_write_key_hash_shape;
alter table public.sync_blobs add constraint sync_blobs_write_key_hash_shape
  check (write_key_hash ~ '^[0-9a-f]{64}$');

alter table public.sync_blobs drop constraint if exists sync_blobs_size;
alter table public.sync_blobs add constraint sync_blobs_size
  check (length(blob) <= 262144);

create index if not exists sync_blobs_updated_at_idx on public.sync_blobs (updated_at);

-- Header-bound RLS helpers ----------------------------------------------------
-- PostgREST exposes request headers via `request.headers`. Binding RLS to
-- `x-sync-id` and `x-sync-write-key` ensures:
--   1. Unfiltered `GET /rest/v1/sync_blobs` returns 0 rows (no enumeration).
--   2. Unfiltered `DELETE` or `PATCH` affects 0 rows.
--   3. Knowing `id` alone cannot overwrite or delete a row without the
--      independent `x-sync-write-key` derived from the user's 7-word code.
create or replace function public.sync_request_header(p_name text)
returns text
language sql
stable
as $$
  select nullif(trim(coalesce(
    (nullif(current_setting('request.headers', true), '')::jsonb ->> lower(p_name)),
    ''
  )), '');
$$;

create or replace function public.sync_write_key_digest()
returns text
language sql
stable
as $$
  select case
    when public.sync_request_header('x-sync-write-key') ~ '^[0-9a-f]{64}$'
      then encode(pg_catalog.sha256(pg_catalog.convert_to(public.sync_request_header('x-sync-write-key'), 'UTF8')), 'hex')
    else null
  end;
$$;

-- Row-level security ---------------------------------------------------------
alter table public.sync_blobs enable row level security;

revoke all on table public.sync_blobs from public, anon, authenticated;
grant select (id, blob, bytes, updated_at) on table public.sync_blobs to anon, authenticated;
grant insert (id, blob, bytes) on table public.sync_blobs to anon, authenticated;
grant update (id, blob, bytes) on table public.sync_blobs to anon, authenticated;
grant delete on table public.sync_blobs to anon, authenticated;

drop policy if exists "sync_read"   on public.sync_blobs;
drop policy if exists "sync_write"  on public.sync_blobs;
drop policy if exists "sync_update" on public.sync_blobs;
drop policy if exists "sync_delete" on public.sync_blobs;

create policy "sync_read" on public.sync_blobs
  for select to anon, authenticated
  using (id = public.sync_request_header('x-sync-id'));

create policy "sync_write" on public.sync_blobs
  for insert to anon, authenticated
  with check (
    id = public.sync_request_header('x-sync-id')
    and public.sync_write_key_digest() is not null
  );

create policy "sync_update" on public.sync_blobs
  for update to anon, authenticated
  using (
    id = public.sync_request_header('x-sync-id')
    and write_key_hash = public.sync_write_key_digest()
  )
  with check (
    id = public.sync_request_header('x-sync-id')
    and public.sync_write_key_digest() is not null
  );

create policy "sync_delete" on public.sync_blobs
  for delete to anon, authenticated
  using (
    id = public.sync_request_header('x-sync-id')
    and write_key_hash = public.sync_write_key_digest()
  );

-- Keep updated_at, bytes, and write_key_hash honest on insert/upsert.
create or replace function public.sync_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.bytes = length(new.blob);
  new.write_key_hash = coalesce(public.sync_write_key_digest(), old.write_key_hash);
  if new.write_key_hash is null then
    raise exception 'missing or invalid x-sync-write-key';
  end if;
  return new;
end; $$;

drop trigger if exists sync_blobs_touch on public.sync_blobs;
create trigger sync_blobs_touch before insert or update on public.sync_blobs
  for each row execute function public.sync_touch();

-- Retention ------------------------------------------------------------------
-- Written as a job rather than left as an intention. Storage limitation is an
-- obligation, and "we meant to" is not a retention policy.
create or replace function public.sync_prune() returns void
language sql as $$
  delete from public.sync_blobs where updated_at < now() - interval '12 months';
$$;

-- Schedule it if pg_cron is available (Dashboard → Database → Extensions).
-- If it is not, run `select public.sync_prune();` by hand once a term, and say
-- so on the privacy page rather than implying it is automatic.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mbm-sync-prune', '0 3 * * 0', 'select public.sync_prune()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;

-- ============================================================================
-- To wipe everything (e.g. an erasure request you cannot target, because you
-- genuinely cannot tell whose row is whose):
--   truncate public.sync_blobs;
-- Users delete their own from the site, which is the normal route.
-- ============================================================================
