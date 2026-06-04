# Arquitetura — Zalen Shop

## 1. Estratégia

A Zalen Shop será construída como uma única aplicação Next.js, com um único banco Supabase, preparada para múltiplas lojas por meio de `store_id`.

A primeira loja real é a Brasil Drones, mas o core não deve ser específico dela. A arquitetura deve permitir lojas futuras, como LB London, com conectores diferentes.

## 2. Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- Server Components
- Route Handlers
- Server Actions quando necessário

## 3. Camadas

```txt
Storefront
↓
Admin UI
↓
Application Services
↓
Domain Modules
↓
Repositories
↓
Database / Connectors
↓
External APIs
```

## 4. Módulos principais

```txt
src/
  app/
  components/
  modules/
    auth/
    stores/
    catalog/
    cart/
    orders/
    customers/
    checkout/
    integrations/
    payments/
    shipping/
    theme/
  lib/
  server/
  types/
```

## 5. Multi-store leve

A plataforma deve ser multi-store ready, mas sem adicionar complexidade desnecessária ao MVP.

Decisão estrutural:

- uma única aplicação Next.js;
- um único banco Supabase;
- múltiplas lojas separadas por `store_id`;
- uma mesma base de código atende storefront, admin operacional e futuras áreas internas;
- Zalen pode ter acesso global como dona da plataforma;
- clientes acessam apenas lojas às quais estão vinculados por `store_id`;
- `/admin` continua sendo o painel operacional da loja;
- `/platform` será uma área futura para operação interna da Zalen, mas não será criada agora.

Não criar agora:

- microserviços;
- múltiplos bancos;
- múltiplos projetos Supabase;
- permissões granulares avançadas;
- billing;
- marketplace de apps.

## 6. Acesso

### Platform access

Usuários da Zalen:

- `platform_owner`
- `platform_admin`

Podem acessar múltiplas lojas.

### Store access

Usuários de loja:

- `store_owner`
- `store_admin`
- `store_operator`
- `store_viewer`

Acessam apenas a própria store.

Fluxo de acesso:

```txt
Request server-side
↓
Supabase Auth user
↓
platform_users ou store_memberships
↓
Query filtrada por store_id quando for dado de loja
```

## 7. Storefront, Admin e Platform

### Storefront

Pertence à identidade da loja ativa.

Exemplo:

- Brasil Drones storefront usa identidade Brasil Drones.
- LB London storefront usará identidade LB London.

### Admin

Pertence à identidade da Zalen Shop, porque é o sistema operacional da plataforma.

O admin deve indicar a loja ativa, por exemplo: Brasil Drones.

### Platform

Será uma área futura para a Zalen gerenciar todas as lojas, conectores, suporte e planos.

Não implementar `/platform` no MVP.

## 8. Platform connectors registry

Conectores pertencem ao core da Zalen Shop. Lojas apenas ativam/configuram conectores disponíveis.

### Catálogo global

`integration_providers` representa os conectores disponíveis na plataforma.

Exemplos:

- Bling;
- Mercos;
- Mercado Pago;
- Melhor Envio.

### Conectores por loja

`store_integrations` representa conectores configurados por loja.

Exemplos:

```txt
Brasil Drones → Bling
LB London → Mercos
```

## 9. Regra de integração

A interface visual não pode chamar APIs externas diretamente.

Errado:

```txt
ProductPage → Bling API
Checkout → Mercado Pago direto
Admin → Mercos API direto
```

Certo:

```txt
ProductPage
↓
Catalog Service
↓
Repository
↓
Supabase
```

Para sincronização:

```txt
Bling Connector
↓
Catalog Service
↓
Supabase
```

Para pedidos:

```txt
Order Service
↓
ERP Connector
↓
Bling ou Mercos
```

## 10. Conectores

Cada conector deve ser um módulo isolado com:

- client;
- service;
- types;
- mapper;
- logs;
- tratamento de erro;
- retries;
- idempotência;
- validação de webhook quando aplicável.

## 11. Ambientes

- local;
- staging;
- production.

Cada ambiente deve ter variáveis, banco, credenciais e integrações separadas.

O projeto atual usa Supabase Cloud como base principal de staging/desenvolvimento, com Supabase local opcional.

## 12. Segurança arquitetural

- Credenciais nunca vão para frontend.
- Service role nunca é importado em Client Components.
- Webhooks sempre são server-side.
- Tokens são criptografados.
- Logs não podem conter segredos.
- Queries de loja respeitam `store_id`.
- Frontend é UX, não barreira de segurança.
