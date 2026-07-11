# Resend — Pesquisa Técnica

## Escopo

E-mails transacionais da loja ativa:

- código de login do comprador;
- pedido recebido;
- pagamento aprovado, pendente ou falho;
- pedido enviado/rastreio.

Carrinho abandonado e sugestões de produtos ficam preparados por template/log, mas dependem de opt-in e automação posterior.

## Fontes oficiais consultadas

| Tema | Fonte |
|---|---|
| Envio de e-mail | https://resend.com/docs/api-reference/emails/send-email |
| Domínios verificados | https://resend.com/docs/dashboard/domains/introduction |
| API keys | https://resend.com/docs/api-reference/api-keys/create-api-key |
| Webhooks assinados | https://resend.com/docs/webhooks/verify-webhooks-requests |

## Decisão MVP

Modelo híbrido centralizado:

- a Zalen mantém `RESEND_API_KEY` server-side;
- cada loja tem configuração própria em `store_email_settings`;
- cada envio é registrado em `email_messages` com `store_id`;
- remetente da loja só é usado quando o domínio estiver verificado;
- enquanto o domínio da loja não estiver verificado, o sistema usa o fallback `EMAIL_DEFAULT_FROM`.

## Endpoint usado

`POST https://api.resend.com/emails`

Headers:

- `Authorization: Bearer {RESEND_API_KEY}`;
- `Content-Type: application/json`;
- `Idempotency-Key` em envios transacionais determinísticos.

Payload base:

```json
{
  "from": "Brasil Drones <compras@brasildrones.com.br>",
  "to": ["comprador@example.com"],
  "reply_to": "atendimento@brasildrones.com.br",
  "subject": "Pedido recebido",
  "html": "<p>...</p>",
  "text": "..."
}
```

## Segurança

- `RESEND_API_KEY` fica apenas no servidor.
- Erros salvos em `email_messages` são sanitizados e não incluem segredo.
- E-mails são registrados por `store_id`, template e status.
- Envio da loja depende de domínio verificado.
- Chave própria por loja fica fora do MVP e exigirá vault/criptografia, teste de conexão e permissões mínimas.

## Variáveis

| Variável | Uso |
|---|---|
| `RESEND_API_KEY` | chave server-side da conta Resend central |
| `EMAIL_DEFAULT_FROM` | remetente fallback da Zalen |
| `EMAIL_DEFAULT_REPLY_TO` | reply-to fallback |

## Webhooks de entrega

Implementado no endpoint `POST /api/webhooks/resend`:

- assinatura Svix validada com `RESEND_WEBHOOK_SECRET` e corpo bruto;
- idempotência por `svix-id` em `email_webhook_events`;
- atualização segura de `email_messages` para `sent`, `delivered`, `bounced`,
  `complained` ou `suppressed`;
- erros de persistência retornam 503 para permitir retry do provedor; assinaturas
  inválidas retornam 401;
- administrador e operador podem consultar o histórico; viewer não lê
  destinatários nem histórico.

No painel Resend, cadastrar a URL HTTPS pública da loja/plataforma e selecionar
ao menos os eventos de envio, entrega, bounce, complaint e suppression.

## Fora do MVP

- UI completa para configurar domínio por loja;
- chave Resend própria por loja;
- automações de carrinho abandonado;
- IA de recomendações.
