# Arquitetura — Zalen Shop

## 1. Estratégia

A primeira versão será single-tenant para Brasil Drones, mas tenant-ready. Mesmo existindo apenas uma loja, as tabelas centrais devem nascer com `store_id`.

## 2. Stack inicial

O repositório atual usa Next.js, React, TypeScript e Tailwind. A migração para App Router permite manter dados sensíveis em Server Components, Route Handlers e services server-side.

Stack alvo:

- React
- TypeScript
- Next.js App Router
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- React Hook Form
- TanStack Query
- Lucide React
- Motion/Framer Motion com moderação

## 3. Camadas

```txt
Storefront
↓
Application Services
↓
Domain Modules
↓
Database / Connectors
↓
External APIs
```

## 4. Módulos

```txt
src/
  app/
  components/
  modules/
    catalog/
    cart/
    orders/
    checkout/
    integrations/
    theme/
    shipping/
    payments/
  lib/
  server/
  types/
```

## 5. Regra de arquitetura

A interface visual não pode chamar APIs externas diretamente.

Errado:

```txt
ProductPage → Bling API
Checkout → Mercado Pago direto
```

Certo:

```txt
ProductPage → banco/cache Zalen
OrderService → BlingConnector
PaymentService → MercadoPagoConnector
```

## 6. Integrações

Cada integração deve ser um conector isolado com:

- client;
- service;
- types;
- logs;
- tratamento de erro;
- retries;
- idempotência em operações críticas.

## 7. Ambientes

- development
- staging
- production

Cada ambiente deve ter variáveis, banco e credenciais separadas.

## Lightweight multi-store architecture

A Zalen Shop deve nascer multi-store ready sem adicionar complexidade desnecessária ao MVP.

Decisão estrutural:

- uma única aplicação Next.js;
- um único banco Supabase;
- múltiplas lojas separadas por `store_id`;
- uma mesma base de código atende storefront, admin operacional e futuras áreas internas;
- Zalen pode ter acesso global como dona da plataforma;
- clientes acessam apenas lojas às quais estão vinculados por `store_id`;
- `/admin` continua sendo o painel operacional da loja;
- `/platform` será uma área futura para operação interna da Zalen, mas não será criada agora.

Fluxo de acesso previsto:

```txt
Request server-side
↓
Supabase Auth user
↓
platform_users ou store_memberships
↓
Query sempre filtrada por store_id quando for dado de loja
```

Regras práticas para o MVP:

- não criar microserviços;
- não criar múltiplos bancos;
- não criar múltiplos projetos Supabase;
- não criar permissões granulares por recurso agora;
- manter autorização em services/helpers server-side;
- manter `store_id` como fronteira central de isolamento entre lojas.
