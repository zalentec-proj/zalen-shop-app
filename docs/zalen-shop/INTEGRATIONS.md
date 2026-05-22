# Integrações — Arquitetura Modular

## 1. Princípio

Toda integração deve ser um conector modular. A loja e o painel não devem depender diretamente de provedores específicos.

## 2. ERP

Primeiro ERP: Bling.

Futuros ERPs:

- Omie
- Tiny
- Olist

Interface conceitual:

```ts
interface ErpConnector {
  syncProducts(): Promise<void>
  syncStock(): Promise<void>
  createOrder(orderId: string): Promise<void>
  getOrderStatus(externalOrderId: string): Promise<void>
  handleWebhook(payload: unknown): Promise<void>
}
```

## 3. Pagamento

Primeiro conector previsto: Mercado Pago.

Futuros:

- Asaas
- Pagar.me
- Stripe

Interface conceitual:

```ts
interface PaymentConnector {
  createPayment(orderId: string): Promise<void>
  getPaymentStatus(externalPaymentId: string): Promise<void>
  refund(paymentId: string): Promise<void>
  handleWebhook(payload: unknown): Promise<void>
}
```

## 4. Envio

MVP:

- retirada na loja;
- frete fixo;
- frete grátis;
- rastreio manual.

Futuro:

- Melhor Envio.

Interface conceitual:

```ts
interface ShippingConnector {
  calculateRates(input: ShippingRateInput): Promise<ShippingRate[]>
  createShipment(orderId: string): Promise<void>
  getTracking(trackingCode: string): Promise<void>
}
```

## 5. IA

Futuro:

- IA para descrição de produtos;
- recomendações de catálogo;
- assistente de loja;
- WhatsApp com IA;
- análise de gargalos da operação.

A base deve nascer registrando eventos e logs estruturados.

## 6. Regras

- Cada conector deve ter logs.
- Cada conector deve tratar erros.
- Cada conector deve suportar retries.
- Nenhum conector deve expor token no frontend.
- Webhooks devem ser salvos antes de processar.
