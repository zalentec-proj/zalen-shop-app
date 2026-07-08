# Pesquisa Técnica — Bling

> Status: **App público / OAuth Ready / Product Sync v1 / Inventory Sync v1 / Order Send beta / Webhook worker v1 / Cron sync v1**
> Fontes oficiais consultadas: https://developer.bling.com.br

## Fonte oficial

Links consultados durante a pesquisa:

- [x] https://developer.bling.com.br/bling-api
- [x] https://developer.bling.com.br/referencia
- [x] https://developer.bling.com.br/migracao-jwt
- [x] https://developer.bling.com.br/aplicativos
- [x] https://developer.bling.com.br/limites
- [x] https://developer.bling.com.br/webhooks

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
GET https://api.bling.com.br/Api/v3/categorias/produtos
GET https://api.bling.com.br/Api/v3/categorias/produtos/{idCategoriaProduto}
GET https://api.bling.com.br/Api/v3/estoques/saldos
```

Regras da v1:

- chamadas sempre server-side;
- produtos Bling são identificados por `store_id + external_provider + external_id`;
- produtos nativos sem vínculo externo não são sobrescritos;
- storefront e admin continuam lendo do Supabase;
- variante padrão é criada/atualizada com SKU, preço e estoque;
- variações são mapeadas para múltiplas `product_variants`;
- após o primeiro sync, `dataAlteracaoInicial` usa o último sync bem-sucedido;
- categorias cadastradas no Bling são sincronizadas para `categories` antes do
  processamento dos produtos, preservando `external_id = bling:{id}` e
  hierarquia quando o payload trouxer pai/filhos;
- categoria é vinculada quando `categoria.id` resolve para descrição clara;
- saldos usam `/estoques/saldos` quando o escopo de estoque está disponível.
- o filtro incremental `dataAlteracaoInicial` segue o OpenAPI oficial da
  referência do Bling, com `datetime` no formato `YYYY-MM-DD HH:mm:ss` (exemplo
  oficial `2020-01-01 10:00:00`); a Zalen converte `last_sync_at` para
  `America/Sao_Paulo` e aplica pequena sobreposição para não perder alterações.
- o resumo do sync registra diagnóstico sanitizado dos últimos produtos
  processados, sem payload bruto.
- produto individual pode ser reprocessado pela rota interna usando `productId`
  numérico, mantendo chamada ao Bling server-side.

## Estoque

Estoque básico é sincronizado a partir de `estoque.saldoVirtualTotal` retornado
no produto Bling e, quando o escopo permite, reforçado pelo endpoint oficial de
saldos.

Endpoint oficial separado identificado para evolução futura:

```txt
GET https://api.bling.com.br/Api/v3/estoques/saldos
GET https://api.bling.com.br/Api/v3/estoques/saldos/{idDeposito}
```

Pendência: implementar seleção de depósito específico quando a operação precisar
separar saldo físico, saldo virtual e centros de distribuição.

Implementado na v1 de estoque:

- rota server-side `POST /api/integrations/bling/inventory/sync`;
- leitura das variantes já vinculadas ao Bling via `external_id`;
- atualização exclusiva de `product_variants.stock`;
- registro de job `inventory_sync`;
- diagnóstico sanitizado por variante processada.

## Listas de preço

O Bling possui área operacional de "Lista de preços" na UI, observada em
`/lista.preco.php`, mas a Zalen não deve depender dessa tela para calcular o
checkout. Nesta fase:

- `product_variants.price` e `promotional_price` continuam sendo preço
  base/default sincronizado do Bling;
- preços PF/PJ são nativos da Zalen em `price_lists` e
  `product_variant_prices`;
- produto sincronizado do Bling não sobrescreve preço PJ manual da Zalen;
- pedido enviado futuramente ao Bling deve usar o preço final salvo em
  `order_items`, sem recalcular no ERP;
- sync de listas de preço do Bling fica pendente até confirmação oficial de
  endpoint, payload, escopos e regra de vínculo por lista.

## Pedidos

Implementado envio server-side beta para criação de pedido de venda no Bling,
atrás da trava explícita por loja `settings_json.orderSend.enabled === true`.

Fonte oficial: página [Referência da API](https://developer.bling.com.br/referencia),
que carrega o OpenAPI oficial do Bling. Consulta realizada em 2026-06-23.

Endpoint oficial confirmado:

```txt
POST https://api.bling.com.br/Api/v3/pedidos/vendas
Authorization: Bearer {access_token}
Content-Type: application/json
```

Resumo oficial: `Cria um pedido de venda`.

Request body oficial:

- `application/json`;
- schema composto por `VendasDadosBaseDTO` + `VendasDadosDTO`;
- campos usados no MVP:
  - `numeroLoja`;
  - `data`, `dataSaida`, `dataPrevista`;
  - `contato.nome`, `contato.tipoPessoa`, `contato.numeroDocumento`;
  - `itens[].codigo`, `itens[].unidade`, `itens[].quantidade`,
    `itens[].valor`, `itens[].descricao`;
  - `parcelas[].dataVencimento`, `parcelas[].valor` e, se configurado,
    `parcelas[].formaPagamento.id`;
  - `desconto.valor`, `desconto.unidade = REAL`;
  - `transporte.fretePorConta`, `transporte.frete`, `transporte.etiqueta.*`;
  - `observacoesInternas`.

Resposta oficial esperada:

```txt
201
{
  "data": {
    "id": 12345678,
    "alertas": [],
    "rastreamento": {}
  }
}
```

Erro oficial esperado:

```txt
400
ErrorResponse
```

O client também trata `401` com uma tentativa única de refresh de token e não
salva payload bruto nem credenciais em logs/UI.

Comportamento atual:

- checkout cria pedido local no Supabase;
- pedido salva cliente e snapshot do comprador;
- service server-side só envia para Bling quando a trava `orderSend.enabled`
  está ligada na integração da loja;
- se o pedido já tiver `external_erp_provider = bling` e `external_erp_id`, não
  duplica envio;
- `sync_jobs` registra `job_type = order_send`;
- mapper usa apenas snapshots salvos no pedido: cliente, documento, endereço,
  itens, preços finais, frete, desconto e total;
- em sucesso, grava `orders.external_erp_provider = bling`,
  `external_erp_id`, `external_erp_sync_status = synced` e
  `external_erp_synced_at`;
- em falha, grava `external_erp_sync_status = error`,
  `external_erp_last_error` sanitizado e conclui o `sync_jobs` com erro;
- se a trava estiver desligada, não chama o Bling e marca o pedido como
  `skipped` com erro seguro `bling_order_send_disabled`;
- admin permite retry manual por rota server-side;
- nenhum token, credential ou payload bruto é retornado ao frontend.

Idempotência:

- o reenvio manual retorna `skipped` quando o pedido já possui `external_erp_id`;
- job concorrente do mesmo pedido é bloqueado enquanto `order_send` estiver
  `running`;
- `numeroLoja` recebe `order.orderNumber` para rastreio operacional no Bling.

## Webhooks

Implementado recebimento Bling v1 como validação + deduplicação + fila, com
processador server-side separado para aplicar eventos de produto e estoque.

Fonte oficial: https://developer.bling.com.br/webhooks

Contrato oficial confirmado:

- cabeçalho de assinatura: `X-Bling-Signature-256`;
- algoritmo: HMAC-SHA256;
- segredo: `BLING_CLIENT_SECRET`;
- conteúdo assinado: corpo JSON bruto, em UTF-8;
- formato esperado: `sha256={hash}`;
- resposta `2xx` rápida para eventos aceitos;
- `eventId` é identificador único para idempotência;
- payload v1 possui `eventId`, `date`, `version`, `event`, `companyId` e
  `data`.

Comportamento implementado:

- lê raw body;
- valida assinatura com `timingSafeEqual`;
- assinatura ausente/inválida retorna `401` sem salvar nem enfileirar;
- JSON inválido, `eventId` ausente ou `event` ausente retorna `400`;
- evento válido é salvo em `webhook_events` com `provider = bling`,
  `external_id = eventId`, `signature_valid = true` e `status = received`;
- duplicidade retorna `200` sem criar novo job;
- cria `sync_jobs` com `job_type = webhook_process`, `status = pending` e
  payload mínimo (`webhookEventId`, `eventId`, `event`, IDs externos);
- o endpoint público não atualiza produto, estoque ou pedido diretamente;
- o worker protegido processa eventos `product.created`, `product.updated`,
  `product.deleted`, `stock.*` e `virtual_stock.*`;
- produto criado/alterado aciona sync unitário por ID Bling;
- produto removido no Bling é marcado como `inactive` na Zalen, sem apagar
  histórico;
- eventos de estoque acionam sync de saldos por lote usando `/estoques/saldos`;
- eventos fora do escopo são marcados como processados/ignorados para evitar
  retry infinito;
- jobs com erro usam `attempts`, `locked_at` e `next_attempt_at` para retry
  seguro.

## Jobs internos e cron

Rotas server-side protegidas:

```txt
GET|POST /api/jobs/bling/webhooks/process
GET|POST /api/jobs/bling/sync
POST     /api/integrations/bling/webhooks/process
```

Regras:

- as rotas `/api/jobs/*` exigem `Authorization: Bearer <CRON_SECRET>` ou
  `Authorization: Bearer <INTERNAL_JOB_SECRET>`;
- a rota de admin exige sessão Supabase e acesso à loja ativa;
- no plano Hobby atual da Vercel, os crons rodam diariamente às 03:00 UTC
  (webhooks) e 03:30 UTC (sync incremental);
- quando a conta subir para Pro, a configuração recomendada volta a ser
  webhooks a cada 5 minutos e sync incremental a cada 30 minutos;
- nenhum token Bling é retornado ao frontend ou salvo em log.

## Variáveis de ambiente necessárias

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_SCOPES=
BLING_ENV=sandbox
INTEGRATION_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
INTERNAL_JOB_SECRET=
```

## Segurança

- [x] Callback OAuth server-side.
- [x] State anti-CSRF no fluxo OAuth.
- [x] Tokens nunca expostos no frontend.
- [x] Tokens nunca salvos sem criptografia.
- [x] `credentials_encrypted` não é selecionado no admin.
- [x] Store filtrada por `storeId`.
- [x] Sync de produtos usa somente rota server-side e resumo sanitizado.
- [x] Sync de estoque usa somente rota server-side e resumo sanitizado.
- [x] Webhook validado por assinatura antes de processar.
- [x] Sync e envio de pedidos com idempotência operacional.

## Dúvidas pendentes

- [ ] Confirmar escopos mínimos definitivos para produtos, estoque e pedidos.
- [x] Confirmar endpoints e payloads de sync de produtos.
- [x] Confirmar endpoints e payloads de criação de pedidos.
- [x] Confirmar validação de assinatura de webhooks.
- [ ] Confirmar rate limit operacional da API.
