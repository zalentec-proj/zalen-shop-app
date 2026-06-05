# Bling connector

Base server-side do conector Bling para a Zalen Shop.

Status atual:

- OAuth preparado.
- Rotas server-side criadas.
- Persistência segura preparada em `store_integrations.credentials_encrypted`.
- Tokens só são salvos se `INTEGRATION_TOKEN_ENCRYPTION_KEY` estiver configurada.
- Sync de produtos, pedidos e webhooks reais ainda não implementados.

Arquivos principais:

- `bling.config.ts`: envs e URLs oficiais.
- `bling.oauth.ts`: autorização e troca de authorization code.
- `bling.repository.ts`: leitura/gravação de status por `storeId`.
- `bling.service.ts`: orquestração server-side.
- `bling.connector.ts`: placeholder do conector operacional futuro.

Env necessária:

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_SCOPES=
BLING_ENV=sandbox
INTEGRATION_TOKEN_ENCRYPTION_KEY=
```
