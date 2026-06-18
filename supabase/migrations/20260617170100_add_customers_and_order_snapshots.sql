-- Customers and order buyer snapshots for Zalen Shop operational admin.
-- Customer data is private store data and must never be readable by anon.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  document text,
  source text not null default 'manual'
    check (source in ('manual', 'checkout', 'integration')),
  accepts_marketing boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, email),
  unique(store_id, document)
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null default 'Principal',
  recipient_name text,
  phone text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text not null default 'BR',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_store_id_idx
  on customers(store_id);

create index if not exists customers_store_id_name_idx
  on customers(store_id, name);

create index if not exists customer_addresses_store_id_idx
  on customer_addresses(store_id);

create index if not exists customer_addresses_customer_id_idx
  on customer_addresses(customer_id);

alter table orders
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists customer_document text,
  add column if not exists shipping_address_json jsonb not null default '{}'::jsonb,
  add column if not exists external_erp_sync_status text not null default 'pending'
    check (external_erp_sync_status in ('pending', 'synced', 'error', 'skipped')),
  add column if not exists external_erp_last_error text,
  add column if not exists external_erp_synced_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_id_customers_id_fkey'
  ) then
    alter table orders
      add constraint orders_customer_id_customers_id_fkey
      foreign key (customer_id) references customers(id)
      on delete set null
      not valid;
  end if;
end $$;

create index if not exists orders_store_id_customer_id_idx
  on orders(store_id, customer_id);

create index if not exists orders_store_id_external_erp_status_idx
  on orders(store_id, external_erp_sync_status);

alter table customers enable row level security;
alter table customer_addresses enable row level security;

grant select, insert, update on customers to authenticated;
grant select, insert, update on customer_addresses to authenticated;
revoke all on customers from anon;
revoke all on customer_addresses from anon;

create policy "service_role_only" on customers
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_only" on customer_addresses
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "store_members_can_read_customers" on customers
  for select
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customers.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

create policy "store_operators_can_write_customers" on customers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customers.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

create policy "store_operators_can_update_customers" on customers
  for update
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customers.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customers.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

create policy "store_members_can_read_customer_addresses" on customer_addresses
  for select
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customer_addresses.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

create policy "store_operators_can_write_customer_addresses" on customer_addresses
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customer_addresses.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

create policy "store_operators_can_update_customer_addresses" on customer_addresses
  for update
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customer_addresses.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = customer_addresses.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );
