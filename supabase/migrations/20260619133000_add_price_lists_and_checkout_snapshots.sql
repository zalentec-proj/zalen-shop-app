-- Native Zalen price lists and PF/PJ checkout snapshots.
-- Price calculation stays server-side; storefront clients never define charged prices.

create table if not exists price_lists (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  code text not null,
  customer_type text not null default 'pf'
    check (customer_type in ('pf', 'pj')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  currency text not null default 'BRL',
  priority integer not null default 0,
  is_default boolean not null default false,
  external_provider text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, code)
);

create unique index if not exists price_lists_store_customer_type_default_uidx
  on price_lists(store_id, customer_type)
  where is_default;

create index if not exists price_lists_store_id_idx
  on price_lists(store_id);

create index if not exists price_lists_store_customer_type_idx
  on price_lists(store_id, customer_type, status);

create table if not exists product_variant_prices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  price_list_id uuid not null references price_lists(id) on delete cascade,
  price numeric(12,2) not null default 0,
  promotional_price numeric(12,2),
  source text not null default 'manual'
    check (source in ('manual', 'integration')),
  external_provider text,
  external_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, variant_id, price_list_id)
);

create index if not exists product_variant_prices_store_id_idx
  on product_variant_prices(store_id);

create index if not exists product_variant_prices_variant_idx
  on product_variant_prices(store_id, variant_id);

create index if not exists product_variant_prices_price_list_idx
  on product_variant_prices(store_id, price_list_id);

alter table customers
  add column if not exists customer_type text not null default 'pf'
    check (customer_type in ('pf', 'pj')),
  add column if not exists legal_name text,
  add column if not exists state_registration text,
  add column if not exists state_registration_exempt boolean not null default false;

create index if not exists customers_store_customer_type_idx
  on customers(store_id, customer_type);

alter table orders
  add column if not exists customer_type text
    check (customer_type in ('pf', 'pj')),
  add column if not exists customer_legal_name text,
  add column if not exists customer_state_registration text,
  add column if not exists customer_state_registration_exempt boolean not null default false,
  add column if not exists price_list_id uuid,
  add column if not exists price_list_name text,
  add column if not exists fiscal_info_json jsonb not null default '{}'::jsonb;

alter table order_items
  add column if not exists customer_type text
    check (customer_type in ('pf', 'pj')),
  add column if not exists price_list_id uuid,
  add column if not exists price_list_name text;

create index if not exists orders_store_customer_type_idx
  on orders(store_id, customer_type);

create index if not exists orders_store_price_list_idx
  on orders(store_id, price_list_id);

create index if not exists order_items_store_price_list_idx
  on order_items(store_id, price_list_id);

insert into price_lists (store_id, name, code, customer_type, is_default, priority)
select stores.id, 'PF padrão', 'pf_default', 'pf', true, 10
from stores
where not exists (
  select 1
  from price_lists
  where price_lists.store_id = stores.id
    and price_lists.code = 'pf_default'
);

insert into price_lists (store_id, name, code, customer_type, is_default, priority)
select stores.id, 'PJ empresa', 'pj_business', 'pj', true, 20
from stores
where not exists (
  select 1
  from price_lists
  where price_lists.store_id = stores.id
    and price_lists.code = 'pj_business'
);

alter table price_lists enable row level security;
alter table product_variant_prices enable row level security;

grant select, insert, update on price_lists to authenticated;
grant select, insert, update on product_variant_prices to authenticated;
revoke all on price_lists from anon;
revoke all on product_variant_prices from anon;

drop policy if exists "service_role_only" on price_lists;
create policy "service_role_only" on price_lists
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "store_members_can_read_price_lists" on price_lists;
create policy "store_members_can_read_price_lists" on price_lists
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
      where store_memberships.store_id = price_lists.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "store_operators_can_write_price_lists" on price_lists;
create policy "store_operators_can_write_price_lists" on price_lists
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
      where store_memberships.store_id = price_lists.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_update_price_lists" on price_lists;
create policy "store_operators_can_update_price_lists" on price_lists
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
      where store_memberships.store_id = price_lists.store_id
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
      where store_memberships.store_id = price_lists.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "service_role_only" on product_variant_prices;
create policy "service_role_only" on product_variant_prices
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "store_members_can_read_product_variant_prices" on product_variant_prices;
create policy "store_members_can_read_product_variant_prices" on product_variant_prices
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
      where store_memberships.store_id = product_variant_prices.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "store_operators_can_write_product_variant_prices" on product_variant_prices;
create policy "store_operators_can_write_product_variant_prices" on product_variant_prices
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
      where store_memberships.store_id = product_variant_prices.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_update_product_variant_prices" on product_variant_prices;
create policy "store_operators_can_update_product_variant_prices" on product_variant_prices
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
      where store_memberships.store_id = product_variant_prices.store_id
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
      where store_memberships.store_id = product_variant_prices.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );
