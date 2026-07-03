# Roadmap — Zalen Shop

## Fase 1 — Fundação da plataforma

Objetivo: consolidar a base Zalen Shop com Brasil Drones como primeira store.

- Next.js App Router.
- Supabase Cloud.
- Auth.
- Stores por `store_id`.
- `platform_users`.
- `store_memberships`.
- Admin com identidade Zalen Shop.
- Storefront Brasil Drones.
- Catálogo e pedidos no Supabase.
- Logs de desenvolvimento.
- Estrutura de conectores.

## Fase 2 — Brasil Drones operacional

Objetivo: deixar a primeira loja operável.

- Admin protegido.
- Produtos editáveis conforme fonte de dados.
- Pedidos salvos no banco.
- Clientes operacionais por loja.
- Checkout/pedido.
- Integração Bling pesquisada e implementada.
- Sync de produtos.
- Sync de estoque.
- Envio de pedidos para Bling em beta, com trava por loja e retry.
- Processador de webhooks Bling para produto/estoque.
- Sync incremental agendado Bling como camada de segurança.
- Logs de integração.
- Reprocessamento básico de erros.

## Fase 3 — Conectores da plataforma

Objetivo: transformar integrações em catálogo de conectores reutilizáveis.

- `integration_providers`.
- `store_integrations`.
- Bling como ERP disponível para Brasil Drones.
- Mercos documentado para LB London.
- Mercado Pago em beta com Checkout Pro, retorno e webhook validados.
- SuperFrete em V1 quote-only para cotação real no checkout.
- Melhor Envio planejado como provider futuro.
- Interfaces comuns de ERP, payment e shipping.
- Webhooks server-side validados e enfileirados.
- Idempotência.

Roadmap de logística:

- V1: SuperFrete apenas cotação + Bling operacional.
- V2: token SuperFrete por loja.
- V3: geração automática de etiqueta, se necessário.
- V4: webhook/rastreio direto, se fizer sentido.

## Fase 4 — Segunda loja/case: LB London

Objetivo: provar reutilização do core com outro cliente e outro ERP.

- Criar store LB London.
- Storefront customizado LB London.
- Conector Mercos.
- Sync de produtos Mercos.
- Pedidos para Mercos.
- Webhooks Mercos.
- Ajustes visuais por store.

## Fase 5 — Produto reutilizável

Objetivo: reduzir esforço por nova loja.

- Templates editáveis.
- Configurações visuais por loja.
- Domínio próprio.
- Resolução dinâmica de store por domínio/subdomínio.
- `{storeSlug}.zalen.shop` para lojas no domínio da plataforma.
- `lvh.me` para testes locais com subdomínio.
- Tema por store.
- Componentes comuns de storefront.
- Área do comprador.
- Políticas e páginas institucionais.

## Fase 6 — Domínios e resolução dinâmica de stores

Objetivo: remover a dependência operacional de store fixa e resolver a loja pelo host da requisição.

- Resolver `{storeSlug}.zalen.shop` por `stores.slug`.
- Manter `localhost:3000` como fallback Brasil Drones durante desenvolvimento.
- Testar `brasil-drones.lvh.me:3000` e `lb-london.lvh.me:3000`.
- Planejar domínio próprio de clientes, como `www.brasildrones.com.br`.
- Manter admin da loja no domínio da plataforma.
- Reservar `app.zalen.shop/platform` para operação interna futura da Zalen.
- Garantir que services e repositories recebam `storeId` resolvido fora deles.

## Fase 7 — Platform Admin

Objetivo: criar a área interna da Zalen.

- `/platform`.
- Gerenciar stores.
- Gerenciar clientes.
- Gerenciar conectores habilitados.
- Ver integrações com erro.
- Suporte e logs globais.
- Futuro billing/planos.

## Fase 8 — Crescimento

- SEO técnico avançado por loja.
- `robots.txt`, `sitemap.xml` e canonical dinâmicos por host.
- JSON-LD de loja, breadcrumb e produto.
- GTM, GA4, Google Ads, Merchant Center, Meta Pixel e Meta CAPI como conectores.
- Feed Google Merchant Center por loja.
- Consentimento restritivo para cookies e anúncios.
- Rastreio ecommerce client-side.
- Compra confirmada server-side com deduplicação por `event_id`.
- Catálogo social Meta/Instagram.
- IA para descrições.
- Recomendações inteligentes.
- Assistente de loja.
- WhatsApp com IA.
- Recuperação de carrinho.
- Marketplace de conectores.
- API pública Zalen.
- OAuth próprio para apps externos.
