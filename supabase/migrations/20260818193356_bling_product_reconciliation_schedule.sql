-- Daily source-of-truth scan for product deletions that may not emit or reach
-- a webhook. The application route performs the full scan before changing a
-- local status; this cron job only invokes the protected server-side worker.

create or replace function private.invoke_zalen_internal_job(p_path text)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault
as $$
declare
  v_secret text;
  v_allowed_paths constant text[] := array[
    '/api/jobs/bling/webhooks/process',
    '/api/jobs/bling/sync',
    '/api/jobs/bling/products/reconcile',
    '/api/jobs/mercado-pago/reconcile'
  ];
begin
  if p_path <> all(v_allowed_paths) then
    raise exception 'zalen_internal_job_path_not_allowed';
  end if;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'zalen_cron_secret'
  limit 1;

  if v_secret is null then
    raise exception 'zalen_cron_secret_not_configured';
  end if;

  return net.http_post(
    url := 'https://app.zalenshop.com.br' || p_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json',
      'User-Agent', 'Zalen-Supabase-Cron/1.0'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.invoke_zalen_internal_job(text)
  from public, anon, authenticated;

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
      'zalen-bling-product-reconciliation',
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

-- 06:15 UTC is 03:15 in Brazil's current standard time. It runs separately
-- from the hourly delta sync so the normal path remains inexpensive.
select cron.schedule(
  'zalen-bling-product-reconciliation',
  '15 6 * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/bling/products/reconcile');$command$
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
