# Modelo de Dados — Zalen Shop

## 1. Estratégia

A Zalen Shop usa um único banco Supabase para múltiplas lojas. A separação entre lojas acontece por `store_id`.

O modelo deve ser leve no MVP, mas preparado para:

- múltiplas stores;
- acesso global Zalen;
- acesso por loja;
- conectores globais da plataforma;
- conectores configurados por loja;
- catálogo;
- pedidos;
- webhooks;
- logs de integração.

## 2. Stores

```sql
stores (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  status text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Exemplos:

- Brasil Drones
- LB London futura

## 3. Acesso

### Platform users

Usuários da Zalen com acesso global.

```sql
platform_users (
  id uuid primary key,
  user_id uuid not null unique,
  role text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Roles:

- `platform_owner`
- `platform_admin`

### Store memberships

Usuários vinculados a uma loja específica.

```sql
store_memberships (
  id uuid primary key,
  store_id uuid references stores(id),
  user_id uuid not null,
  role text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, user_id)
)
```

Roles:

- `store_owner`
- `store_admin`
- `store_operator`
- `store_viewer`

## 4. Catálogo

```sql
products (
  id uuid primary key,
  store_id uuid references stores(id),
  external_provider text,
  external_id text,
  name text not null,
  slug text not null,
  description text,
  brand text,
  status text not null,
  seo_title text,
  seo_description text,
  requires_shipping boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
product_variants (
  id uuid primary key,
  store_id uuid references stores(id),
  product_id uuid references products(id),
  external_id text,
  sku text,
  price numeric(12,2),
  promotional_price numeric(12,2),
  stock integer default 0,
  weight numeric(12,3),
  width numeric(12,3),
  height numeric(12,3),
  depth numeric(12,3),
  attributes_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
product_images (
  id uuid primary key,
  store_id uuid references stores(id),
  product_id uuid references products(id),
  variant_id uuid,
  url text not null,
  position integer default 0,
  alt text
)
```

```sql
categories (
  id uuid primary key,
  store_id uuid references stores(id),
  parent_id uuid,
  external_id text,
  name text not null,
  slug text not null,
  position integer default 0
)
```

```sql
product_categories (
  product_id uuid references products(id),
  category_id uuid references categories(id),
  primary key (product_id, category_id)
)
```

## 5. Pedidos

```sql
orders (
  id uuid primary key,
  store_id uuid references stores(id),
  order_number text not null,
  customer_id uuid,
  status text not null,
  payment_status text,
  fulfillment_status text,
  subtotal numeric(12,2),
  shipping_total numeric(12,2),
  discount_total numeric(12,2),
  total numeric(12,2),
  external_erp_provider text,
  external_erp_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
order_items (
  id uuid primary key,
  store_id uuid references stores(id),
  order_id uuid references orders(id),
  product_id uuid,
  variant_id uuid,
  sku text,
  name text,
  quantity integer,
  unit_price numeric(12,2),
  total numeric(12,2)
)
```

## 6. Conectores globais

### integration_providers

Representa o catálogo global de conectores existentes na plataforma.

```sql
integration_providers (
  id uuid primary key,
  key text not null unique,
  name text not null,
  category text not null,
  status text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Categorias:

- `erp`
- `payment`
- `shipping`
- `sales_channel`
- `ai`
- `analytics`

Status:

- `planned`
- `beta`
- `available`
- `deprecated`

Exemplos iniciais:

- `bling` — ERP — available/planned conforme estágio;
- `mercos` — ERP — planned;
- `mercado_pago` — payment — planned;
- `melhor_envio` — shipping — planned.

## 7. Conectores por loja

### store_integrations

Representa uma integração habilitada/configurada em uma loja.

```sql
store_integrations (
  id uuid primary key,
  store_id uuid references stores(id),
  provider_key text not null references integration_providers(key),
  environment text not null,
  status text not null,
  credentials_encrypted text,
  settings_json jsonb default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, provider_key, environment)
)
```

Exemplos:

- Brasil Drones → Bling
- LB London → Mercos

Credenciais sempre pertencem à loja e nunca ao frontend.

## 8. Webhooks e jobs

```sql
webhook_events (
  id uuid primary key,
  store_id uuid references stores(id),
  provider text not null,
  event_type text,
  external_id text,
  signature_valid boolean,
  payload jsonb not null,
  status text not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz default now()
)
```

```sql
sync_jobs (
  id uuid primary key,
  store_id uuid references stores(id),
  provider text not null,
  job_type text not null,
  status text not null,
  attempts integer default 0,
  payload jsonb,
  last_error text,
  created_at timestamptz default now(),
  processed_at timestamptz
)
```

## 9. Índices essenciais

```sql
stores(slug)
products(store_id)
products(store_id, slug)
product_variants(store_id)
categories(store_id)
orders(store_id)
orders(store_id, created_at)
platform_users(user_id)
store_memberships(user_id)
store_memberships(store_id)
store_memberships(store_id, user_id)
integration_providers(key)
store_integrations(store_id)
store_integrations(store_id, provider_key)
webhook_events(store_id, provider)
sync_jobs(store_id, provider, status)
```

## 10. Regra central

Se a tabela contém dado de uma loja, ela deve carregar `store_id` e respeitar isolamento por loja.
