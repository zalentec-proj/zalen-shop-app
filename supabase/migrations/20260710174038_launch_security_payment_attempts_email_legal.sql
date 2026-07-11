create table if not exists public.security_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, key_hash, window_started_at)
);

create index if not exists security_rate_limit_buckets_expiry_idx
  on public.security_rate_limit_buckets (window_started_at);

alter table public.security_rate_limit_buckets enable row level security;
revoke all on public.security_rate_limit_buckets from anon, authenticated;
grant select, insert, update, delete on public.security_rate_limit_buckets to service_role;

create policy "service_role_only" on public.security_rate_limit_buckets
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create or replace function public.consume_security_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_time timestamptz := clock_timestamp();
  current_window timestamptz;
  current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from current_time) / p_window_seconds) * p_window_seconds
  );

  insert into public.security_rate_limit_buckets (
    scope,
    key_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_scope,
    p_key_hash,
    current_window,
    1,
    current_time
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.security_rate_limit_buckets.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into current_count;

  return query
  select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    case
      when current_count > p_limit then greatest(
        ceil(extract(epoch from current_window + make_interval(secs => p_window_seconds) - current_time))::integer,
        1
      )
      else 0
    end;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago')),
  environment text not null check (environment in ('test', 'production')),
  idempotency_key_hash text not null,
  payment_method_id text,
  payment_type_id text,
  external_payment_id text,
  status text not null default 'created' check (
    status in ('created', 'pending', 'approved', 'rejected', 'cancelled', 'refunded', 'error')
  ),
  status_detail text,
  amount numeric(12,2) not null,
  instructions_json jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(store_id, order_id, provider, idempotency_key_hash)
);

create unique index if not exists payment_attempts_provider_external_payment_uidx
  on public.payment_attempts (provider, external_payment_id)
  where external_payment_id is not null and external_payment_id <> '';

create index if not exists payment_attempts_pending_idx
  on public.payment_attempts (store_id, status, updated_at asc)
  where status in ('created', 'pending');

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;
grant select, insert, update, delete on public.payment_attempts to service_role;

create policy "service_role_only" on public.payment_attempts
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

alter table public.email_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists suppressed_at timestamptz,
  add column if not exists last_provider_event_id text;

alter table public.email_messages
  drop constraint if exists email_messages_status_check;

alter table public.email_messages
  add constraint email_messages_status_check check (
    status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'suppressed', 'failed', 'skipped')
  );

create unique index if not exists email_messages_provider_event_uidx
  on public.email_messages (provider, last_provider_event_id)
  where last_provider_event_id is not null and last_provider_event_id <> '';

create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('resend')),
  external_id text not null,
  provider_message_id text,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, external_id)
);

alter table public.email_webhook_events enable row level security;
revoke all on public.email_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.email_webhook_events to service_role;

create policy "service_role_only" on public.email_webhook_events
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_email_messages" on public.email_messages;
create policy "store_operators_can_read_email_messages" on public.email_messages
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
      where store_memberships.store_id = email_messages.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

create table if not exists public.store_legal_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  document_key text not null check (
    document_key in ('privacy', 'terms', 'returns', 'contact')
  ),
  title text not null,
  content text not null,
  version text not null default 'draft',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, document_key)
);

alter table public.store_legal_documents enable row level security;
revoke all on public.store_legal_documents from anon;
grant select on public.store_legal_documents to anon, authenticated;
grant insert, update, delete on public.store_legal_documents to authenticated;
grant select, insert, update, delete on public.store_legal_documents to service_role;

create policy "public_can_read_published_store_legal_documents" on public.store_legal_documents
  for select
  to anon, authenticated
  using (status = 'published');

create policy "store_members_can_read_store_legal_documents" on public.store_legal_documents
  for select
  to authenticated
  using (
    exists (
      select 1 from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1 from public.store_memberships
      where store_memberships.store_id = store_legal_documents.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

create policy "store_operators_can_write_store_legal_documents" on public.store_legal_documents
  for all
  to authenticated
  using (
    exists (
      select 1 from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1 from public.store_memberships
      where store_memberships.store_id = store_legal_documents.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1 from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1 from public.store_memberships
      where store_memberships.store_id = store_legal_documents.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );
