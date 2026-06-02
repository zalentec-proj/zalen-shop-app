-- Lightweight multi-store access model.
-- Keeps one app and one database while preparing Zalen global access.

create table if not exists platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null check (role in ('platform_owner', 'platform_admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid not null,
  role text not null check (
    role in ('store_owner', 'store_admin', 'store_operator', 'store_viewer')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, user_id)
);

create table if not exists store_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  provider text not null,
  environment text not null default 'production',
  status text not null default 'disconnected',
  credentials_encrypted text,
  settings_json jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, provider, environment)
);

create index if not exists platform_users_user_id_idx
  on platform_users(user_id);

create index if not exists store_memberships_user_id_idx
  on store_memberships(user_id);

create index if not exists store_memberships_store_id_idx
  on store_memberships(store_id);

create index if not exists store_memberships_store_id_user_id_idx
  on store_memberships(store_id, user_id);

create index if not exists store_integrations_store_id_idx
  on store_integrations(store_id);

create index if not exists store_integrations_store_id_provider_idx
  on store_integrations(store_id, provider);

alter table platform_users enable row level security;
alter table store_memberships enable row level security;
alter table store_integrations enable row level security;

create policy "service_role_only" on platform_users
  using (auth.role() = 'service_role');

create policy "service_role_only" on store_memberships
  using (auth.role() = 'service_role');

create policy "service_role_only" on store_integrations
  using (auth.role() = 'service_role');
