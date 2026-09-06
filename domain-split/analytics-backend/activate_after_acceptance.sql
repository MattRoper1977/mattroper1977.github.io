-- Only run after real provider auth/access tests, published notice/opt-out,
-- reviewed real catalogue provisioning and a successful scheduled expiry run.
-- This enables ingestion; it DOES NOT create visits or measured_since dates.
do $$
begin
  if not exists(select 1 from usage_private.owners where enabled) then
    raise exception 'Verified owner authorization is missing';
  end if;
  if exists(select 1 from usage_private.sources s where not exists(
    select 1 from usage_private.resources r where r.source=s.source and r.active)) then
    raise exception 'Reviewed resource catalogue missing for a source';
  end if;
  if not exists(select 1 from cron.job where jobname='mbm-usage-expiry'
    and active and schedule='*/5 * * * *' and command='select usage_private.purge_expired();') then
    raise exception 'Scheduled expiry is not active';
  end if;
  if not exists(select 1 from cron.job_run_details d join cron.job j on j.jobid=d.jobid
    where j.jobname='mbm-usage-expiry' and d.status='succeeded') then
    raise exception 'Scheduled expiry has no successful run yet';
  end if;
  update usage_private.sources set enabled=true;
end;
$$;
select source,enabled,measured_since from usage_private.sources order by source;
