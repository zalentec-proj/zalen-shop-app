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
- Checkout/pedido.
- Integração Bling pesquisada e implementada.
- Sync de produtos.
- Sync de estoque.
- Envio de pedidos para Bling.
- Logs de integração.
- Reprocessamento básico de erros.

## Fase 3 — Conectores da plataforma

Objetivo: transformar integrações em catálogo de conectores reutilizáveis.

- `integration_providers`.
- `store_integrations`.
- Bling como ERP disponível para Brasil Drones.
- Mercos documentado para LB London.
- Mercado Pago planejado.
- Melhor Envio planejado.
- Interfaces comuns de ERP, payment e shipping.
- Webhooks server-side.
- Idempotência.

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
- Tema por store.
- Componentes comuns de storefront.
- Área do comprador.
- Políticas e páginas institucionais.

## Fase 6 — Platform Admin

Objetivo: criar a área interna da Zalen.

- `/platform`.
- Gerenciar stores.
- Gerenciar clientes.
- Gerenciar conectores habilitados.
- Ver integrações com erro.
- Suporte e logs globais.
- Futuro billing/planos.

## Fase 7 — Crescimento

- Catálogo social Meta/Instagram.
- IA para descrições.
- Recomendações inteligentes.
- Assistente de loja.
- WhatsApp com IA.
- Recuperação de carrinho.
- Marketplace de conectores.
- API pública Zalen.
- OAuth próprio para apps externos.
