alter table payment_transactions
  add column if not exists external_payment_id text,
  add column if not exists raw_status text,
  add column if not exists raw_status_detail text,
  add column if not exists approved_at timestamptz,
  add column if not exists processed_at timestamptz;

create index if not exists payment_transactions_provider_external_payment_idx
  on payment_transactions (provider, external_payment_id)
  where external_payment_id is not null;
