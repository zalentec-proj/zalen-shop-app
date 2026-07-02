# Bling connector

Base server-side do conector Bling para a Zalen Shop.

Status atual:

- OAuth preparado.
- Rotas server-side criadas.
- Persistência segura preparada em `store_integrations.credentials_encrypted`.
- Tokens só são salvos se `INTEGRATION_TOKEN_ENCRYPTION_KEY` estiver configurada.
- Sync real de produtos implementado.
- Sync dedicado de estoque implementado para variantes já vinculadas.
- Envio beta de pedidos implementado com trava por loja e retry admin.
- Webhook v1 implementado como validar, deduplicar, salvar e enfileirar.
- Worker de webhooks implementado para produto/estoque, com retry seguro.
- Cron Vercel implementado para processar webhooks e rodar sync incremental.

Arquivos principais:

- `bling.config.ts`: envs e URLs oficiais.
- `bling.oauth.ts`: autorização e troca de authorization code.
- `bling.repository.ts`: leitura/gravação de status por `storeId`.
- `bling.service.ts`: orquestração server-side.
- `products/`: sync de catálogo Bling para Supabase.
- `inventory/`: sync de estoque Bling para variantes Supabase.
- `jobs/`: auth interna e sync agendado.
- `orders/`: envio server-side de pedido com idempotência e trava por loja.
- `webhooks/`: validação HMAC, parse do payload v1 e processador assíncrono.
- `bling.connector.ts`: fachada do conector operacional.

Env necessária:

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_SCOPES=
BLING_ENV=production
INTEGRATION_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
INTERNAL_JOB_SECRET=
```
