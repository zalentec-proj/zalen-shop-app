# Pagamentos — Mercado Pago e Estratégia

## 1. Decisão de produto

O pagamento pode seguir dois caminhos:

### Modo Bling Operacional

O lojista usa recursos operacionais do Bling quando aplicável. A Zalen atua como vitrine/pedido.

### Modo Checkout Zalen

A Zalen processa pagamento via conector, inicialmente Mercado Pago.

## 2. Mercado Pago

É o primeiro conector de pagamento em implementação, porque o cliente já possui
conta e a primeira versão pode usar Checkout Pro com menor exposição PCI.

## 3. Autenticação

- Preferencialmente OAuth.
- Cada lojista conecta sua própria conta.
- Tokens armazenados criptografados.
- Nenhum token no frontend.

## 4. Fluxo futuro com Mercado Pago

```txt
Cliente compra na Zalen
↓
Zalen cria pedido local
↓
Mercado Pago gera pagamento
↓
Mercado Pago envia webhook
↓
Zalen confirma pagamento
↓
Zalen envia pedido ao Bling
```

## 5. Checkout

Fase atual:

- Checkout convidado na Zalen coleta e-mail, entrega e CPF/CNPJ.
- Backend cria pedido local no Supabase.
- Backend cria preferência Checkout Pro no Mercado Pago.
- Frontend recebe apenas a URL pública de checkout e redireciona o comprador.

Fase atual de conciliação:

- rotas de retorno do Mercado Pago leem `payment_id`/`collection_id` e consultam
  o pagamento server-side;
- webhook validado salva `webhook_events` e usa o mesmo service de conciliação;
- `payment_transactions` registra preferência, pagamento externo, status bruto e
  status normalizado;
- `approved` marca o pedido como `payment_status = paid` e `status = confirmed`;
- somente após pagamento aprovado a Zalen tenta enviar o pedido ao Bling;
- falhas no envio ao Bling não cancelam o pedido pago: ficam como erro
  operacional para retry no admin;
- Checkout Transparente/Bricks fica reservado para uma fase posterior.

## 6. Regras de segurança

- Total do pedido calculado no backend.
- Não confiar em preço vindo do navegador.
- Webhook validado.
- Pagamento idempotente.
- Transações registradas.

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
