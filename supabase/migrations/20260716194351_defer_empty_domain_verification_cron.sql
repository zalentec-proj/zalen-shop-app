do $jobs$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'zalen-domains-verify'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$jobs$;

select cron.schedule(
  'zalen-domains-verify',
  '*/5 * * * *',
  $command$
    select private.invoke_zalen_internal_job('/api/jobs/domains/verify')
    where exists (
      select 1
      from public.store_domains
      where status in (
        'pending_provisioning',
        'pending_ownership',
        'pending_dns',
        'pending_ssl',
        'failed'
      )
        and (next_check_at is null or next_check_at <= now())
    );
  $command$
);
