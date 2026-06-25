create table if not exists public.store_email_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'resend'
    check (provider in ('resend')),
  mode text not null default 'platform_managed'
    check (mode in ('platform_managed', 'store_managed')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  sender_name text not null,
  sender_email text not null,
  reply_to_email text,
  domain text,
  domain_status text not null default 'unverified'
    check (domain_status in ('unverified', 'pending', 'verified', 'failed')),
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id)
);

create index if not exists store_email_settings_store_id_idx
  on public.store_email_settings(store_id);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_key text not null,
  recipient_email text not null,
  subject text not null,
  provider text not null default 'resend'
    check (provider in ('resend')),
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  error_code text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_messages_store_created_idx
  on public.email_messages(store_id, created_at desc);

create index if not exists email_messages_store_template_idx
  on public.email_messages(store_id, template_key, created_at desc);

create index if not exists email_messages_provider_message_idx
  on public.email_messages(provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text,
  tracking_code text,
  tracking_url text,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'posted',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'exception',
        'cancelled'
      )
    ),
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipments_store_order_idx
  on public.shipments(store_id, order_id);

create index if not exists shipments_store_status_idx
  on public.shipments(store_id, status);

insert into public.store_email_settings (
  store_id,
  sender_name,
  sender_email,
  reply_to_email,
  domain,
  domain_status
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Brasil Drones & Parts',
  'compras@brasildrones.com.br',
  'compras@brasildrones.com.br',
  'brasildrones.com.br',
  'unverified'
)
on conflict (store_id) do nothing;

alter table public.store_email_settings enable row level security;
alter table public.email_messages enable row level security;
alter table public.shipments enable row level security;

grant select, update on public.store_email_settings to authenticated;
grant select on public.email_messages to authenticated;
grant select, insert, update on public.shipments to authenticated;
grant select, insert, update, delete on public.store_email_settings to service_role;
grant select, insert, update, delete on public.email_messages to service_role;
grant select, insert, update, delete on public.shipments to service_role;

revoke all on public.store_email_settings from anon;
revoke all on public.email_messages from anon;
revoke all on public.shipments from anon;

drop policy if exists "service_role_only" on public.store_email_settings;
create policy "service_role_only" on public.store_email_settings
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_email_settings" on public.store_email_settings;
create policy "store_members_can_read_email_settings" on public.store_email_settings
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
      where store_memberships.store_id = store_email_settings.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_update_email_settings" on public.store_email_settings;
create policy "store_operators_can_update_email_settings" on public.store_email_settings
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
      where store_memberships.store_id = store_email_settings.store_id
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
      where store_memberships.store_id = store_email_settings.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "service_role_only" on public.email_messages;
create policy "service_role_only" on public.email_messages
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_email_messages" on public.email_messages;
create policy "store_members_can_read_email_messages" on public.email_messages
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
    )
  );

drop policy if exists "service_role_only" on public.shipments;
create policy "service_role_only" on public.shipments
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "store_members_can_read_shipments" on public.shipments;
create policy "store_members_can_read_shipments" on public.shipments
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
      where store_memberships.store_id = shipments.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_shipments" on public.shipments;
create policy "store_operators_can_write_shipments" on public.shipments
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
      where store_memberships.store_id = shipments.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_update_shipments" on public.shipments;
create policy "store_operators_can_update_shipments" on public.shipments
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
      where store_memberships.store_id = shipments.store_id
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
      where store_memberships.store_id = shipments.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );
