# Pesquisa Técnica — Mercado Pago

> Status: **NÃO INICIADA**
> Preencher consultando exclusivamente: https://www.mercadopago.com.br/developers/pt/docs

---

## Fonte oficial

Links consultados durante a pesquisa:

- [ ] https://www.mercadopago.com.br/developers/pt
- [ ] https://www.mercadopago.com.br/developers/pt/docs
- [ ] https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview
- [ ] https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
- [ ] https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications

---

## Decisão de produto pendente

> Antes de pesquisar, definir qual modalidade será usada:

- [ ] **Checkout Pro** — redireciona para página do Mercado Pago
- [ ] **Checkout Transparente (API)** — formulário dentro da loja
- [ ] **Ambos** — dependendo do método de pagamento

---

## OAuth / Autenticação

> Preencher com base na documentação oficial.

### Tipo de autenticação
```
# API Key (access_token) ou OAuth 2.0?
# A confirmar na documentação
```

### access_token
- Onde obter: a preencher (painel do desenvolvedor)
- Formato: a preencher
- Expiração: a preencher
- Header de uso: a preencher

### Ambiente sandbox
```
# URL base sandbox: a preencher
# Credenciais de teste: a preencher (como obter)
```

### Ambiente produção
```
# URL base produção: a preencher
```

---

## Checkout Pro

> Preencher com base em: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview

### Criar preferência de pagamento
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de criação (preferência)
```json
// A preencher com exemplo real da documentação
```

### Payload de resposta
```json
// A preencher — incluindo init_point (URL de redirecionamento)
```

### Fluxo completo
```
# 1. Backend cria preferência
# 2. Frontend redireciona para init_point
# 3. Cliente paga no Mercado Pago
# 4. Mercado Pago notifica via webhook
# 5. Backend valida e atualiza pedido
```

---

## Checkout Transparente (API)

> Preencher com base em: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing

### Tokenização de cartão
```
# Como funciona: a preencher
# SDK necessário: a preencher
# Dados que ficam no frontend vs backend: a preencher
```

### Criar pagamento
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de criação (pagamento)
```json
// A preencher com exemplo real da documentação
```

---

## Pix

> Preencher com base na documentação oficial.

### Criar cobrança Pix
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de resposta (QR Code)
```json
// A preencher — incluindo qr_code e qr_code_base64
```

### Expiração do Pix
```
# Tempo padrão: a preencher
# Como configurar: a preencher
```

---

## Cartão de crédito

> Preencher com base na documentação oficial.

### Parcelamento
```
# Como configurar: a preencher
# Juros: a preencher
```

### 3DS / Autenticação
```
# Necessário: a confirmar
# Como implementar: a preencher
```

---

## Webhook / Notificações

> Preencher com base em: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications

### Tipos de notificação
```
# IPN vs Webhooks: a preencher (diferença e qual usar)
```

### Eventos disponíveis
```
# A preencher — listar eventos relevantes (payment, merchant_order, etc.)
```

### Validação de assinatura
```
# Header com assinatura: a preencher
# Algoritmo: a preencher
# Como calcular: a preencher
```

### Payload de notificação
```json
// A preencher com exemplo real da documentação
```

### Idempotência
```
# Campo de deduplicação: a preencher
# Estratégia: verificar webhook_events antes de processar
```

---

## Status de pagamento

> Preencher com base na documentação oficial.

| Status | Significado | Ação no pedido |
|---|---|---|
| pending | A preencher | A preencher |
| approved | A preencher | A preencher |
| rejected | A preencher | A preencher |
| cancelled | A preencher | A preencher |
| refunded | A preencher | A preencher |

---

## Reembolso

### Reembolso total
```
# Método: a preencher
# Endpoint: a preencher
```

### Reembolso parcial
```
# Método: a preencher
# Endpoint: a preencher
# Payload: a preencher
```

---

## Variáveis de ambiente necessárias

```env
# A preencher após pesquisa
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_WEBHOOK_SECRET=
```

---

## Segurança

- [ ] access_token nunca exposto no frontend
- [ ] public_key pode ser exposta no frontend (confirmar)
- [ ] Webhook validado por assinatura antes de processar
- [ ] Tokenização de cartão feita via SDK (dados sensíveis nunca passam pelo servidor)
- [ ] Idempotência implementada para pagamentos
- [ ] Credenciais de sandbox separadas de produção

---

## Dúvidas pendentes

- [ ] Checkout Pro ou Transparente — decisão de produto pendente
- [ ] Confirmar se public_key pode aparecer no frontend
- [ ] Confirmar algoritmo de validação de webhook
- [ ] Confirmar rate limit da API
- [ ] Confirmar comportamento de reembolso parcial
- [ ] Confirmar disponibilidade de Pix no sandbox
