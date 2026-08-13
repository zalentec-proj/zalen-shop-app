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
- A sequência oficial usa exclusivamente
  `https://api.bling.com.br/Api/v3/homologacao/produtos`. Ela deve ser
  executada com uma conta da empresa que criou o aplicativo; uma conta cliente
  conectada pode operar catálogo/pedidos normalmente, mas o Bling rejeita a
  homologação com o erro seguro `homologation_app_company_mismatch`.
- Erros de validação da empresa criadora não disparam refresh de token; o painel
  apresenta orientação operacional sem exibir a mensagem bruta ou credenciais.
- O armazenamento criptografado está preparado em `store_integrations`.

### Header enable-jwt

Fonte: https://developer.bling.com.br/migracao-jwt

Usar:

```txt
enable-jwt: 1
```

O header deve acompanhar tanto a troca/renovação OAuth quanto todas as chamadas
autenticadas de catálogo, estoque, pedidos e homologação. Em 2026-07-20, os
clientes operacionais e de homologação foram alinhados a essa exigência e
receberam testes de regressão específicos.

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
- o campo booleano oficial `freteGratis` de `ProdutosDadosDTO` é persistido em
  `products.free_shipping`; quando ausente, assume `false`;
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

### Mídia do catálogo Brasil Drones

Em 13/08/2026, o OpenAPI oficial vigente foi validado antes da carga das
galerias do novo catálogo. O contrato confirmado foi:

```txt
PATCH https://api.bling.com.br/Api/v3/produtos/{idProduto}
midia.imagens.imagensURL[].link
```

- `imagensURL` é marcado como `writeOnly`; portanto, um `GET` posterior pode
  não devolver as URLs enviadas, mesmo quando a galeria foi salva.
- O sucesso operacional é registrado quando o `PATCH` retorna HTTP 200 e é
  complementado por amostragem visual no painel do Bling.
- A rotina de catálogo usa exclusivamente `BLING_CUSTOMER_*`, referente ao app
  privado da Brasil Drones, e altera somente `midia`.
- As imagens aprovadas são copiadas primeiro para o bucket público
  `product-images`, no prefixo exclusivo
  `bling/brasil-drones/catalogo-2026-08/`, antes do envio ao Bling.
- A correspondência com o MundoDrone é conservadora: modelo, tipo e posição da
  peça precisam ser compatíveis; banners, placeholders e imagens inválidas são
  rejeitados.
- A execução resultou em 572 produtos aceitos pela API, 1.425 imagens únicas e
  zero erro pendente. Dezoito produtos sem correspondência segura e nove com
  imagem principal reprovada permaneceram sem imagem para revisão manual.

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
  `order_items`, sem recalcular no ERP; benefícios PJ já estão incorporados no
  preço unitário final e não são reenviados como desconto global, evitando
  aplicação dupla;
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
- antes do `POST /pedidos/vendas`, o conector resolve o contato pelo filtro
  oficial `GET /contatos?numeroDocumento=...`; quando ele ainda não existe,
  cria o contato via `POST /contatos` e usa `contato.id` no pedido;
- produtos existentes são resolvidos pelo filtro oficial
  `GET /produtos?codigos[]=...`, e cada item inclui `produto.id`; o envio é
  interrompido com erro seguro se algum SKU não existir no Bling;
- em sucesso, grava `orders.external_erp_provider = bling`,
  `external_erp_id`, `external_erp_sync_status = synced` e
  `external_erp_synced_at`;
- em falha, grava `external_erp_sync_status = error`,
  `external_erp_last_error` sanitizado e conclui o `sync_jobs` com erro;
- se a trava estiver desligada, não chama o Bling e marca o pedido como
  `skipped` com erro seguro `bling_order_send_disabled`;
- admin permite retry manual por rota server-side;
- para homologação excepcional na própria conta Bling operacional, owner/admin
  pode enviar manualmente um único pedido já pago mesmo com a trava automática
  desligada; a ação exige confirmação explícita, registra `testMode = true` no
  job e envia em `observacoesInternas` o aviso para não faturar, não expedir e
  cancelar após a validação;
- o painel aceita tanto o número operacional visível (`BD-...`) quanto o UUID
  interno; ambos são normalizados e resolvidos sempre dentro do `store_id` da
  requisição antes do envio;
- esse modo não cria pedido, não muda pagamento, não liga a trava global e não
  é acionado pelo checkout ou por webhook;
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
- Supabase `pg_cron` verifica a cada 10 minutos se há webhook Bling pendente,
  retry vencido ou lock abandonado; a chamada HTTP ao worker só é criada quando
  existe trabalho elegível;
- o sync incremental geral roda uma vez por hora como camada de reconciliação e
  contingência do webhook. Catálogo e estoque normalmente chegam pelo webhook,
  mas podem levar até uma hora quando dependerem desse fallback;
- as rotas de sync e de processamento de webhooks só invalidam o cache público
  quando produtos, estoque ou inativações foram efetivamente processados;
- em 2026-07-20 o servidor `Zalen Shop Produção` foi salvo no aplicativo público
  com o endpoint `https://app.zalenshop.com.br/api/webhooks/bling`; estoques e
  produtos v1 ficaram ativos para criação, atualização e exclusão. Pedidos de
  venda e fornecedores de produtos ficaram inativos porque não são processados
  pelo conector atual;
- Supabase `pg_net` envia a chamada HTTP autenticada com o segredo
  `zalen_cron_secret` guardado no Vault; nenhum valor é incluído na migration;
- falhas e execuções podem ser auditadas em `cron.job` e
  `cron.job_run_details`;
- nenhum token Bling é retornado ao frontend ou salvo em log.

## Variáveis de ambiente necessárias

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
BLING_SCOPES=
BLING_ENV=sandbox
INTEGRATION_TOKEN_ENCRYPTION_KEY=
INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS=
CRON_SECRET=
INTERNAL_JOB_SECRET=
```

## Segurança

- [x] Callback OAuth server-side.
- [x] State anti-CSRF no fluxo OAuth.
- [x] Tokens nunca expostos no frontend.
- [x] Tokens nunca salvos sem criptografia.
- [x] Rotação coordenada aceita temporariamente uma chave anterior apenas para
  descriptografia; novas gravações usam sempre a chave atual.
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
