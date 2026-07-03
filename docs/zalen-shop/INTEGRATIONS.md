# Integrações — Zalen Shop

## 1. Princípio

Toda integração deve ser um conector modular da plataforma. A loja e o painel não devem depender diretamente de provedores específicos.

Conectores pertencem ao core da Zalen Shop. Cada loja apenas ativa/configura os conectores disponíveis.

## 2. Modelo conceitual

```txt
Zalen Shop Core
├── integration_providers
│   ├── bling
│   ├── mercos
│   ├── mercado_pago
│   ├── melhor_envio
│   ├── google_tag_manager
│   ├── ga4
│   ├── google_ads
│   ├── google_merchant_center
│   ├── meta_pixel
│   └── meta_conversions_api
└── store_integrations
    ├── Brasil Drones → Bling
    └── LB London → Mercos
```

## 3. integration_providers

Representa o catálogo global de conectores disponíveis na plataforma.

Exemplos:

| key | name | category | status |
|---|---|---|---|
| bling | Bling | erp | planned/available |
| mercos | Mercos | erp | planned |
| mercado_pago | Mercado Pago | payment | beta |
| melhor_envio | Melhor Envio | shipping | planned |
| google_tag_manager | Google Tag Manager | analytics | beta |
| ga4 | Google Analytics 4 | analytics | beta |
| google_ads | Google Ads | analytics | beta |
| google_merchant_center | Google Merchant Center | sales_channel | beta |
| meta_pixel | Meta Pixel | analytics | beta |
| meta_conversions_api | Meta Conversions API | analytics | beta |

Categorias possíveis:

- `erp`
- `payment`
- `shipping`
- `sales_channel`
- `ai`
- `analytics`

## 4. store_integrations

Representa uma conexão configurada em uma loja.

Exemplos:

- Brasil Drones ativa/configura Bling.
- LB London ativará/configurará Mercos.

Credenciais, ambiente, status e configurações ficam por loja.

## 5. ERP connectors

### Bling

Primeiro conector real planejado para Brasil Drones.

Características:

- OAuth/app;
- access token e refresh token;
- JWT com `enable-jwt: 1`;
- callback server-side;
- token refresh;
- webhooks;
- sincronização de produtos, estoque e pedidos.

### Mercos

Conector futuro planejado para LB London.

Características:

- autenticação por `ApplicationToken` e `CompanyToken`;
- sandbox e homologação;
- tratamento de throttling/erro 429;
- sync incremental com `alterado_apos`;
- webhooks com HMAC-SHA256.

### Outros ERPs futuros

- Omie;
- Tiny;
- Olist.

## 6. Payment connectors

Beta:

- Mercado Pago — Checkout Pro, retorno, webhook assinado e conciliação inicial.

Planejados:

- Asaas;
- Pagar.me;
- Stripe.

Interface conceitual:

```ts
interface PaymentConnector {
  testConnection(storeId: string): Promise<ConnectionStatus>
  createPayment(storeId: string, orderId: string): Promise<PaymentResult>
  getPaymentStatus(storeId: string, externalPaymentId: string): Promise<PaymentStatus>
  refund(storeId: string, paymentId: string): Promise<RefundResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 7. Shipping connectors

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
  testConnection(storeId: string): Promise<ConnectionStatus>
  calculateRates(input: ShippingRateInput): Promise<ShippingRate[]>
  createShipment(storeId: string, orderId: string): Promise<ShipmentResult>
  getTracking(storeId: string, trackingCode: string): Promise<TrackingResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 8. ERP connector interface

```ts
interface ErpConnector {
  testConnection(storeId: string): Promise<ConnectionStatus>
  syncProducts(storeId: string): Promise<SyncResult>
  syncInventory(storeId: string): Promise<SyncResult>
  sendOrder(storeId: string, orderId: string): Promise<ExternalOrderResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}
```

## 9. IA e canais futuros

Futuro:

- IA para descrição de produtos;
- recomendações de catálogo;
- assistente de loja;
- WhatsApp com IA;
- catálogo Meta/Instagram;
- análise de gargalos da operação.

A base deve registrar eventos, logs, erros e recomendações estruturadas desde cedo.

## 9.1 Growth, SEO e tráfego pago

Marketing também é conector da plataforma.

Regras:

- IDs públicos de GTM, GA4, Google Ads, Merchant Center e Meta Pixel ficam em
  `store_integrations.settings_json`.
- Token Meta CAPI fica criptografado em `store_integrations.credentials_encrypted`.
- Storefront não aceita HTML, scripts livres ou tags arbitrárias.
- GTM é a camada principal de tags client-side por loja.
- Conversões críticas de venda confirmada são registradas server-side em
  `marketing_events`.
- O evento de compra usa `event_id = purchase:{storeId}:{orderId}` para
  deduplicação entre browser e server.
- Google Ads compra é gerenciada via GTM/Google tag; o backend registra a venda
  confirmada como diagnóstico idempotente.
- Meta CAPI só envia `Purchase` quando há Pixel ID, token criptografado e
  consentimento de marketing.
- CPF/CNPJ nunca é enviado para Google ou Meta.

## 10. Regras de implementação

- Cada conector deve ter logs.
- Cada conector deve tratar erros.
- Cada conector deve suportar retries.
- Cada conector deve ser idempotente em operações críticas.
- Nenhum conector deve expor token no frontend.
- Webhooks devem ser salvos antes de processar.
- Credenciais pertencem à loja, não ao provider global.
- `integration_providers` não armazena segredo.
- `store_integrations` armazena configuração e credenciais criptografadas.

## 11. Regra obrigatória de documentação

Antes de implementar qualquer conector real:

1. Consultar fontes oficiais em `docs/integrations/official-sources.md`.
2. Preencher pesquisa técnica do provedor.
3. Validar autenticação, escopos, endpoints, webhooks e rate limits.
4. Criar tipos.
5. Criar client server-side.
6. Criar service.
7. Criar logs e idempotência.
8. Só então integrar com o admin/storefront.
