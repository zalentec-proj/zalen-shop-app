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

Preço público/default fica em `product_variants.price` e
`product_variants.promotional_price`. Para regras por perfil de comprador, a
Zalen usa tabelas de preço nativas por loja:

```sql
price_lists (
  id uuid primary key,
  store_id uuid references stores(id),
  name text not null,
  code text not null,
  customer_type text not null, -- pf | pj
  status text not null,
  currency text,
  priority integer,
  is_default boolean,
  external_provider text,
  external_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
product_variant_prices (
  id uuid primary key,
  store_id uuid references stores(id),
  variant_id uuid references product_variants(id),
  price_list_id uuid references price_lists(id),
  price numeric(12,2),
  promotional_price numeric(12,2),
  source text,
  external_provider text,
  external_id text,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

O checkout resolve `customer_type` por CPF/CNPJ, escolhe a lista aplicável e
recalcula os itens no servidor. Integrações como Bling podem atualizar preço
base/default, mas não devem sobrescrever preços PJ manuais da Zalen sem vínculo
explícito de lista externa.

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

## 4.1 Clientes

```sql
customers (
  id uuid primary key,
  store_id uuid references stores(id),
  auth_user_id uuid references auth.users(id),
  name text not null,
  email text,
  phone text,
  document text,
  customer_type text,
  legal_name text,
  state_registration text,
  state_registration_exempt boolean,
  source text,
  accepts_marketing boolean,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
customer_addresses (
  id uuid primary key,
  store_id uuid references stores(id),
  customer_id uuid references customers(id),
  label text,
  recipient_name text,
  phone text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text,
  is_default boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Clientes são dados privados por loja. O storefront público não deve ler
`customers` nem `customer_addresses`. Quando o cliente cria login no storefront,
`auth_user_id` vincula a conta Supabase Auth ao cadastro privado daquela store.

## 5. Pedidos

```sql
orders (
  id uuid primary key,
  store_id uuid references stores(id),
  order_number text not null,
  customer_id uuid references customers(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_document text,
  customer_type text,
  customer_legal_name text,
  customer_state_registration text,
  customer_state_registration_exempt boolean,
  shipping_address_json jsonb,
  fiscal_info_json jsonb,
  status text not null,
  payment_status text,
  fulfillment_status text,
  subtotal numeric(12,2),
  shipping_total numeric(12,2),
  shipping_method_id uuid references shipping_methods(id),
  shipping_quote_id uuid references shipping_quotes(id),
  shipping_provider_key text references integration_providers(key),
  shipping_service_code text,
  shipping_service_name text,
  shipping_carrier_name text,
  shipping_delivery_min_days integer,
  shipping_delivery_max_days integer,
  shipping_metadata_json jsonb,
  marketing_context_json jsonb,
  discount_total numeric(12,2),
  total numeric(12,2),
  price_list_id uuid references price_lists(id),
  price_list_name text,
  external_erp_provider text,
  external_erp_id text,
  external_erp_sync_status text,
  external_erp_last_error text,
  external_erp_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Pedidos mantêm snapshot do comprador para preservar o estado da compra mesmo se
o cadastro de cliente for alterado depois.

`marketing_context_json` guarda contexto não sensível da jornada: consentimento,
UTMs, `gclid`, `gbraid`, `wbraid`, `fbclid`, `fbp`, `fbc`, landing page e
referrer. CPF/CNPJ não entra nesse campo.

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
  total numeric(12,2),
  customer_type text,
  price_list_id uuid references price_lists(id),
  price_list_name text
)
```

## 5.1 Frete e envios

Frete é calculado server-side. O checkout não envia valor de frete final; ele
envia apenas a cotação escolhida.

```sql
store_shipping_origins (
  id uuid primary key,
  store_id uuid references stores(id),
  sender_name text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text,
  phone text,
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id)
)
```

```sql
shipping_methods (
  id uuid primary key,
  store_id uuid references stores(id),
  kind text, -- pickup | fixed | manual | external
  provider_key text references integration_providers(key),
  service_code text,
  name text,
  description text,
  status text,
  sort_order integer,
  price numeric(12,2),
  free_over_subtotal numeric(12,2),
  min_delivery_days integer,
  max_delivery_days integer,
  settings_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
shipping_quotes (
  id uuid primary key,
  store_id uuid references stores(id),
  method_id uuid references shipping_methods(id),
  provider_key text references integration_providers(key),
  service_code text,
  carrier_name text,
  service_name text,
  price numeric(12,2),
  delivery_min_days integer,
  delivery_max_days integer,
  destination_postal_code text,
  items_hash text,
  expires_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
shipments (
  id uuid primary key,
  store_id uuid references stores(id),
  order_id uuid references orders(id),
  provider_key text references integration_providers(key),
  external_shipment_id text,
  external_label_id text,
  label_url text,
  label_format text,
  carrier text,
  tracking_code text,
  tracking_url text,
  status text,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

```sql
shipment_events (
  id uuid primary key,
  store_id uuid references stores(id),
  shipment_id uuid references shipments(id),
  provider_key text references integration_providers(key),
  external_event_id text,
  status text,
  description text,
  occurred_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Para o MVP, `store_integrations` continua sendo a fonte de configuração de
providers externos. Não existe `store_shipping_providers` separado.

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
- `mercado_pago` — payment — beta;
- `melhor_envio` — shipping — planned;
- `google_tag_manager` — analytics — beta;
- `ga4` — analytics — beta;
- `google_ads` — analytics — beta;
- `google_merchant_center` — sales_channel — beta;
- `meta_pixel` — analytics — beta;
- `meta_conversions_api` — analytics — beta.

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

Configurações de marketing por provider:

- GTM: `{ enabled, containerId }`
- GA4: `{ enabled, measurementId, debugMode }`
- Google Ads: `{ enabled, conversionId, purchaseConversionLabel, enhancedConversionsEnabled }`
- Merchant Center: `{ enabled, verificationToken, defaultGoogleProductCategory }`
- Meta Pixel: `{ enabled, pixelId }`
- Meta CAPI: `{ enabled, testEventCode }`

Token Meta CAPI fica apenas em `credentials_encrypted`.

## 7.1 Eventos de marketing

```sql
marketing_events (
  id uuid primary key,
  store_id uuid references stores(id),
  provider_key text references integration_providers(key),
  event_name text not null,
  event_id text not null,
  source text not null,
  order_id uuid references orders(id),
  order_number text,
  status text not null,
  occurred_at timestamptz,
  processed_at timestamptz,
  value numeric(12,2),
  currency text,
  payload_json jsonb,
  response_json jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, provider_key, event_name, event_id)
)
```

Uso:

- deduplicar compra server-side;
- registrar diagnóstico seguro de Google Ads/GTM;
- registrar envio Meta CAPI;
- nunca armazenar token, CPF/CNPJ ou PII em claro.

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
orders(shipping_method_id)
orders(shipping_quote_id)
store_shipping_origins(store_id)
shipping_methods(store_id, status)
shipping_quotes(store_id, expires_at)
shipment_events(store_id, shipment_id)
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

## 11. Domínios próprios por loja

`store_domains` mantém um registro por hostname e agrupa apex/`www` por
`configuration_id`. O hostname é normalizado e globalmente único. O ciclo de
vida usa `pending_provisioning`, `pending_ownership`, `pending_dns`,
`pending_ssl`, `ready`, `active`, `redirect`, `failed`, `removing` e `removed`.

Uma partial unique index permite somente um `primary` com status `active` por
loja. `redirect_to_domain_id` liga variantes e domínios antigos ao principal.
Registros DNS e desafios TXT são normalizados em JSON; respostas brutas e tokens
do provedor não são persistidos.

`store_domain_events` registra transições, ator e código seguro de erro. Ambas
as tabelas usam `store_id`, RLS e leitura somente para membros da loja ou papéis
globais. Escrita autenticada direta não é concedida; Server Actions autorizadas
usam o serviço server-side.
