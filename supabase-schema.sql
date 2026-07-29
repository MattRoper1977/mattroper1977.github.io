-- ============================================================================
-- Made by Matt — Supabase schema for cross-device accounts + members' area
-- ----------------------------------------------------------------------------
-- Run this once in your Supabase project:  Dashboard → SQL Editor → paste → Run.
-- It creates a "profiles" row for every user (name + membership tier) and locks
-- it down with row-level security so each person can only see/edit their own.
--
-- The site works with just Supabase Auth (email/password) out of the box; this
-- table is what lets you manage names, tiers and member perks later.
-- ============================================================================

-- 1) Profile table ----------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  tier       text not null default 'member',   -- e.g. member | supporter | patron
  created_at timestamptz not null default now()
);

-- 2) Row-level security -----------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ( auth.uid() = id );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ( auth.uid() = id );

-- 3) Auto-create a profile when someone signs up ----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'tier', 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- To promote a supporter/patron later (from the SQL editor):
--   update public.profiles set tier = 'patron' where id = '<user-uuid>';
-- Find the uuid in Dashboard → Authentication → Users.
-- ============================================================================
