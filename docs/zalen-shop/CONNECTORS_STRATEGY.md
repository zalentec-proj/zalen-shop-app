# Estratégia de Conectores — Zalen Shop

## 1. Decisão central

Os conectores pertencem ao core da Zalen Shop. As lojas apenas ativam/configuram os conectores disponíveis.

Isso evita duplicar lógica por cliente e permite que a plataforma cresça com novos ERPs, gateways de pagamento, operadores logísticos e canais de venda.

## 2. Diferença entre provider e conexão

### integration_providers

Catálogo global de conectores da plataforma.

Exemplos:

- Bling
- Mercos
- Mercado Pago
- Melhor Envio

Essa tabela não guarda credenciais.

### store_integrations

Configuração de um conector em uma loja específica.

Exemplos:

- Brasil Drones → Bling
- LB London → Mercos

Essa tabela guarda ambiente, status, configurações e credenciais criptografadas.

## 3. Casos iniciais

### Brasil Drones

- Store: Brasil Drones
- ERP: Bling
- Tipo de autenticação: OAuth/app
- Status: primeiro conector real planejado

### LB London

- Store: LB London
- ERP: Mercos
- Tipo de autenticação: ApplicationToken + CompanyToken
- Status: futuro conector planejado

## 4. Categorias de conectores

- `erp`
- `payment`
- `shipping`
- `sales_channel`
- `ai`
- `analytics`

## 5. Status de provider

- `planned`
- `beta`
- `available`
- `deprecated`

## 6. Responsabilidades mínimas de um conector

Todo conector deve prever:

- testConnection;
- syncProducts, quando aplicável;
- syncInventory, quando aplicável;
- sendOrder, quando aplicável;
- createPayment, quando aplicável;
- calculateRates, quando aplicável;
- handleWebhook;
- logs;
- retry;
- idempotência;
- tratamento de erros;
- segurança de credenciais.

## 7. ERP connector interface

```ts
interface ErpConnector {
  testConnection(storeId: string): Promise<ConnectionStatus>
  syncProducts(storeId: string): Promise<SyncResult>
  syncInventory(storeId: string): Promise<SyncResult>
  sendOrder(storeId: string, orderId: string): Promise<ExternalOrderResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 8. Payment connector interface

```ts
interface PaymentConnector {
  testConnection(storeId: string): Promise<ConnectionStatus>
  createPayment(storeId: string, orderId: string): Promise<PaymentResult>
  getPaymentStatus(storeId: string, externalPaymentId: string): Promise<PaymentStatus>
  refund(storeId: string, paymentId: string): Promise<RefundResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 9. Shipping connector interface

```ts
interface ShippingConnector {
  testConnection(storeId: string): Promise<ConnectionStatus>
  calculateRates(input: ShippingRateInput): Promise<ShippingRate[]>
  createShipment(storeId: string, orderId: string): Promise<ShipmentResult>
  getTracking(storeId: string, trackingCode: string): Promise<TrackingResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 10. Bling

O Bling será o primeiro ERP real da Brasil Drones.

Características:

- conexão via app/OAuth;
- access token e refresh token;
- JWT com `enable-jwt: 1`;
- callback server-side;
- token refresh;
- webhooks;
- produtos;
- estoque;
- pedidos.

## 11. Mercos

O Mercos será preparado como conector futuro para a LB London.

Características:

- autenticação por `ApplicationToken` e `CompanyToken`;
- sandbox;
- homologação;
- throttling/erro 429;
- paginação e sync incremental com `alterado_apos`;
- webhooks com HMAC-SHA256.

## 12. Regras de segurança

- Nenhuma API externa deve ser chamada pelo frontend.
- Credenciais são sempre por loja.
- Credenciais devem ser criptografadas.
- Tokens nunca aparecem em logs.
- Webhooks são sempre server-side.
- Payload bruto pode ser salvo, mas sem expor segredos.
- Operações críticas devem ser idempotentes.

## 13. Fluxo correto para implementar um novo conector

1. Consultar documentação oficial.
2. Preencher pesquisa técnica em `docs/integrations`.
3. Validar autenticação, escopos, endpoints, webhooks e rate limits.
4. Criar tipos.
5. Criar client server-side.
6. Criar service.
7. Criar logs e retries.
8. Criar idempotência.
9. Conectar ao admin/storefront somente depois.
