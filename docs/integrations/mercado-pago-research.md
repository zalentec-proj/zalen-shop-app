# Pesquisa Técnica — Mercado Pago

> Status: **PARCIAL — Checkout Pro + conciliação inicial**
> Fonte de verdade: documentação oficial Mercado Pago Developers.

## Fontes oficiais consultadas

- https://www.mercadopago.com.br/developers/pt
- https://www.mercadopago.com.br/developers/pt/docs
- https://www.mercadopago.com.br/developers/pt/docs/sdks-library/landing
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/create-payment-preference
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications
- https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials
- https://www.mercadopago.com.br/developers/pt/docs/mcp-server/overview
- https://www.mercadopago.com.br/developers/pt/docs/mcp-server/connection
- https://www.mercadopago.com.br/developers/pt/docs/mcp-server/tools
- https://documenter.getpostman.com/view/15366798/2sAXjKasp4

## Decisão de produto

Primeira versão usa **Checkout Pro**.

Motivos:

- menor exposição PCI para a Zalen;
- Pix, cartão e boleto ficam no ambiente seguro do Mercado Pago;
- checkout convidado da loja continua sem exigir conta;
- backend cria uma preferência por pedido e retorna somente a URL pública de pagamento.

Checkout Transparente fica fora desta fase.

## Autenticação e credenciais

Credenciais oficiais:

- `Public Key`: geralmente usada no frontend para recursos como tokenização de cartão;
- `Access Token`: chave privada usada sempre no backend para gerar pagamentos.

Uso seguro:

- `Access Token` nunca deve ir para Client Components, HTML, respostas públicas ou logs;
- chamadas API usam `Authorization: Bearer {{YOUR_ACCESS_TOKEN}}`;
- credenciais de teste e produção devem ser separadas por ambiente.

Variáveis previstas:

```env
MERCADO_PAGO_ENV=test
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_WEBHOOK_SECRET=
```

Nesta fase a Zalen usa `MERCADO_PAGO_ACCESS_TOKEN` server-side. `Public Key` fica reservado para Checkout Transparente/Bricks. O ambiente deve ser definido por `MERCADO_PAGO_ENV`, porque credenciais de teste podem não usar prefixo `TEST-`.

## Checkout Pro

SDK Node oficial:

```ts
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: 'YOUR_ACCESS_TOKEN' });
const preference = new Preference(client);

await preference.create({
  body: {
    items: [
      {
        title: 'Meu produto',
        quantity: 1,
        unit_price: 2000,
      },
    ],
  },
});
```

Campos usados pela Zalen:

- `items`: itens do pedido com `id`, `title`, `quantity`, `unit_price`, `currency_id`;
- `payer`: e-mail, nome, telefone e CPF/CNPJ para pre-preenchimento;
- `external_reference`: `order.id` interno da Zalen;
- `metadata`: `store_id`, `order_id`, `order_number`;
- `back_urls`: rotas de sucesso, pendente e falha;
- `notification_url`: rota de webhook quando houver URL HTTPS.

A resposta da preferência contém `id`, `init_point` e `sandbox_init_point`. Tokens de acesso não aparecem na resposta ao frontend.

## Webhooks

A documentação recomenda Webhooks para receber atualizações de pagamento sem polling.

Configuração:

- via painel "Suas integrações";
- ou por preferência (`notification_url`), que tem prioridade quando informado.

Evento inicial:

- `payment`.

Validação:

- header `x-signature`;
- header `x-request-id`;
- query/body `data.id`;
- secret gerado na configuração de Webhooks.

O SDK oficial expõe:

```ts
import { WebhookSignatureValidator } from 'mercadopago';

WebhookSignatureValidator.validate({
  xSignature,
  xRequestId,
  dataId,
  secret,
});
```

Estratégia Zalen implementada:

- validar assinatura antes de processar;
- salvar evento em `webhook_events`;
- consultar o pagamento server-side por `GET /v1/payments/{payment_id}`;
- atualizar `payment_transactions` e `orders` pelo `external_reference` do
  pagamento, que aponta para `orders.id`;
- manter idempotência por `store_id + order_id + provider`;
- não salvar token, credencial ou payload completo do pagamento em resposta
  pública.

## MCP Server Mercado Pago

O MCP Server remoto fica em:

```json
{
  "mcpServers": {
    "mercadopago-mcp-server": {
      "url": "https://mcp.mercadopago.com/mcp"
    }
  }
}
```

Tools documentadas:

- `search-documentation`;
- `quality_checklist`;
- `quality_evaluation`;
- `save_webhook`;
- `notifications_history_diagnostics`;
- `create_test_user`;
- `add_money_test_user`;
- `get_credentials` via OAuth;
- `create_application` via OAuth;
- `get_application` via OAuth.

Nesta sessão o MCP do Mercado Pago não estava disponível nas tools do agente. A implementação segue com documentação oficial + SDK oficial. Próximos passos podem usar MCP para criar usuários de teste, configurar webhook e rodar checklist de qualidade.

## Status de pagamento

Mapeamento inicial implementado:

| Mercado Pago | Ação Zalen planejada |
|---|---|
| `pending`, `in_process`, `authorized`, `in_mediation` | manter pedido pendente |
| `approved` | marcar `payment_status = paid`, `status = confirmed` e disparar envio Bling |
| `rejected` | marcar `payment_status = failed` |
| `cancelled`, `charged_back` | marcar `payment_status = failed` |
| `refunded` | marcar `payment_status = refunded` |
| desconhecido | registrar transação como `error`, sem alterar pedido |

Antes de marcar `approved`, a Zalen compara `transaction_amount` com `orders.total`
em centavos. Divergência registra `payment_amount_mismatch` e não marca o pedido
como pago.

## Retorno + webhook

A primeira versão usa estratégia híbrida:

- rotas `/pagamento/mercado-pago/{sucesso,pendente,falha}` consultam o pagamento
  quando o Mercado Pago retorna com `payment_id` ou `collection_id`;
- `/api/webhooks/mercado-pago` valida assinatura e processa eventos `payment`;
- ambos usam o mesmo service server-side de conciliação;
- carrinho local só é limpo no retorno aprovado.

## Fora desta fase

- Checkout Transparente/Bricks;
- tokenização de cartão no frontend;
- captura manual;
- reembolso automático;
- split/marketplace financeiro;
- OAuth Mercado Pago multi-loja.
