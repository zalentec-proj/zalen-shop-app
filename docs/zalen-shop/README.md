# Zalen Shop — Documentação do projeto

Esta pasta concentra a documentação de produto, arquitetura e segurança da
plataforma Zalen Shop. Brasil Drones é a primeira loja em operação.

## Documentos

- `PRD.md` — escopo do produto e MVP.
- `ARCHITECTURE.md` — arquitetura geral.
- `DATA_MODEL.md` — modelo de dados.
- `SECURITY.md` — regras de segurança.
- `DESIGN_SYSTEM.md` — diretrizes visuais.
- `INTEGRATIONS.md` — visão modular de integrações.
- `BLING_CONNECTOR.md` — integração com Bling.
- `PAYMENTS.md` — pagamentos e Mercado Pago.
- `SHIPPING.md` — envio, rastreio e Melhor Envio.
- `TEMPLATES.md` — modo template e modo custom.
- `ROADMAP.md` — fases de evolução.
- `ACCEPTANCE_CRITERIA.md` — critérios de aceite.

## Decisão central

Uma aplicação e um banco atendem múltiplas lojas, com dados isolados por
`store_id` e resolução por host. `/admin` opera cada loja. A etapa mínima de
`/platform` oferece acesso global e listagem de lojas; cadastro e personalização
de novas lojas são os próximos incrementos. Consultar o handoff em
`docs/work-context/CURRENT_STATE.md` para distinguir código entregue, validação
e publicação.

## Posicionamento

Zalen Shop é a vitrine e experiência de venda. Bling é o ERP operacional.
