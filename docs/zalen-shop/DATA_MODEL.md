# Modelo de Dados Inicial

## 1. Estratégia

Mesmo sendo uma loja única, usar `store_id` nas tabelas principais para deixar o projeto preparado para futura evolução multi-tenant.

## 2. Core

```sql
stores (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  status text not null,
  created_at timestamptz default now()
)
```

```sql
memberships (
  id uuid primary key,
  user_id uuid not null,
  store_id uuid references stores(id),
  role text not null,
  created_at timestamptz default now()
)
```

## 3. Catálogo

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
  created_at timestamptz default now()
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

## 4. Pedidos

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
  created_at timestamptz default now()
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

## 5. Integrações

```sql
integration_connections (
  id uuid primary key,
  store_id uuid references stores(id),
  provider text not null,
  status text not null,
  scopes text[],
  connected_at timestamptz,
  created_at timestamptz default now()
)
```

```sql
integration_tokens (
  id uuid primary key,
  connection_id uuid references integration_connections(id),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_type text,
  expires_at timestamptz,
  is_jwt boolean default false,
  created_at timestamptz default now()
)
```

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
