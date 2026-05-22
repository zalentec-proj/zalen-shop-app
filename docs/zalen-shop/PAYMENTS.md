# Pagamentos — Mercado Pago e Estratégia

## 1. Decisão de produto

O pagamento pode seguir dois caminhos:

### Modo Bling Operacional

O lojista usa recursos operacionais do Bling quando aplicável. A Zalen atua como vitrine/pedido.

### Modo Checkout Zalen

A Zalen processa pagamento via conector, inicialmente Mercado Pago.

## 2. Mercado Pago

Será o primeiro conector de pagamento previsto, porque o cliente já possui conta.

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

Fase recomendada:

- Inicial: sem checkout próprio complexo, se o Bling centralizar operação.
- Futuro: Checkout Pro ou Checkout Transparente.

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

## 8. Fora do MVP

- Split de pagamento.
- Marketplace financeiro.
- Reembolso automático avançado.
- Antifraude próprio.
