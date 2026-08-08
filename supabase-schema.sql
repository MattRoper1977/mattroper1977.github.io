-- mbm-accounts-members-mailing-2026-08-08
-- Made by Matt: cloud accounts + account-backed member data.
-- Run in the Supabase SQL editor for the project used by madebymatt.uk.
--
-- SECURITY MODEL
-- * Passwords belong only to Supabase Auth. No password column exists here.
-- * Every public table uses RLS keyed to auth.uid().
-- * member_data uses optimistic versioning so a stale browser cannot silently
--   replace a newer account copy. The client refetches, merges, and retries.
-- * Auth-user deletion cascades to profile + member data.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  display_name text,
  tier text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade older installs created by the July schema without dropping data.
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists tier text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.member_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"schema":1,"favourites":{}}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.member_data enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "member_data_select_own" on public.member_data;
drop policy if exists "member_data_insert_own" on public.member_data;
drop policy if exists "member_data_update_own" on public.member_data;
drop policy if exists "member_data_delete_own" on public.member_data;
create policy "member_data_select_own" on public.member_data for select to authenticated using (auth.uid() = user_id);
create policy "member_data_insert_own" on public.member_data for insert to authenticated with check (auth.uid() = user_id);
create policy "member_data_update_own" on public.member_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "member_data_delete_own" on public.member_data for delete to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, display_name, tier)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'display_name', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', ''), ''),
    'member'
  )
  on conflict (id) do nothing;

  insert into public.member_data (user_id, data, version)
  values (new.id, '{"schema":1,"favourites":{}}'::jsonb, 1)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.member_data (user_id, data, version)
select u.id, '{"schema":1,"favourites":{}}'::jsonb, 1
from auth.users u
left join public.member_data m on m.user_id = u.id
where m.user_id is null;

create or replace function public.update_member_data(p_expected_version bigint, p_data jsonb)
returns public.member_data
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.member_data;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.member_data
     set data = coalesce(p_data, '{"schema":1,"favourites":{}}'::jsonb),
         version = version + 1,
         updated_at = now()
   where user_id = auth.uid()
     and version = p_expected_version
  returning * into result;

  if result.user_id is null then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  return result;
end;
$$;

revoke all on function public.update_member_data(bigint, jsonb) from public;
grant execute on function public.update_member_data(bigint, jsonb) to authenticated;

-- Useful readback after running this file:
-- select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('profiles','member_data');
-- select proname from pg_proc where proname='update_member_data';
