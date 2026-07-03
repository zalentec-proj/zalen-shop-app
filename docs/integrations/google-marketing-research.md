# Pesquisa Técnica — Google Marketing, SEO e Merchant Center

## Escopo

Base para tráfego pago e crescimento orgânico na Zalen Shop:

- Google Tag Manager / Google tag com Consent Mode.
- GA4 ecommerce events.
- Google Ads conversion tracking e enhanced conversions.
- Google Merchant Center product feed.
- SEO técnico, sitemap, robots e dados estruturados.

Esta entrega não cria campanhas, públicos, anúncios ou orçamento via API.

## Fontes oficiais consultadas

- Google Tag Platform — Consent Mode: https://developers.google.com/tag-platform/security/guides/consent
- GA4 ecommerce events: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google Ads enhanced conversions: https://support.google.com/google-ads/answer/9888656
- Merchant Center product data specification: https://support.google.com/merchants/answer/7052112
- Google Search SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Product structured data: https://developers.google.com/search/docs/appearance/structured-data/product
- Sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Robots.txt: https://developers.google.com/search/docs/crawling-indexing/robots/intro

## Decisões para Zalen Shop

- GTM é a camada principal de tags por loja.
- Consentimento padrão é restritivo: `ad_storage`, `analytics_storage`,
  `ad_user_data` e `ad_personalization` começam como negados.
- IDs públicos ficam em `store_integrations.settings_json`.
- Nenhum script livre, HTML livre ou tag arbitrária será aceito no admin.
- Eventos ecommerce são enviados para `dataLayer`.
- Conversão de venda confirmada usa `event_id = purchase:{storeId}:{orderId}`.
- Google Ads compra é gerenciada via GTM/Google tag; o backend registra o evento
  como diagnóstico e mantém a venda confirmada como fonte idempotente.
- Enhanced conversions só pode ser habilitado por loja e com consentimento.
- CPF/CNPJ nunca é enviado para Google.

## Eventos GA4

Eventos suportados nesta fase:

- `view_item_list`
- `view_item`
- `add_to_cart`
- `view_cart`
- `begin_checkout`
- `purchase`

Campos enviados:

- `currency = BRL`
- `value`
- `shipping`
- `transaction_id`
- `items` com `item_id`, `item_name`, `price`, `quantity`, marca/categoria quando disponíveis.

## Merchant Center

Endpoint público por loja:

```txt
/feeds/google-merchant.xml
```

Formato RSS 2.0 com namespace `g`.

Cada variante vendável gera um item com:

- `g:id`
- `g:title`
- `g:description`
- `g:link`
- `g:image_link`
- `g:availability`
- `g:price` em BRL
- `g:brand`
- `g:condition = new`
- `g:product_type`
- `g:google_product_category` opcional por loja

Itens sem preço, imagem ou URL pública válida são omitidos.

## SEO técnico

- `robots.txt` dinâmico por host.
- `sitemap.xml` dinâmico por loja.
- Canonical URL por página pública.
- `metadataBase`, Open Graph e Twitter.
- `noindex` para admin, login, conta, carrinho e retorno de pagamento.
- JSON-LD sanitizado para `Organization`, `WebSite`, `BreadcrumbList` e
  `Product`.

## Segurança e privacidade

- Tokens e service role não aparecem no frontend.
- Não há chamadas Google Ads API nesta fase.
- Dados pessoais para enhanced conversions dependem de consentimento e não são
  enviados diretamente pelo backend nesta fase.
- Click IDs e UTMs ficam em cookie first-party apenas após aceite.
