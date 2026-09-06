-- Run as database owner AFTER the migration, BEFORE enabling collection.
-- Requires Supabase Cron/pg_cron. Does not change any other existing job.
begin;
create extension if not exists pg_cron;
select cron.schedule('mbm-usage-expiry','*/5 * * * *','select usage_private.purge_expired();');
commit;
-- Inspect this exact job and its successful runs before activation.
select jobid,jobname,schedule,command,active from cron.job where jobname='mbm-usage-expiry';

