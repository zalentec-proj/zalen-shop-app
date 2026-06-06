# Pesquisa Técnica — Bling

> Status: **OAuth Ready / sync pendente**
> Fontes oficiais consultadas: https://developer.bling.com.br

## Fonte oficial

Links consultados durante a pesquisa:

- [x] https://developer.bling.com.br/bling-api
- [x] https://developer.bling.com.br/migracao-jwt
- [x] https://developer.bling.com.br/aplicativos
- [ ] https://developer.bling.com.br/webhooks

## Objetivo da integração

O Bling será o ERP operacional da loja Brasil Drones. A Zalen Shop é a vitrine, o admin e a camada de integração. O Bling não deve ser chamado pelo frontend.

Responsabilidades futuras do conector:

- Sincronizar catálogo de produtos e estoque do Bling para o banco Zalen.
- Enviar pedidos confirmados do Zalen para o Bling.
- Receber atualizações por webhook.
- Registrar erros e permitir reprocessamento.

## OAuth 2.0

Fonte principal: https://developer.bling.com.br/aplicativos

### URL de autorização

```txt
https://www.bling.com.br/Api/v3/oauth/authorize
```

Parâmetros usados nesta sprint:

- `response_type=code`
- `client_id`
- `state`

`redirect_uri` e `scope` são mantidos no cadastro do aplicativo Bling. A
requisição de autorização não envia esses parâmetros para evitar
`redirect_uri_mismatch`; o Bling usa os valores cadastrados no app.

### URL de callback no projeto

```txt
{APP_URL}/api/integrations/bling/callback
```

### Troca de authorization_code por tokens

Fonte principal: https://developer.bling.com.br/migracao-jwt

```txt
POST https://api.bling.com.br/Api/v3/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)
enable-jwt: 1
Accept: 1.0
```

Body:

```txt
grant_type=authorization_code
code={authorization_code}
```

### access_token

- Deve ser tratado como segredo server-side.
- Não pode ser enviado ao frontend.
- Não pode aparecer em logs.
- Nesta sprint, só é salvo se puder ser criptografado.

### refresh_token

- Deve ser tratado como segredo server-side.
- A homologação server-side já tenta renovar uma vez se o access token expirar.
- O armazenamento criptografado está preparado em `store_integrations`.

### Header enable-jwt

Fonte: https://developer.bling.com.br/migracao-jwt

Usar:

```txt
enable-jwt: 1
```

## Escopos

Os escopos devem ser configurados no app do Bling e podem ser passados por `BLING_SCOPES` se necessário.

Escopos mínimos ainda dependem da etapa de sync:

| Escopo | Finalidade | Status |
|---|---|---|
| produtos | Sync de catálogo | A confirmar antes do sync |
| estoque | Sync de estoque | A confirmar antes do sync |
| pedidos | Envio/leitura de pedidos | A confirmar antes do sync |
| webhooks | Eventos | A confirmar antes de webhooks |

## Produtos

Não implementado nesta sprint.

Antes de implementar:

- confirmar endpoints oficiais de produtos;
- confirmar paginação;
- confirmar payloads;
- mapear produto Bling para `products`, `product_variants`, `product_images` e `categories`.

## Estoque

Não implementado nesta sprint.

Antes de implementar:

- confirmar endpoint oficial de estoque;
- confirmar se estoque vem por produto, variação, depósito ou outra entidade;
- definir regra de atualização no Zalen.

## Pedidos

Não implementado nesta sprint.

Antes de implementar:

- confirmar payload oficial de criação de pedido;
- definir idempotência por `orders.id`/`order_number`;
- registrar `external_erp_provider` e `external_erp_id`.

## Webhooks

Não implementado nesta sprint.

Antes de implementar:

- consultar https://developer.bling.com.br/webhooks;
- confirmar eventos disponíveis;
- confirmar validação de assinatura;
- definir idempotência em `webhook_events`.

## Variáveis de ambiente necessárias

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_SCOPES=
BLING_ENV=sandbox
INTEGRATION_TOKEN_ENCRYPTION_KEY=
```

## Segurança

- [x] Callback OAuth server-side.
- [x] State anti-CSRF no fluxo OAuth.
- [x] Tokens nunca expostos no frontend.
- [x] Tokens nunca salvos sem criptografia.
- [x] `credentials_encrypted` não é selecionado no admin.
- [x] Store filtrada por `storeId`.
- [ ] Webhook validado por assinatura antes de processar.
- [ ] Sync e envio de pedidos com idempotência.

## Dúvidas pendentes

- [ ] Confirmar escopos mínimos definitivos para produtos, estoque e pedidos.
- [ ] Confirmar endpoints e payloads de sync de produtos.
- [ ] Confirmar endpoints e payloads de criação de pedidos.
- [ ] Confirmar validação de assinatura de webhooks.
- [ ] Confirmar rate limit operacional da API.
