-- Read-only membership administration. Credentials/tokens/IPs are never returned.
create schema if not exists account_private;
revoke all on schema account_private from public, anon, authenticated;
grant usage on schema account_private to authenticated;

create table account_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  granted_at timestamptz not null default now()
);
alter table account_private.admins enable row level security;
revoke all on account_private.admins from public, anon, authenticated;

create function account_private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from account_private.admins a
    join auth.users u on u.id = a.user_id
    join auth.sessions s on s.user_id = u.id
    where a.user_id = auth.uid() and a.enabled
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > now())
  ) then
    raise exception using errcode = '42501', message = 'account_admin_required';
  end if;
end;
$$;
revoke all on function account_private.require_admin() from public, anon, authenticated;

create function account_private.member_list(p_page integer, p_page_size integer, p_search text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result_rows jsonb; matched bigint; summary jsonb;
begin
  -- Authorize before validating or querying member data. Never trust display
  -- name, local storage, user_metadata, or a caller-supplied role/email.
  perform account_private.require_admin();
  if p_page is null or p_page < 1 or p_page > 10000
    or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or p_search is null or length(p_search) > 120 then
    raise exception using errcode = '22023', message = 'invalid_member_query';
  end if;
  p_search := lower(btrim(p_search));
  select jsonb_build_object(
    'registered', count(*),
    'verified', count(*) filter (where email_confirmed_at is not null),
    'joined_last_7_days', count(*) filter (where created_at >= now() - interval '7 days'),
    'signed_in_last_7_days', count(*) filter (where last_sign_in_at >= now() - interval '7 days')
  ) into summary from auth.users where not coalesce(is_anonymous, false) and deleted_at is null;
  with filtered as (
    select u.id, u.email, coalesce(nullif(p.display_name,''),nullif(p.name,''),
      u.raw_user_meta_data->>'display_name', '') as display_name,
      u.email_confirmed_at is not null as email_verified, u.created_at, u.last_sign_in_at
    from auth.users u left join public.profiles p on p.id = u.id
    where not coalesce(u.is_anonymous, false) and u.deleted_at is null
      and (p_search = '' or strpos(lower(coalesce(u.email,'')), p_search) > 0
        or strpos(lower(coalesce(nullif(p.display_name,''),nullif(p.name,''),u.raw_user_meta_data->>'display_name','')),p_search) > 0)
  ), paged as (
    select * from filtered order by created_at desc, id desc
    limit p_page_size offset ((p_page - 1)::bigint * p_page_size)
  )
  select (select count(*) from filtered), coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'email', p.email, 'display_name', p.display_name,
      'email_verified', p.email_verified, 'created_at', p.created_at,
      'last_sign_in_at', p.last_sign_in_at,
      'recorded_sessions', (select count(*) from auth.sessions s where s.user_id = p.id
        and (s.not_after is null or s.not_after > now()))
    ) order by p.created_at desc, p.id desc) from paged p
  ), '[]'::jsonb) into matched, result_rows;
  return jsonb_build_object('schema', 1, 'as_of', now(), 'summary', summary,
    'total', matched, 'page', p_page, 'page_size', p_page_size, 'members', result_rows);
end;
$$;
revoke all on function account_private.member_list(integer,integer,text) from public, anon, authenticated;
grant execute on function account_private.member_list(integer,integer,text) to authenticated;

-- API wrapper runs as the caller; privileged implementation stays unexposed.
create function public.mbm_account_admin_members(p_page integer default 1,
  p_page_size integer default 25, p_search text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select account_private.member_list(p_page, p_page_size, p_search);
$$;
revoke all on function public.mbm_account_admin_members(integer,integer,text) from public, anon, authenticated;
grant execute on function public.mbm_account_admin_members(integer,integer,text) to authenticated;
comment on function public.mbm_account_admin_members(integer,integer,text) is
  'Read-only member administration; private UUID allowlist plus verified live-session check. Session records are not presence.';
