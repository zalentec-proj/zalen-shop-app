# Pesquisa Técnica — Meta Pixel e Conversions API

## Escopo

Base de rastreio para Meta Ads na Zalen Shop:

- Meta Pixel no navegador após consentimento.
- Meta Conversions API server-side para venda aprovada.
- Deduplicação entre browser e server com `event_id`.
- Diagnóstico seguro em `marketing_events`.

Esta entrega não cria campanhas, públicos, catálogos ou orçamento via API Meta.

## Fontes oficiais consultadas

- Meta Business SDK for Node.js: https://github.com/facebook/facebook-nodejs-business-sdk
- SDK `FacebookAdsApi` com Graph API version: https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/api.js
- SDK `EventRequest` para endpoint `/events`: https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/objects/serverside/event-request.js
- SDK `ServerEvent`: https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/objects/serverside/server-event.js
- SDK `UserData`: https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/objects/serverside/user-data.js
- SDK `CustomData`: https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/objects/serverside/custom-data.js

Observação: páginas web do Meta Developers podem exigir sessão. Para evitar
assumir payloads, esta pesquisa usa o SDK oficial publicado pela Meta como fonte
primária de endpoint, versão e campos.

## Decisões para Zalen Shop

- Pixel ID fica em `store_integrations.settings_json` do provider `meta_pixel`.
- Token CAPI fica criptografado em `store_integrations.credentials_encrypted`
  do provider `meta_conversions_api`.
- O navegador carrega Meta Pixel apenas após aceite de marketing.
- CAPI envia `Purchase` apenas quando o pedido transiciona para pago pela
  primeira vez.
- O mesmo `event_id` é usado no browser e no server:

```txt
purchase:{storeId}:{orderId}
```

- CAPI usa o endpoint oficial equivalente ao SDK:

```txt
https://graph.facebook.com/v25.0/{pixelId}/events
```

## Evento Purchase CAPI

Campos server-side:

- `event_name = Purchase`
- `event_time`
- `event_id`
- `action_source = website`
- `event_source_url`
- `custom_data.currency = BRL`
- `custom_data.value`
- `custom_data.order_id`
- `custom_data.content_ids`
- `custom_data.contents`
- `custom_data.num_items`
- `user_data.em` e `user_data.ph` somente quando consentido, normalizado e
  hash SHA-256.
- `user_data.fbp` e `user_data.fbc` quando capturados com consentimento.
- `test_event_code` opcional por loja.

## Segurança e privacidade

- CPF/CNPJ nunca é enviado para Meta.
- E-mail e telefone só entram no payload como SHA-256 quando houver consentimento
  de marketing e `ad_user_data`.
- Token CAPI nunca aparece no HTML, no frontend, em logs ou em `NEXT_PUBLIC_*`.
- Falhas de envio gravam erro seguro, sem token e sem PII.
- `marketing_events` garante idempotência por
  `store_id + provider_key + event_name + event_id`.
