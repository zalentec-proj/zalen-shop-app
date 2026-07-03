# Pagamentos — Mercado Pago e Estratégia

## 1. Decisão de produto

O pagamento pode seguir dois caminhos:

### Modo Bling Operacional

O lojista usa recursos operacionais do Bling quando aplicável. A Zalen atua como vitrine/pedido.

### Modo Checkout Zalen

A Zalen processa pagamento via conector, inicialmente Mercado Pago.

## 2. Mercado Pago

É o primeiro conector de pagamento em beta. A experiência preferencial usa
Payment Brick dentro do checkout da Zalen, com Checkout Pro mantido como
fallback temporário quando a loja ainda não possui `Public Key` configurada.

## 3. Autenticação

- A Zalen usa uma aplicação OAuth Mercado Pago própria.
- Cada loja autoriza sua própria conta Mercado Pago em `/admin/integracoes/mercado-pago`.
- Tokens ficam criptografados em `store_integrations.credentials_encrypted` por
  `store_id + provider_key + environment`.
- O ambiente ativo do Mercado Pago é uma preferência por loja salva em
  `store_integrations` com `environment = shared`; o padrão seguro é `test`.
- `settings_json` guarda apenas metadados seguros, como conta conectada,
  `credentialsSource`, datas, status do Checkout Pro e disponibilidade do
  Payment Brick.
- `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` permanecem como
  fallback legado temporário para Brasil Drones até a reconexão OAuth.
- `MERCADO_PAGO_ENV` fica apenas como fallback técnico legado, não como fonte
  principal para decidir se a loja cobra em teste ou produção.
- Nenhum token no frontend.

## 4. Fluxo com Mercado Pago

```txt
Cliente compra na Zalen
↓
Zalen cria pedido local
↓
Mercado Pago gera preferência/sessão
↓
Cliente paga no Payment Brick ou fallback Checkout Pro
↓
Mercado Pago envia webhook
↓
Zalen confirma pagamento
↓
Zalen envia pedido ao Bling
```

## 5. Checkout

Fase atual:

- Checkout na Zalen coleta e-mail, entrega e CPF/CNPJ sem exigir senha.
- Checkout valida o e-mail por código enviado pela loja antes do pagamento.
- Backend bloqueia criação de pedido/preferência se o e-mail atual não estiver
  validado na sessão Supabase Auth.
- Backend cria ou reutiliza `customers` vinculado por `auth_user_id`.
- Backend valida se Mercado Pago está ativo/configurado antes de criar pedido.
- Backend usa o ambiente ativo configurado para a loja, exceto quando um pedido
  ou webhook já carrega ambiente explícito.
- Backend reutiliza pedido pendente pagável quando encontra mesmo `store_id`,
  `cart_hash` e `customer_hash`.
- Backend cria pedido local no Supabase quando não há pedido pendente
  reutilizável.
- Backend cria preferência no Mercado Pago.
- Frontend recebe `Public Key`, `preferenceId` e `orderId` para Payment Brick
  quando disponíveis; tokens privados nunca chegam ao navegador.
- Frontend recebe URL pública de Checkout Pro apenas como fallback.
- Preferência inclui `store_id` e `environment` na `notification_url`.
- Backend processa `formData` do Brick por server action própria e chama
  `POST /v1/payments` com `X-Idempotency-Key`.
- Backend força `transaction_amount = orders.total`; valor vindo do navegador
  nunca é fonte de verdade.

Fase atual de conciliação:

- rotas de retorno do Mercado Pago leem `payment_id`/`collection_id` e consultam
  o pagamento server-side;
- webhook validado por segredo de ambiente salva `webhook_events` e usa o mesmo
  service de conciliação;
- webhooks são deduplicados antes de processar a conciliação;
- conciliação valida `metadata.store_id`, `external_reference` e loja do pedido;
- `payment_transactions` registra preferência, pagamento externo, status bruto e
  status normalizado;
- `payment_transactions` preserva preferência e ambiente do pedido para novas
  tentativas de pagamento;
- `approved` marca o pedido como `payment_status = paid` e `status = confirmed`;
- somente após pagamento aprovado a Zalen tenta enviar o pedido ao Bling;
- o envio ao Bling só dispara na transição real de não pago para pago;
- falhas no envio ao Bling não cancelam o pedido pago: ficam como erro
  operacional para retry no admin;
- tentativas recusadas mantêm o pedido acessível para novo pagamento, sem criar
  segundo pedido.

## 6. Regras de segurança

- Total do pedido calculado no backend.
- Não confiar em preço vindo do navegador.
- Webhook validado.
- Pagamento idempotente.
- Transações registradas.
- Public Key pode ir ao frontend; Access Token, refresh token e segredo de
  webhook nunca podem ir.

## 7. Tabelas futuras

```txt
payment_connections
payment_transactions
payment_webhook_events
```

`payment_transactions` registra provider, preferência, pagamento externo, URL de
checkout, status normalizado, status bruto e timestamps de processamento.
Webhooks continuam usando `webhook_events` até a criação de uma tabela dedicada.

## 8. Fora do MVP

- Split de pagamento.
- Marketplace financeiro.
- Reembolso automático avançado.
- Antifraude próprio.
