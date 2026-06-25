# Pesquisa Técnica — Mercado Pago

> Status: **Checkout Pro multi-lojista — OAuth por loja, fallback ENV legado e conciliação inicial**
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
- https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
- https://www.mercadopago.com.br/developers/pt/docs/security/oauth/renewal
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

Modelo atual:

- a Zalen possui uma aplicação OAuth Mercado Pago;
- cada loja autoriza sua própria conta Mercado Pago pelo admin;
- credenciais ficam criptografadas em `store_integrations.credentials_encrypted`
  por `store_id + provider_key + environment`;
- `settings_json` guarda apenas metadados seguros, como fonte da credencial,
  conta conectada, datas e status do Checkout Pro;
- o runtime prefere OAuth da loja e só usa ENV como fallback legado da Brasil
  Drones enquanto ela não reconectar.

OAuth oficial:

- autorização via `https://auth.mercadopago.com/authorization`;
- parâmetros usados: `client_id`, `response_type=code`, `platform_id=mp`,
  `state` assinado e `redirect_uri`;
- troca de código via `POST https://api.mercadopago.com/oauth/token`;
- payload de autorização inclui `grant_type=authorization_code`, `code`,
  `client_id`, `client_secret`, `redirect_uri` e `test_token=true` no ambiente
  de teste;
- renovação usa `grant_type=refresh_token`, `refresh_token`, `client_id` e
  `client_secret`;
- `offline_access` é necessário para refresh token.

Variáveis previstas da aplicação Zalen:

```env
MERCADO_PAGO_ENV=test
MERCADO_PAGO_CLIENT_ID=
MERCADO_PAGO_CLIENT_SECRET=
MERCADO_PAGO_REDIRECT_URI=
MERCADO_PAGO_WEBHOOK_SECRET_TEST=
MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION=

# fallback legado temporário Brasil Drones
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_WEBHOOK_SECRET=
```

`Public Key` fica reservado para Checkout Transparente/Bricks. O ambiente deve
ser definido por `MERCADO_PAGO_ENV`, porque credenciais de teste podem não usar
prefixo `TEST-`.

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
- `environment`: ambiente usado na preferência;
- `back_urls`: rotas de sucesso, pendente e falha;
- `notification_url`: rota de webhook quando houver URL HTTPS, sempre com
  `store_id` e `environment`.

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
- deduplicar notificação por identificador seguro salvo em `external_id`;
- consultar o pagamento server-side por `GET /v1/payments/{payment_id}` usando
  a credencial da loja e do ambiente do webhook;
- atualizar `payment_transactions` e `orders` pelo `external_reference` do
  pagamento, que aponta para `orders.id`;
- manter idempotência por `store_id + order_id + provider`;
- rejeitar divergência entre `metadata.store_id`, `external_reference` e pedido
  da loja;
- disparar envio ao Bling apenas quando o pedido transita de não pago para pago;
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

Configuração workspace adicionada em `.cursor/mcp.json`, conforme a
documentação oficial de conexão:

```json
{
  "mcpServers": {
    "mercadopago-mcp-server": {
      "url": "https://mcp.mercadopago.com/mcp"
    }
  }
}
```

Nesta sessão, o MCP do Mercado Pago ainda não ficou disponível como tool
executável do agente. O próximo passo é o cliente/IDE carregar essa configuração
e concluir a autenticação OAuth no Mercado Pago. A implementação runtime da
Zalen continua com documentação oficial + SDK/API oficial; o MCP será usado para
homologação, usuários de teste, configuração/diagnóstico de webhook e checklist
de qualidade.

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
- checkout valida configuração do Mercado Pago antes de criar pedido local;
- carrinho local só é limpo no retorno aprovado.

## Fora desta fase

- Checkout Transparente/Bricks;
- tokenização de cartão no frontend;
- captura manual;
- reembolso automático;
- split/marketplace financeiro;
- configuração automática de webhooks via MCP ou API.
