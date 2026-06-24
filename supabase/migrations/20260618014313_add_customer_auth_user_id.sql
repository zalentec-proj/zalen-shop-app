alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists customers_store_auth_user_idx
  on public.customers (store_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists customers_store_auth_user_uidx
  on public.customers (store_id, auth_user_id)
  where auth_user_id is not null;
