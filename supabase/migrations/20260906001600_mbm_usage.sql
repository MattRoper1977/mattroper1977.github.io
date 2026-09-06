-- Created with Supabase CLI migration new mbm_usage. Prepared, not deployed.
-- Counts are events, never unique people. No IP, UA, account, or location data.
-- Registry and owner allowlist are provisioned separately by a database owner.
begin;

create schema usage_private;
revoke all on schema usage_private from public, anon, authenticated, service_role;

create table usage_private.sources (
  source text primary key check (source in ('education', 'play')),
  enabled boolean not null default false,
  measured_since timestamptz,
  max_events_per_minute integer not null default 600 check (max_events_per_minute between 1 and 10000),
  max_resource_events_per_minute integer not null default 120 check (max_resource_events_per_minute between 1 and 1000)
);
insert into usage_private.sources(source) values ('education'), ('play');

create table usage_private.resources (
  source text not null references usage_private.sources(source),
  resource_id text not null check (resource_id ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('lesson','pack','resource','game') and ((source='play' and kind='game') or (source='education' and kind<>'game'))),
  title text not null check (length(title) between 1 and 200),
  route text not null check (length(route) between 1 and 2048 and route ~ '^/[^?#]*$' and route !~ '[[:cntrl:]]' and route !~ '^//'),
  event_types text[] not null check (
    cardinality(event_types) between 1 and 2
    and event_types <@ array['lesson_open','download_request','game_launch']::text[]
    and ((source = 'play' and event_types = array['game_launch']::text[])
      or (source = 'education' and not ('game_launch' = any(event_types))))
  ),
  active boolean not null default true,
  primary key (source, resource_id),
  unique(source, route)
);
create table usage_private.event_nonces (
  source text not null,
  nonce uuid not null check (nonce::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  resource_id text not null,
  event_type text not null,
  expires_at timestamptz not null,
  primary key (source, nonce),
  foreign key (source, resource_id) references usage_private.resources(source, resource_id)
);
create index mbm_usage_nonce_expiry on usage_private.event_nonces(expires_at);
create table usage_private.daily (
  source text not null,
  resource_id text not null,
  event_type text not null check (event_type in ('lesson_open','download_request','game_launch')),
  day date not null,
  event_count bigint not null check (event_count > 0),
  primary key (source, resource_id, event_type, day),
  foreign key (source, resource_id) references usage_private.resources(source, resource_id)
);
create index mbm_usage_daily_window on usage_private.daily(source,day);
create table usage_private.totals (
  source text not null,
  resource_id text not null,
  event_type text not null check (event_type in ('lesson_open','download_request','game_launch')),
  event_count bigint not null check (event_count > 0),
  first_event_at timestamptz not null,
  last_event_at timestamptz not null,
  primary key (source, resource_id, event_type),
  foreign key (source, resource_id) references usage_private.resources(source, resource_id)
);
create table usage_private.budgets (
  source text not null references usage_private.sources(source),
  bucket text not null,
  minute timestamptz not null,
  event_count integer not null check (event_count > 0),
  primary key (source,bucket,minute)
);
create table usage_private.owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);

alter table usage_private.sources enable row level security;
alter table usage_private.resources enable row level security;
alter table usage_private.event_nonces enable row level security;
alter table usage_private.daily enable row level security;
alter table usage_private.totals enable row level security;
alter table usage_private.budgets enable row level security;
alter table usage_private.owners enable row level security;
revoke all on all tables in schema usage_private from public, anon, authenticated, service_role;
-- No browser role has a policy. Only tightly restricted definer entry points
-- execute as the migration/database owner, who owns these private tables.

create function public.mbm_usage_record_event(
  p_source text, p_resource_id text, p_event_type text, p_event_nonce uuid
) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, usage_private
as $$
declare
  v_source usage_private.sources%rowtype;
  v_previous usage_private.event_nonces%rowtype;
  v_now timestamptz;
  v_day date;
  v_minute timestamptz;
