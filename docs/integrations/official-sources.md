# Fontes Oficiais das Integrações

> Consulte sempre estas fontes antes de implementar qualquer integração.
> Não use tutoriais de terceiros, Stack Overflow ou exemplos de IA como fonte de verdade para endpoints, payloads ou fluxos OAuth.

---

## Bling

| Recurso | URL |
|---|---|
| API v3 — Visão geral | https://developer.bling.com.br/bling-api |
| Migração para JWT | https://developer.bling.com.br/migracao-jwt |
| Aplicativos e OAuth | https://developer.bling.com.br/aplicativos |
| Webhooks | https://developer.bling.com.br/webhooks |

**Notas:**
- O Bling usa OAuth 2.0 com `authorization_code`.
- A renovação de token usa `refresh_token`.
- O header `enable-jwt: 1` é necessário para receber JWT nas respostas.
- Consultar a documentação de webhooks para validação de assinatura antes de implementar.

---

## Mercado Pago

| Recurso | URL |
|---|---|
| Portal do desenvolvedor | https://www.mercadopago.com.br/developers/pt |
| Documentação geral | https://www.mercadopago.com.br/developers/pt/docs |
| Checkout Pro — Visão geral | https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview |
| Checkout Transparente (API) | https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing |
| Notificações de pagamento | https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications |
| OAuth — criação de access token | https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation |
| OAuth — renovação de token | https://www.mercadopago.com.br/developers/pt/docs/security/oauth/renewal |

**Notas:**
- Verificar se o projeto usará Checkout Pro ou Checkout Transparente.
- Notificações (webhooks) devem ser validadas antes de atualizar status de pedido.
- Ambiente sandbox disponível para testes.
- O modelo multi-lojista usa uma aplicação OAuth da Zalen e credenciais
  criptografadas por loja em `store_integrations`.

---

## Resend

| Recurso | URL |
|---|---|
| Documentação geral | https://resend.com/docs |
| Enviar e-mail | https://resend.com/docs/api-reference/emails/send-email |
| Domínios | https://resend.com/docs/dashboard/domains/introduction |
| API keys | https://resend.com/docs/api-reference/api-keys/create-api-key |
| Webhooks | https://resend.com/docs/api-reference/webhooks/create-webhook |

**Notas:**
- A chave `RESEND_API_KEY` é server-side e nunca deve ir para o frontend.
- Domínios/subdomínios devem ser verificados antes de usar remetente da loja.
- No MVP, a Zalen usa uma conta Resend central e registra envios por `store_id`.
- Chave própria por loja é fase posterior e deve ser guardada criptografada.

---

## ViaCEP

| Recurso | URL |
|---|---|
| Documentação geral | https://viacep.com.br/ |
| Consulta CEP JSON | https://viacep.com.br/ws/01001000/json/ |

**Notas:**
- O CEP deve ser enviado com 8 dígitos.
- Formato inválido retorna HTTP 400.
- CEP válido inexistente retorna JSON com `erro: true`.
- Não exige token e deve ser chamado server-side pela Zalen.
- Uso massivo para validação de bases locais pode ser bloqueado pelo provedor.

---

## SuperFrete

| Recurso | URL |
|---|---|
| Primeiros passos | https://superfrete.readme.io/reference/primeiros-passos |
| Cálculo de frete | https://superfrete.readme.io/reference/frete |
| Cotação de frete | https://superfrete.readme.io/reference/cotacao-de-frete |
| Informações dos pacotes | https://superfrete.readme.io/reference/informações-dos-pacotes |
| Autenticação | https://superfrete.readme.io/reference/autenticação |

**Notas:**
- Na V1, usar somente `POST /api/v0/calculator`.
- Não implementar etiqueta, pagamento de etiqueta, impressão, webhook ou rastreio direto.
- Token deve ficar apenas no servidor.

---

## Melhor Envio

| Recurso | URL |
|---|---|
| Documentação geral | https://docs.melhorenvio.com.br |
| Autenticação | https://docs.melhorenvio.com.br/docs/autenticacao-1 |

**Notas:**
- Verificar se usa OAuth 2.0 ou API Key.
- Consultar endpoints de cotação, geração de etiqueta e rastreamento.
- Verificar disponibilidade de webhooks para rastreamento.

---

## Asaas (futuro)

| Recurso | URL |
|---|---|
| Documentação geral | https://docs.asaas.com |

---

## Pagar.me (futuro)

| Recurso | URL |
|---|---|
| Documentação geral | https://docs.pagar.me |

---

## Regra de uso

Antes de implementar qualquer integração:

1. Abrir a documentação oficial do provedor.
2. Ler o fluxo de autenticação completo.
3. Identificar os endpoints necessários.
4. Preencher o arquivo de pesquisa técnica correspondente.
5. Só então começar a implementação.
