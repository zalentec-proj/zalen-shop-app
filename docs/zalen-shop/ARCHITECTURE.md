# Arquitetura — Zalen Shop

Incremento autorizado em 19/10/2026: `/platform/lojas/nova`, ficha e prévia por
ID; mutações por Server Actions → service com guard → transação privada no
PostgreSQL. Configuração pública publicada separada do rascunho. O contexto de
identidade atende as páginas compartilhadas; o renderer custom Brasil Drones
é preservado. Ver [contrato do incremento](STORE_PROVISIONING_AND_PRESENTATION.md).

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
- `/platform` atende a primeira etapa interna da Zalen: acesso global e listagem de lojas, sem gestão completa.

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

Área interna da Zalen, liberada em etapa mínima em 16/10/2026. `/platform`
encaminha para `/platform/lojas`, com listagem protegida e links aos admins.
O papel global é verificado no servidor junto da leitura privilegiada, além do
layout. O host central não depende de uma store ativa. `/lojas` permite ao
lojista selecionar somente seus vínculos. Gestão completa, conectores globais
editáveis e planos permanecem futuros.

## 8. Store resolution by host

No MVP, `localhost:3000` continua usando Brasil Drones como fallback por meio da store ativa fixa.

A estratégia futura é resolver a loja pelo host da requisição:

- `{storeSlug}.zalen.shop` identifica lojas no domínio da plataforma;
- `brasil-drones.lvh.me:3000` e `lb-london.lvh.me:3000` permitem teste local com subdomínio;
- domínios próprios ativos, como `www.brasildrones.com.br`, são resolvidos por `store_domains.hostname`;
- `app.zalenshop.com.br/platform` atende a área global mínima.

O admin da loja deve permanecer no domínio da plataforma, por exemplo `brasil-drones.zalen.shop/admin`, mesmo quando o storefront público usar domínio próprio.

Detalhes: ver `docs/zalen-shop/DOMAIN_AND_STORE_RESOLUTION.md`.

Host externo pendente, removido ou desconhecido retorna 404 e nunca usa Brasil
Drones como fallback. O fallback fixo existe somente para `localhost`,
`127.0.0.1` e o root local `lvh.me`.

O domínio principal ativo é a origem de canonical, Open Graph, JSON-LD,
checkout, retornos de pagamento, sitemap, robots e Merchant feed. Subdomínio
Zalen público, variante secundária e domínio antigo fazem redirect 308 para ele,
preservando path e query. Admin, login, API e `/.well-known` são excluídos.

## 9. Platform connectors registry

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

## 10. Regra de integração

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

## 11. Conectores

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

## 12. Ambientes

- local;
- staging;
- production.

Cada ambiente deve ter variáveis, banco, credenciais e integrações separadas.

O projeto atual usa Supabase Cloud como base principal de staging/desenvolvimento, com Supabase local opcional.

## 13. Segurança arquitetural

- Credenciais nunca vão para frontend.
- Service role nunca é importado em Client Components.
- Webhooks sempre são server-side.
- Tokens são criptografados.
- Logs não podem conter segredos.
- Queries de loja respeitam `store_id`.
- Frontend é UX, não barreira de segurança.
