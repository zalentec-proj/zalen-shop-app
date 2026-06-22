create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  external_reference text not null,
  status text not null default 'created',
  amount numeric(12,2) not null default 0,
  checkout_url text,
  sandbox_checkout_url text,
  last_error text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_provider_check
    check (provider in ('mercado_pago')),
  constraint payment_transactions_status_check
    check (
      status in (
        'created',
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'refunded',
        'error'
      )
    )
);

create unique index if not exists payment_transactions_store_order_provider_idx
  on payment_transactions (store_id, order_id, provider);

create index if not exists payment_transactions_store_provider_status_idx
  on payment_transactions (store_id, provider, status);

create index if not exists payment_transactions_provider_reference_idx
  on payment_transactions (provider, provider_reference);

alter table payment_transactions enable row level security;

revoke all on payment_transactions from anon;
grant select, insert, update, delete on payment_transactions to service_role;

drop policy if exists "service_role_only" on payment_transactions;
create policy "service_role_only" on payment_transactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
