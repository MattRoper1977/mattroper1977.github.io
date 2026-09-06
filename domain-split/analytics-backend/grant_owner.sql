-- Set mbm.usage_owner_uuid to the exact existing, verified owner Auth UUID in
-- this SQL session. Do not select the first account or accept a browser email.
-- Example setup shape only: SET mbm.usage_owner_uuid = '<verified Auth UUID>';
do $$
declare owner_uuid uuid := nullif(current_setting('mbm.usage_owner_uuid',true),'')::uuid;
begin
  if owner_uuid is null then raise exception 'Set the verified owner Auth UUID first'; end if;
  if not exists(select 1 from auth.users where id=owner_uuid) then
    raise exception 'Owner UUID does not exist in Auth';
  end if;
  insert into usage_private.owners(user_id,enabled) values(owner_uuid,true)
    on conflict(user_id) do update set enabled=true;
end;
$$;
-- Do not emit user rows or identity details as deployment proof.
select count(*) as enabled_owner_count from usage_private.owners where enabled;

