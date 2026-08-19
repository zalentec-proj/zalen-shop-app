-- WhatsApp Evolution connector. The platform owns the API credentials; stores
-- own one production instance and their delivery/consent records.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.integration_providers'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%category%';

  if v_constraint is not null then
    execute format('alter table public.integration_providers drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.integration_providers
  add constraint integration_providers_category_check
  check (category in ('erp', 'payment', 'shipping', 'sales_channel', 'ai', 'analytics', 'communication'));

insert into public.integration_providers (key, name, category, status, description)
values (
  'evolution_whatsapp',
  'WhatsApp',
  'communication',
  'beta',
  'Mensagens transacionais via Evolution API, com uma conexão por loja.'
)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  status = excluded.status,
  description = excluded.description,
  updated_at = now();

create table if not exists public.customer_contact_preferences (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('whatsapp')),
  phone_e164 text,
  verified_at timestamptz,
  transactional_opted_in_at timestamptz,
  transactional_opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_id, channel),
  check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

create index if not exists customer_contact_preferences_store_customer_idx
  on public.customer_contact_preferences (store_id, customer_id);

create table if not exists public.customer_contact_verifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('whatsapp')),
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 10),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_contact_verifications_active_idx
  on public.customer_contact_verifications (store_id, customer_id, channel, expires_at desc)
  where consumed_at is null;

create table if not exists public.whatsapp_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  integration_id uuid references public.store_integrations(id) on delete set null,
  event_key text not null,
  entity_type text not null,
  entity_id uuid,
  recipient_kind text not null check (recipient_kind in ('customer', 'store_operator')),
  customer_id uuid references public.customers(id) on delete set null,
  recipient_phone_e164 text not null check (recipient_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  message_text text not null,
  idempotency_key text not null,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'accepted', 'delivered', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, idempotency_key)
);

create index if not exists whatsapp_message_deliveries_due_idx
  on public.whatsapp_message_deliveries (status, next_attempt_at, created_at)
  where status in ('queued', 'accepted');

create index if not exists whatsapp_message_deliveries_store_created_idx
  on public.whatsapp_message_deliveries (store_id, created_at desc);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  integration_id uuid references public.store_integrations(id) on delete set null,
  external_event_id text,
  event_type text not null,
  instance_name text not null,
  sanitized_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, external_event_id)
);

create index if not exists whatsapp_webhook_events_store_created_idx
  on public.whatsapp_webhook_events (store_id, created_at desc);

alter table public.customer_contact_preferences enable row level security;
alter table public.customer_contact_verifications enable row level security;
alter table public.whatsapp_message_deliveries enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

revoke all on public.customer_contact_preferences from anon;
revoke all on public.customer_contact_verifications from anon;
revoke all on public.whatsapp_message_deliveries from anon;
revoke all on public.whatsapp_webhook_events from anon;

grant select, insert, update, delete on public.customer_contact_preferences to service_role;
grant select, insert, update, delete on public.customer_contact_verifications to service_role;
grant select, insert, update, delete on public.whatsapp_message_deliveries to service_role;
grant select, insert, update, delete on public.whatsapp_webhook_events to service_role;

drop policy if exists "service_role_only" on public.customer_contact_preferences;
create policy "service_role_only" on public.customer_contact_preferences
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "service_role_only" on public.customer_contact_verifications;
create policy "service_role_only" on public.customer_contact_verifications
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "service_role_only" on public.whatsapp_message_deliveries;
create policy "service_role_only" on public.whatsapp_message_deliveries
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "service_role_only" on public.whatsapp_webhook_events;
create policy "service_role_only" on public.whatsapp_webhook_events
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

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
    '/api/jobs/mercado-pago/reconcile',
    '/api/jobs/whatsapp/deliveries/process'
  ];
begin
  if p_path <> all(v_allowed_paths) then
    raise exception 'zalen_internal_job_path_not_allowed';
  end if;

  select decrypted_secret into v_secret
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

do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'zalen-whatsapp-deliveries-process'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

select cron.schedule(
  'zalen-whatsapp-deliveries-process',
  '*/5 * * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/whatsapp/deliveries/process');$command$
);
