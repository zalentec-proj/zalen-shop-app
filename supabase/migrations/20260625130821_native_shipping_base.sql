create table if not exists public.store_shipping_origins (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sender_name text not null,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  country text not null default 'BR',
  phone text,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id)
);

create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null
    check (kind in ('pickup', 'fixed', 'manual', 'external')),
  provider_key text references public.integration_providers(key),
  service_code text not null,
  name text not null,
  description text,
  status text not null default 'disabled'
    check (status in ('active', 'disabled')),
  sort_order integer not null default 0,
  price numeric(12,2) not null default 0,
  free_over_subtotal numeric(12,2),
  min_delivery_days integer,
  max_delivery_days integer,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shipping_methods_store_service_idx
  on public.shipping_methods(store_id, kind, coalesce(provider_key, ''), service_code);

create table if not exists public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  method_id uuid references public.shipping_methods(id) on delete set null,
  provider_key text references public.integration_providers(key),
  service_code text not null,
  carrier_name text,
  service_name text not null,
  price numeric(12,2) not null default 0,
  delivery_min_days integer,
  delivery_max_days integer,
  destination_postal_code text not null,
  items_hash text not null,
  expires_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  provider_key text references public.integration_providers(key),
  external_event_id text,
  status text not null,
  description text,
  occurred_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists shipping_method_id uuid references public.shipping_methods(id) on delete set null,
  add column if not exists shipping_quote_id uuid references public.shipping_quotes(id) on delete set null,
  add column if not exists shipping_provider_key text references public.integration_providers(key),
  add column if not exists shipping_service_code text,
  add column if not exists shipping_service_name text,
  add column if not exists shipping_carrier_name text,
  add column if not exists shipping_delivery_min_days integer,
  add column if not exists shipping_delivery_max_days integer,
  add column if not exists shipping_metadata_json jsonb not null default '{}'::jsonb;

alter table public.shipments
  add column if not exists provider_key text references public.integration_providers(key),
  add column if not exists external_shipment_id text,
  add column if not exists external_label_id text,
  add column if not exists label_url text,
  add column if not exists label_format text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

create index if not exists store_shipping_origins_store_status_idx
  on public.store_shipping_origins(store_id, status);

create index if not exists shipping_methods_store_status_idx
  on public.shipping_methods(store_id, status, sort_order);

create index if not exists shipping_methods_provider_idx
  on public.shipping_methods(provider_key)
  where provider_key is not null;

create index if not exists shipping_quotes_store_expires_idx
  on public.shipping_quotes(store_id, expires_at);

create index if not exists shipping_quotes_store_hash_idx
  on public.shipping_quotes(store_id, items_hash, destination_postal_code);

create index if not exists shipping_quotes_method_id_idx
  on public.shipping_quotes(method_id)
  where method_id is not null;

create index if not exists orders_shipping_method_idx
  on public.orders(shipping_method_id)
  where shipping_method_id is not null;

create index if not exists orders_shipping_quote_idx
  on public.orders(shipping_quote_id)
  where shipping_quote_id is not null;

create index if not exists shipments_provider_external_idx
  on public.shipments(store_id, provider_key, external_shipment_id)
  where external_shipment_id is not null;

create index if not exists shipment_events_store_shipment_idx
  on public.shipment_events(store_id, shipment_id, created_at desc);

create index if not exists shipment_events_provider_external_idx
  on public.shipment_events(provider_key, external_event_id)
  where provider_key is not null and external_event_id is not null;

insert into public.shipping_methods (
  store_id,
  kind,
  service_code,
  name,
  description,
  status,
  sort_order,
  price,
  free_over_subtotal,
  min_delivery_days,
  max_delivery_days,
  settings_json
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'fixed',
    'fixed-standard',
    'Entrega Brasil Drones',
    'Frete fixo operacional enquanto cotações externas não estão ativas.',
    'active',
    10,
    49.90,
    500.00,
    2,
    4,
    '{"mode":"native"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'pickup',
    'pickup-local',
    'Retirada na loja',
    'Retirada local liberada somente após origem ativa cadastrada.',
    'disabled',
    20,
    0,
    null,
    0,
    0,
    '{"requires_active_origin":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'manual',
    'manual-delivery',
    'Entrega manual',
    'Entrega operacional configurada manualmente pela loja.',
    'disabled',
    30,
    0,
    null,
    2,
    5,
    '{"mode":"manual"}'::jsonb
  )
on conflict do nothing;

alter table public.store_shipping_origins enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.shipment_events enable row level security;

grant select, insert, update on public.store_shipping_origins to authenticated;
grant select, insert, update on public.shipping_methods to authenticated;
grant select on public.shipping_quotes to authenticated;
grant select, insert, update on public.shipment_events to authenticated;

grant select, insert, update, delete on public.store_shipping_origins to service_role;
grant select, insert, update, delete on public.shipping_methods to service_role;
grant select, insert, update, delete on public.shipping_quotes to service_role;
grant select, insert, update, delete on public.shipment_events to service_role;

revoke all on public.store_shipping_origins from anon;
revoke all on public.shipping_methods from anon;
revoke all on public.shipping_quotes from anon;
revoke all on public.shipment_events from anon;

drop policy if exists "service_role_only" on public.store_shipping_origins;
create policy "service_role_only" on public.store_shipping_origins
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_shipping_origins" on public.store_shipping_origins;
create policy "store_members_can_read_shipping_origins" on public.store_shipping_origins
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
      where store_memberships.store_id = store_shipping_origins.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_shipping_origins" on public.store_shipping_origins;
create policy "store_operators_can_write_shipping_origins" on public.store_shipping_origins
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = store_shipping_origins.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_update_shipping_origins" on public.store_shipping_origins;
create policy "store_operators_can_update_shipping_origins" on public.store_shipping_origins
  for update
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
      where store_memberships.store_id = store_shipping_origins.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = store_shipping_origins.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "service_role_only" on public.shipping_methods;
create policy "service_role_only" on public.shipping_methods
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_shipping_methods" on public.shipping_methods;
create policy "store_members_can_read_shipping_methods" on public.shipping_methods
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
      where store_memberships.store_id = shipping_methods.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_update_shipping_methods" on public.shipping_methods;
create policy "store_operators_can_update_shipping_methods" on public.shipping_methods
  for update
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
      where store_memberships.store_id = shipping_methods.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = shipping_methods.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "service_role_only" on public.shipping_quotes;
create policy "service_role_only" on public.shipping_quotes
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_shipping_quotes" on public.shipping_quotes;
create policy "store_members_can_read_shipping_quotes" on public.shipping_quotes
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
      where store_memberships.store_id = shipping_quotes.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "service_role_only" on public.shipment_events;
create policy "service_role_only" on public.shipment_events
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_shipment_events" on public.shipment_events;
create policy "store_members_can_read_shipment_events" on public.shipment_events
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
      where store_memberships.store_id = shipment_events.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_shipment_events" on public.shipment_events;
create policy "store_operators_can_write_shipment_events" on public.shipment_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = shipment_events.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );
