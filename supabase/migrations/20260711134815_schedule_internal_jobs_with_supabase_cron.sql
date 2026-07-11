create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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
  $command$select private.invoke_zalen_internal_job('/api/jobs/bling/webhooks/process');$command$
);

select cron.schedule(
  'zalen-bling-incremental-sync',
  '*/10 * * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/bling/sync');$command$
);

select cron.schedule(
  'zalen-mercado-pago-reconcile',
  '*/10 * * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/mercado-pago/reconcile');$command$
);
