create table if not exists public.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  attempt_key text not null,
  cart_hash text not null,
  customer_hash text not null,
  status text not null default 'processing',
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  provider text not null default 'mercado_pago',
  provider_reference text,
  checkout_url text,
  sandbox_checkout_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint checkout_attempts_provider_check
    check (provider in ('mercado_pago')),
  constraint checkout_attempts_status_check
    check (status in ('processing', 'preference_created', 'error'))
);

create unique index if not exists checkout_attempts_store_attempt_key_idx
  on public.checkout_attempts (store_id, attempt_key);

create index if not exists checkout_attempts_store_status_idx
  on public.checkout_attempts (store_id, status, created_at desc);

create index if not exists checkout_attempts_order_id_idx
  on public.checkout_attempts (order_id)
  where order_id is not null;

alter table public.checkout_attempts enable row level security;

revoke all on public.checkout_attempts from anon;
grant select, insert, update, delete on public.checkout_attempts to service_role;

drop policy if exists "service_role_only" on public.checkout_attempts;
create policy "service_role_only" on public.checkout_attempts
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop index if exists public.payment_transactions_provider_external_payment_idx;

create unique index if not exists payment_transactions_provider_external_payment_uidx
  on public.payment_transactions (provider, external_payment_id)
  where external_payment_id is not null
    and external_payment_id <> '';
