-- Made by Matt security hardening migration (2026-11-14)
-- 1. Header-bound RLS and write-key verification for public.sync_blobs (when installed)
-- 2. Payload size and column length constraints on public.member_data and public.profiles
-- 3. Private rate-limit budget RPC for subscribe-mailing-list

create extension if not exists pgcrypto;

create or replace function public.sync_request_header(p_name text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb) ->> lower(p_name),
    ''
  );
$$;

create or replace function public.sync_write_key_digest()
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select case
    when public.sync_request_header('x-sync-write-key') ~ '^[0-9a-f]{64}$' then
      encode(digest(public.sync_request_header('x-sync-write-key'), 'sha256'), 'hex')
    else ''
  end;
$$;

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'sync_blobs'
  ) then
    alter table public.sync_blobs
      add column if not exists write_key_hash text not null default '';

    alter table public.sync_blobs
      drop constraint if exists sync_blobs_write_key_hash_chk;
    alter table public.sync_blobs
      add constraint sync_blobs_write_key_hash_chk
      check (write_key_hash = '' or write_key_hash ~ '^[0-9a-f]{64}$');

    alter table public.sync_blobs enable row level security;

    drop policy if exists "sync_blobs_read" on public.sync_blobs;
    drop policy if exists "sync_blobs_insert" on public.sync_blobs;
    drop policy if exists "sync_blobs_update" on public.sync_blobs;
    drop policy if exists "sync_blobs_delete" on public.sync_blobs;

    create policy "sync_blobs_read"
      on public.sync_blobs for select
      to anon, authenticated
      using (
        id ~ '^[0-9a-f]{64}$'
        and id = public.sync_request_header('x-sync-id')
      );

    create policy "sync_blobs_insert"
      on public.sync_blobs for insert
      to anon, authenticated
      with check (
        id ~ '^[0-9a-f]{64}$'
        and id = public.sync_request_header('x-sync-id')
        and bytes between 0 and 1048576
        and octet_length(blob) <= 1400000
        and write_key_hash ~ '^[0-9a-f]{64}$'
        and write_key_hash = public.sync_write_key_digest()
      );

    create policy "sync_blobs_update"
      on public.sync_blobs for update
      to anon, authenticated
      using (
        id ~ '^[0-9a-f]{64}$'
        and id = public.sync_request_header('x-sync-id')
        and (
          write_key_hash = ''
          or write_key_hash = public.sync_write_key_digest()
        )
      )
      with check (
        id ~ '^[0-9a-f]{64}$'
        and id = public.sync_request_header('x-sync-id')
        and bytes between 0 and 1048576
        and octet_length(blob) <= 1400000
        and write_key_hash ~ '^[0-9a-f]{64}$'
        and write_key_hash = public.sync_write_key_digest()
      );

    create policy "sync_blobs_delete"
      on public.sync_blobs for delete
      to anon, authenticated
      using (
        id ~ '^[0-9a-f]{64}$'
        and id = public.sync_request_header('x-sync-id')
        and write_key_hash <> ''
        and write_key_hash = public.sync_write_key_digest()
      );

    revoke all on table public.sync_blobs from anon, authenticated;
    grant select (id, blob, bytes, schema_version, updated_at) on table public.sync_blobs to anon, authenticated;
    grant insert (id, blob, bytes, schema_version, updated_at, write_key_hash) on table public.sync_blobs to anon, authenticated;
    grant update (blob, bytes, schema_version, updated_at, write_key_hash) on table public.sync_blobs to anon, authenticated;
    grant delete on table public.sync_blobs to anon, authenticated;
  end if;
end
$$;

alter table public.profiles drop constraint if exists profiles_name_len_chk;
alter table public.profiles add constraint profiles_name_len_chk check (
  coalesce(char_length(name), 0) <= 80
  and coalesce(char_length(display_name), 0) <= 80
) not valid;

alter table public.member_data drop constraint if exists member_data_size_chk;
alter table public.member_data add constraint member_data_size_chk check (
  pg_column_size(data) <= 65536
  and jsonb_typeof(data) = 'object'
  and jsonb_typeof(coalesce(data->'favourites', '{}'::jsonb)) = 'object'
) not valid;

create schema if not exists mailing_private;
revoke all on schema mailing_private from public, anon, authenticated;

create table if not exists mailing_private.subscribe_events (
  id bigserial primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists subscribe_events_created_at_idx on mailing_private.subscribe_events (created_at desc);
create index if not exists subscribe_events_email_hash_idx on mailing_private.subscribe_events (email_hash, created_at desc);

alter table mailing_private.subscribe_events enable row level security;
revoke all on table mailing_private.subscribe_events from public, anon, authenticated;

create or replace function public.check_mailing_subscribe_budget(p_email_hash text)
returns text
language plpgsql
security definer
set search_path = mailing_private, public, pg_temp
as $$
declare
  recent_min integer;
  recent_hr integer;
  recent_email integer;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_email_hash' using errcode = '22023';
  end if;

  delete from mailing_private.subscribe_events
   where created_at < now() - interval '2 hours';

  select count(*) into recent_email
    from mailing_private.subscribe_events
   where email_hash = p_email_hash
     and created_at >= now() - interval '5 minutes';

  if recent_email > 0 then
    return 'cooldown';
  end if;

  select count(*) filter (where created_at >= now() - interval '1 minute'),
         count(*)
    into recent_min, recent_hr
    from mailing_private.subscribe_events
   where created_at >= now() - interval '1 hour';

  if recent_min >= 6 or recent_hr >= 30 then
    return 'rate_limited';
  end if;

  insert into mailing_private.subscribe_events (email_hash) values (p_email_hash);
  return 'ok';
end;
$$;

revoke all on function public.check_mailing_subscribe_budget(text) from public, anon, authenticated;
grant execute on function public.check_mailing_subscribe_budget(text) to service_role;
