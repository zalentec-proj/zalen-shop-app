# Pesquisa Técnica — Bling

> Status: **App público / OAuth Ready / Product Sync v1**
> Fontes oficiais consultadas: https://developer.bling.com.br

## Fonte oficial

Links consultados durante a pesquisa:

- [x] https://developer.bling.com.br/bling-api
- [x] https://developer.bling.com.br/referencia
- [x] https://developer.bling.com.br/migracao-jwt
- [x] https://developer.bling.com.br/aplicativos
- [x] https://developer.bling.com.br/limites
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
- No fluxo de homologação, uma resposta `400` também é tratada como possível
  invalidação controlada de token e gera uma única tentativa de refresh.
- O fluxo de homologação aguarda 2 segundos entre chamadas para evitar `429`.
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

Implementado na v1 de sync de catálogo, após aprovação/publicação do app Zalen
Shop no Bling.

Endpoints oficiais usados:

```txt
GET https://api.bling.com.br/Api/v3/produtos
GET https://api.bling.com.br/Api/v3/produtos/{idProduto}
GET https://api.bling.com.br/Api/v3/categorias/produtos/{idCategoriaProduto}
```

Regras da v1:

- chamadas sempre server-side;
- produtos Bling são identificados por `store_id + external_provider + external_id`;
- produtos nativos sem vínculo externo não são sobrescritos;
- storefront e admin continuam lendo do Supabase;
- variante padrão é criada/atualizada com SKU, preço e estoque;
- categoria é vinculada quando `categoria.id` resolve para descrição clara;
- variações complexas ficam como pendência documentada.

## Estoque

Estoque básico é sincronizado a partir de `estoque.saldoVirtualTotal` retornado
no produto Bling.

Endpoint oficial separado identificado para evolução futura:

```txt
GET https://api.bling.com.br/Api/v3/estoques/saldos
GET https://api.bling.com.br/Api/v3/estoques/saldos/{idDeposito}
```

Pendência: implementar estoque por depósito quando a operação precisar separar
saldo físico, saldo virtual e centros de distribuição.

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
- [x] Sync de produtos usa somente rota server-side e resumo sanitizado.
- [ ] Webhook validado por assinatura antes de processar.
- [ ] Sync e envio de pedidos com idempotência.

## Dúvidas pendentes

- [ ] Confirmar escopos mínimos definitivos para produtos, estoque e pedidos.
- [x] Confirmar endpoints e payloads de sync de produtos.
- [ ] Confirmar endpoints e payloads de criação de pedidos.
- [ ] Confirmar validação de assinatura de webhooks.
- [ ] Confirmar rate limit operacional da API.
