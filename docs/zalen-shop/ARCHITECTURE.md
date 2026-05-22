# Arquitetura — Zalen Shop

## 1. Estratégia

A primeira versão será single-tenant para Brasil Drones, mas tenant-ready. Mesmo existindo apenas uma loja, as tabelas centrais devem nascer com `store_id`.

## 2. Stack inicial

O repositório atual usa Vite, React, TypeScript e Tailwind. Podemos manter essa base para a primeira loja e evoluir depois para Next.js quando backend, rotas server-side, webhooks e autenticação ficarem mais relevantes.

Stack alvo:

- React
- TypeScript
- Vite no início
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
