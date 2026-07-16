create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  hostname text not null,
  apex_hostname text not null,
  preferred_primary_variant text not null default 'www',
  domain_role text not null default 'primary',
  status text not null default 'pending_provisioning',
  redirect_to_domain_id uuid,
  dns_records jsonb not null default '[]'::jsonb,
  verification_records jsonb not null default '[]'::jsonb,
  last_error_code text,
  attempts integer not null default 0,
  next_check_at timestamptz,
  last_checked_at timestamptz,
  verified_at timestamptz,
  activated_at timestamptz,
  removed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_domains_hostname_normalized
    check (hostname = lower(hostname) and hostname !~ '[:/[:space:]]'),
  constraint store_domains_apex_hostname_normalized
    check (apex_hostname = lower(apex_hostname) and apex_hostname !~ '[:/[:space:]]'),
  constraint store_domains_role_valid
    check (domain_role in ('primary', 'redirect')),
  constraint store_domains_preferred_primary_valid
    check (preferred_primary_variant in ('www', 'apex')),
  constraint store_domains_status_valid
    check (status in (
      'pending_provisioning',
      'pending_ownership',
      'pending_dns',
      'pending_ssl',
      'ready',
      'active',
      'redirect',
      'failed',
      'removing',
      'removed'
    )),
  constraint store_domains_attempts_nonnegative check (attempts >= 0),
  constraint store_domains_redirect_not_self
    check (redirect_to_domain_id is null or redirect_to_domain_id <> id),
  unique (hostname),
  unique (id, store_id),
  constraint store_domains_redirect_same_store_fkey
    foreign key (redirect_to_domain_id, store_id)
    references public.store_domains(id, store_id)
    on delete no action
);

create index if not exists store_domains_store_created_at_idx
  on public.store_domains(store_id, created_at desc);

create index if not exists store_domains_configuration_id_idx
  on public.store_domains(configuration_id);

create index if not exists store_domains_redirect_to_domain_id_idx
  on public.store_domains(redirect_to_domain_id)
  where redirect_to_domain_id is not null;

create index if not exists store_domains_created_by_idx
  on public.store_domains(created_by);

create index if not exists store_domains_due_verification_idx
  on public.store_domains(status, next_check_at)
  where status in (
    'pending_provisioning',
    'pending_ownership',
    'pending_dns',
    'pending_ssl',
    'failed'
  );

create unique index if not exists store_domains_one_active_primary_per_store_idx
  on public.store_domains(store_id)
  where status = 'active' and domain_role = 'primary';

create table if not exists public.store_domain_events (
  id uuid primary key default gen_random_uuid(),
  store_domain_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  error_code text,
  details_json jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint store_domain_events_safe_details_object
    check (jsonb_typeof(details_json) = 'object'),
  constraint store_domain_events_domain_store_fkey
    foreign key (store_domain_id, store_id)
    references public.store_domains(id, store_id)
    on delete cascade
);

create index if not exists store_domain_events_domain_created_at_idx
  on public.store_domain_events(store_domain_id, created_at desc);

create index if not exists store_domain_events_store_created_at_idx
  on public.store_domain_events(store_id, created_at desc);

create index if not exists store_domain_events_actor_id_idx
  on public.store_domain_events(actor_id)
  where actor_id is not null;

create or replace function public.set_store_domains_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_store_domains_updated_at on public.store_domains;
create trigger set_store_domains_updated_at
before update on public.store_domains
for each row execute function public.set_store_domains_updated_at();

alter table public.store_domains enable row level security;
alter table public.store_domain_events enable row level security;

revoke all on public.store_domains from anon, authenticated;
revoke all on public.store_domain_events from anon, authenticated;
grant select on public.store_domains to authenticated;
grant select on public.store_domain_events to authenticated;
grant all on public.store_domains to service_role;
grant all on public.store_domain_events to service_role;

drop policy if exists "store_members_can_read_store_domains" on public.store_domains;
create policy "store_members_can_read_store_domains"
on public.store_domains
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_users
    where platform_users.user_id = (select auth.uid())
      and platform_users.role in ('platform_owner', 'platform_admin')
  )
  or exists (
    select 1
    from public.store_memberships
    where store_memberships.store_id = store_domains.store_id
      and store_memberships.user_id = (select auth.uid())
  )
);

drop policy if exists "store_members_can_read_store_domain_events" on public.store_domain_events;
create policy "store_members_can_read_store_domain_events"
on public.store_domain_events
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_users
    where platform_users.user_id = (select auth.uid())
      and platform_users.role in ('platform_owner', 'platform_admin')
  )
  or exists (
    select 1
    from public.store_memberships
    where store_memberships.store_id = store_domain_events.store_id
      and store_memberships.user_id = (select auth.uid())
  )
);

create or replace function public.activate_store_domain(
  p_domain_id uuid,
  p_store_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.store_domains%rowtype;
begin
  perform 1
  from public.store_domains
  where store_id = p_store_id
  order by id
  for update;

  select *
  into v_target
  from public.store_domains
  where id = p_domain_id
    and store_id = p_store_id
    and status in ('ready', 'active', 'redirect')
  ;

  if not found then
    raise exception 'store_domain_not_ready';
  end if;

  update public.store_domains
  set status = 'redirect',
      domain_role = 'redirect',
      redirect_to_domain_id = p_domain_id
  where store_id = p_store_id
    and id <> p_domain_id
    and status in ('active', 'ready', 'redirect');

  update public.store_domains
  set status = 'active',
      domain_role = 'primary',
      redirect_to_domain_id = null,
      activated_at = coalesce(activated_at, now()),
      last_error_code = null
  where id = p_domain_id
    and store_id = p_store_id;

  insert into public.store_domain_events (
    store_domain_id,
    store_id,
    event_type,
    from_status,
    to_status,
    actor_id
  ) values (
    p_domain_id,
    p_store_id,
    'domain_activated',
    v_target.status,
    'active',
    p_actor_id
  );
end;
$$;

revoke all on function public.activate_store_domain(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_store_domain(uuid, uuid, uuid)
  to service_role;

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
    '/api/jobs/domains/verify'
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
    where jobname = 'zalen-domains-verify'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$jobs$;

select cron.schedule(
  'zalen-domains-verify',
  '*/5 * * * *',
  $command$select private.invoke_zalen_internal_job('/api/jobs/domains/verify');$command$
);
