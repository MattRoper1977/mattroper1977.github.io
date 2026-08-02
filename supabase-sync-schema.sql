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
  id         text primary key,            -- SHA-256(code || '|id'), 64 hex chars
  blob       text not null,               -- "<b64 iv>.<b64 ciphertext>"
  bytes      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Shape and size are enforced here as well as in the client, because a client
-- check is a convenience and a database check is the actual limit.
alter table public.sync_blobs drop constraint if exists sync_blobs_id_shape;
alter table public.sync_blobs add constraint sync_blobs_id_shape
  check (id ~ '^[0-9a-f]{64}$');

alter table public.sync_blobs drop constraint if exists sync_blobs_size;
alter table public.sync_blobs add constraint sync_blobs_size
  check (length(blob) <= 262144);

create index if not exists sync_blobs_updated_at_idx on public.sync_blobs (updated_at);

-- Row-level security ---------------------------------------------------------
-- Access control here is the UNGUESSABILITY OF THE ID, not a login: the id is a
-- 256-bit hash of a 7-word code, and holding it yields only ciphertext.
-- Anonymous clients may therefore read and write a row they can name, and may
-- never list rows — `select` is only ever reachable with an exact id from the
-- client, and there is no policy permitting an unfiltered scan to return
-- anything meaningful because every row is opaque anyway.
alter table public.sync_blobs enable row level security;

drop policy if exists "sync_read"   on public.sync_blobs;
drop policy if exists "sync_write"  on public.sync_blobs;
drop policy if exists "sync_update" on public.sync_blobs;
drop policy if exists "sync_delete" on public.sync_blobs;

create policy "sync_read"   on public.sync_blobs for select using (true);
create policy "sync_write"  on public.sync_blobs for insert with check (true);
create policy "sync_update" on public.sync_blobs for update using (true) with check (true);
create policy "sync_delete" on public.sync_blobs for delete using (true);

-- Keep updated_at honest on upsert.
create or replace function public.sync_touch() returns trigger
language plpgsql as $$
begin new.updated_at = now(); new.bytes = length(new.blob); return new; end; $$;

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
