-- Avoid idle function invocations while preserving event-driven processing.
create index if not exists sync_jobs_bling_webhook_due_idx
  on public.sync_jobs (status, next_attempt_at, locked_at)
  where provider = 'bling'
    and job_type = 'webhook_process'
    and processed_at is null;

create index if not exists payment_attempts_reconcile_due_idx
  on public.payment_attempts (updated_at asc)
  where status in ('created', 'pending')
    and external_payment_id is not null;

do $jobs$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in (
      'zalen-bling-webhook-process',
      'zalen-bling-incremental-sync',
      'zalen-mercado-pago-reconcile'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$jobs$;

select cron.schedule(
  'zalen-bling-webhook-process',
  '*/10 * * * *',
  $command$
    select private.invoke_zalen_internal_job('/api/jobs/bling/webhooks/process')
    where exists (
      select 1
      from public.sync_jobs
      where provider = 'bling'
        and job_type = 'webhook_process'
        and processed_at is null
        and (
          (
            status in ('pending', 'error')
            and (next_attempt_at is null or next_attempt_at <= now())
          )
          or (
            status = 'running'
            and locked_at is not null
            and locked_at <= now() - interval '15 minutes'
          )
        )
    );
  $command$
);

select cron.schedule(
  'zalen-bling-incremental-sync',
  '0 * * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/bling/sync');$command$
);

select cron.schedule(
  'zalen-mercado-pago-reconcile',
  '*/10 * * * *',
  $command$
    select private.invoke_zalen_internal_job('/api/jobs/mercado-pago/reconcile')
    where exists (
      select 1
      from public.payment_attempts
      where status in ('created', 'pending')
        and external_payment_id is not null
        and updated_at >= now() - interval '24 hours'
    );
  $command$
);
