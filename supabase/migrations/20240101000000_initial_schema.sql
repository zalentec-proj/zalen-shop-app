-- ============================================================
-- Migration inicial — Zalen Shop / Brasil Drones
-- Criada em: 2024-01-01
-- Todas as tabelas nascem com store_id para suporte futuro multi-tenant
-- ============================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE
-- ============================================================

create table stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  store_id uuid references stores(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  unique(user_id, store_id)
);

-- ============================================================
-- CATÁLOGO
-- ============================================================

create table products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  external_provider text,
  external_id text,
  name text not null,
  slug text not null,
  description text,
  brand text,
  status text not null default 'active',
  seo_title text,
  seo_description text,
  requires_shipping boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, slug)
);

create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  external_id text,
  sku text,
  price numeric(12,2) not null default 0,
  promotional_price numeric(12,2),
  stock integer default 0,
  weight numeric(12,3),
  width numeric(12,3),
  height numeric(12,3),
  depth numeric(12,3),
  attributes_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table product_images (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  url text not null,
  position integer default 0,
  alt text
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  parent_id uuid references categories(id) on delete set null,
  external_id text,
  name text not null,
  slug text not null,
  position integer default 0,
  unique(store_id, slug)
);

create table product_categories (
  product_id uuid references products(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (product_id, category_id)
);

-- ============================================================
-- PEDIDOS
-- ============================================================

create table orders (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  order_number text not null,
  customer_id uuid,
  status text not null default 'pending',
  payment_status text default 'pending',
  fulfillment_status text default 'unfulfilled',
  subtotal numeric(12,2) default 0,
  shipping_total numeric(12,2) default 0,
  discount_total numeric(12,2) default 0,
  total numeric(12,2) default 0,
  external_erp_provider text,
  external_erp_id text,
  created_at timestamptz default now(),
  unique(store_id, order_number)
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  sku text,
  name text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null
);

-- ============================================================
-- INTEGRAÇÕES
-- ============================================================

create table integration_connections (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  scopes text[],
  connected_at timestamptz,
  created_at timestamptz default now(),
  unique(store_id, provider)
);

create table integration_tokens (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid references integration_connections(id) on delete cascade,
  -- Tokens são sempre criptografados — nunca texto puro
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_type text,
  expires_at timestamptz,
  is_jwt boolean default false,
  created_at timestamptz default now()
);

create table webhook_events (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  provider text not null,
  event_type text,
  external_id text,
  signature_valid boolean,
  payload jsonb not null,
  status text not null default 'received',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

create table sync_jobs (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  provider text not null,
  job_type text not null,
  status text not null default 'pending',
  attempts integer default 0,
  payload jsonb,
  last_error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- ============================================================
-- RLS — Row Level Security
-- Ativar em todas as tabelas sensíveis.
-- Policies conservadoras: negar tudo por padrão.
-- Policies reais serão adicionadas quando Auth estiver configurado.
-- ============================================================

alter table stores enable row level security;
alter table memberships enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table categories enable row level security;
alter table product_categories enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table integration_connections enable row level security;
alter table integration_tokens enable row level security;
alter table webhook_events enable row level security;
alter table sync_jobs enable row level security;

-- Policy temporária: apenas service_role tem acesso (backend)
-- Remover e substituir por policies baseadas em memberships quando Auth estiver pronto

create policy "service_role_only" on stores
  using (auth.role() = 'service_role');

create policy "service_role_only" on memberships
  using (auth.role() = 'service_role');

create policy "service_role_only" on products
  using (auth.role() = 'service_role');

create policy "service_role_only" on product_variants
  using (auth.role() = 'service_role');

create policy "service_role_only" on product_images
  using (auth.role() = 'service_role');

create policy "service_role_only" on categories
  using (auth.role() = 'service_role');

create policy "service_role_only" on product_categories
  using (auth.role() = 'service_role');

create policy "service_role_only" on orders
  using (auth.role() = 'service_role');

create policy "service_role_only" on order_items
  using (auth.role() = 'service_role');

create policy "service_role_only" on integration_connections
  using (auth.role() = 'service_role');

create policy "service_role_only" on integration_tokens
  using (auth.role() = 'service_role');

create policy "service_role_only" on webhook_events
  using (auth.role() = 'service_role');

create policy "service_role_only" on sync_jobs
  using (auth.role() = 'service_role');