begin
  if p_source is null or p_source not in ('education','play')
    or p_resource_id is null or p_resource_id !~ '^[0-9a-f]{64}$'
    or p_event_type is null or p_event_type not in ('lesson_open','download_request','game_launch')
    or p_event_nonce is null or p_event_nonce::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode='22023', message='invalid_usage_event';
  end if;

  -- A bounded per-source lock makes nonce checks and all aggregate changes one
  -- transaction even under concurrent handlers. This is not a visitor lock.
  select * into v_source from usage_private.sources where source=p_source for update;
  if not found or not v_source.enabled then
    raise exception using errcode='P0001', message='usage_disabled';
  end if;
  if not exists (select 1 from usage_private.resources
    where source=p_source and resource_id=p_resource_id and active
      and p_event_type=any(event_types)) then
    raise exception using errcode='22023', message='unregistered_usage_event';
  end if;

  v_now := clock_timestamp();
  v_day := (v_now at time zone 'UTC')::date;
  v_minute := date_trunc('minute', v_now at time zone 'UTC') at time zone 'UTC';
  delete from usage_private.event_nonces where source=p_source and expires_at <= v_now;
  select * into v_previous from usage_private.event_nonces where source=p_source and nonce=p_event_nonce;
  if found then
    if v_previous.resource_id <> p_resource_id or v_previous.event_type <> p_event_type then
      raise exception using errcode='23505', message='usage_nonce_conflict';
    end if;
    return jsonb_build_object('counted',false);
  end if;

  delete from usage_private.budgets where source=p_source and minute < v_minute - interval '2 minutes';
  insert into usage_private.budgets(source,bucket,minute,event_count) values(p_source,'all',v_minute,1)
    on conflict(source,bucket,minute) do update set event_count=usage_private.budgets.event_count+1
    where usage_private.budgets.event_count < v_source.max_events_per_minute;
  if not found then raise exception using errcode='54000', message='usage_rate_limit'; end if;
  insert into usage_private.budgets(source,bucket,minute,event_count) values(p_source,p_resource_id||':'||p_event_type,v_minute,1)
    on conflict(source,bucket,minute) do update set event_count=usage_private.budgets.event_count+1
    where usage_private.budgets.event_count < v_source.max_resource_events_per_minute;
  if not found then raise exception using errcode='54000', message='usage_rate_limit'; end if;

  insert into usage_private.event_nonces(source,nonce,resource_id,event_type,expires_at)
    values(p_source,p_event_nonce,p_resource_id,p_event_type,v_now+interval '10 minutes');
  insert into usage_private.daily(source,resource_id,event_type,day,event_count)
    values(p_source,p_resource_id,p_event_type,v_day,1)
    on conflict(source,resource_id,event_type,day) do update set event_count=usage_private.daily.event_count+1;
  insert into usage_private.totals(source,resource_id,event_type,event_count,first_event_at,last_event_at)
    values(p_source,p_resource_id,p_event_type,1,v_now,v_now)
    on conflict(source,resource_id,event_type) do update
      set event_count=usage_private.totals.event_count+1, last_event_at=excluded.last_event_at;
  update usage_private.sources set measured_since=coalesce(measured_since,v_now) where source=p_source;
  delete from usage_private.daily where source=p_source and day < v_day-30;
  return jsonb_build_object('counted',true);
end;
$$;
revoke all on function public.mbm_usage_record_event(text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.mbm_usage_record_event(text,text,text,uuid) to service_role;

-- Private helper: read-only aggregate shaping, no SECURITY DEFINER needed here.
create function usage_private.window_summary(p_source text, p_since date)
returns jsonb language sql stable security invoker
set search_path = pg_catalog, usage_private
as $$
  with counts as (
    select t.resource_id,t.event_type,t.event_count from usage_private.totals t
      where t.source=p_source and p_since is null
    union all
    select d.resource_id,d.event_type,sum(d.event_count)::bigint
      from usage_private.daily d where d.source=p_source and p_since is not null
        and d.day>=p_since and d.day<=(current_timestamp at time zone 'UTC')::date
      group by d.resource_id,d.event_type
  ), ranked as (
    select c.*,r.title,r.route,row_number() over(partition by c.event_type order by c.event_count desc,c.resource_id) as position
      from counts c join usage_private.resources r on r.source=p_source and r.resource_id=c.resource_id
      where c.event_count>0 and ((c.event_type='lesson_open' and r.kind='lesson')
        or (c.event_type='download_request' and r.kind='pack')
        or (c.event_type='game_launch' and r.kind='game'))
  ), tops as (
    select event_type,jsonb_agg(jsonb_build_object('resource_id',resource_id,'title',title,'route',route,'count',event_count)
      order by event_count desc,resource_id) as rows
      from ranked where position<=10 group by event_type
  )
  select jsonb_build_object(
    'totals',jsonb_build_object(
      'lesson_open',coalesce((select sum(event_count) from counts where event_type='lesson_open'),0),
      'download_request',coalesce((select sum(event_count) from counts where event_type='download_request'),0),
      'game_launch',coalesce((select sum(event_count) from counts where event_type='game_launch'),0)),
    'top',jsonb_build_object(
      'lessons',coalesce((select rows from tops where event_type='lesson_open'),'[]'::jsonb),
      'packs',coalesce((select rows from tops where event_type='download_request'),'[]'::jsonb),
      'games',coalesce((select rows from tops where event_type='game_launch'),'[]'::jsonb))
  );
$$;
revoke all on function usage_private.window_summary(text,date) from public, anon, authenticated, service_role;

create function public.mbm_usage_public_summary(p_source text, p_ids text[] default array[]::text[])
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, usage_private
as $$
declare
  v_source usage_private.sources%rowtype;
  v_now timestamptz := current_timestamp;
  v_first date := (current_timestamp at time zone 'UTC')::date-29;
  v_resources jsonb;
begin
  if p_source is null or p_source not in ('education','play')
    or p_ids is null or cardinality(p_ids)>50
    or exists(select 1 from unnest(p_ids) id where id is null or id !~ '^[0-9a-f]{64}$') then
    raise exception using errcode='22023', message='invalid_usage_query';
  end if;
  select * into v_source from usage_private.sources where source=p_source;
  if not found then raise exception using errcode='22023', message='invalid_usage_source'; end if;
  if exists(select 1 from unnest(p_ids) id where not exists(
    select 1 from usage_private.resources r where r.source=p_source and r.resource_id=id)) then
    raise exception using errcode='22023', message='unregistered_usage_resource';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resource_id',r.resource_id,'event_type',e.event_type,
    'last30days',coalesce((select sum(d.event_count) from usage_private.daily d where d.source=p_source
      and d.resource_id=r.resource_id and d.event_type=e.event_type and d.day between v_first and (v_now at time zone 'UTC')::date),0),
    'alltime',coalesce((select t.event_count from usage_private.totals t where t.source=p_source
      and t.resource_id=r.resource_id and t.event_type=e.event_type),0)
  ) order by r.resource_id,e.event_type),'[]'::jsonb) into v_resources
    from usage_private.resources r cross join lateral unnest(r.event_types) e(event_type)
    where r.source=p_source and r.resource_id=any(p_ids);

  return jsonb_build_object(
    'schema',1,'source',p_source,'enabled',v_source.enabled,'measured_since',v_source.measured_since,'as_of',v_now,
    'windows',jsonb_build_object(
      'last30days',usage_private.window_summary(p_source,v_first) || jsonb_build_object('from',v_first::timestamp at time zone 'UTC','to',v_now),
      'alltime',usage_private.window_summary(p_source,null) || jsonb_build_object('from',v_source.measured_since,'to',v_now)),
    'resources',v_resources
  );
end;
$$;
revoke all on function public.mbm_usage_public_summary(text,text[]) from public;
grant execute on function public.mbm_usage_public_summary(text,text[]) to anon, authenticated, service_role;

create function public.mbm_usage_owner_summary(p_source text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, usage_private
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not exists(select 1 from usage_private.owners where user_id=auth.uid() and enabled) then
    raise exception using errcode='42501', message='usage_owner_required';
  end if;
  return public.mbm_usage_public_summary(p_source,array[]::text[]) || jsonb_build_object(
    'geography',jsonb_build_object('enabled',false,'status','not_collected','rows','[]'::jsonb));
end;
$$;
revoke all on function public.mbm_usage_owner_summary(text) from public, anon, service_role;
grant execute on function public.mbm_usage_owner_summary(text) to authenticated;

-- Operator-scheduled cleanup ensures expiry is physical even during idle traffic.
-- No public or service-role execution; cron runs this as the database owner.
create function usage_private.purge_expired()
returns void language sql volatile security invoker
set search_path = pg_catalog, usage_private
as $$
  delete from usage_private.event_nonces where expires_at <= clock_timestamp();
  delete from usage_private.budgets where minute < date_trunc('minute',clock_timestamp()) - interval '2 minutes';
  delete from usage_private.daily where day < (current_timestamp at time zone 'UTC')::date-30;
$$;
revoke all on function usage_private.purge_expired() from public,anon,authenticated,service_role;

-- Future functions/tables in this schema must not silently acquire PUBLIC access.
alter default privileges in schema usage_private revoke execute on functions from public;
alter default privileges in schema usage_private revoke all on tables from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
