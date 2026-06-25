# Envios e Logística

## 1. Decisão inicial

O MVP não deve tentar replicar logística completa da Nuvemshop ou do Bling.

## 2. MVP

- Retirada na loja.
- Frete fixo.
- Frete grátis acima de valor mínimo.
- Código de rastreio manual.
- Status de envio no pedido.
- E-mail/status para o comprador, se implementado.

## 2.1 Implementação nativa — Fase 1

A Zalen passa a tratar frete como domínio server-side próprio. O storefront
envia itens e endereço; o servidor recalcula preços, gera cotações nativas e
salva a opção escolhida no pedido.

Métodos nativos suportados:

- `fixed` — frete fixo configurado por loja.
- `pickup` — retirada local, liberada somente quando houver origem ativa.
- `manual` — entrega operacional configurada manualmente pela loja.

Decisões congeladas:

- O carrinho continua no navegador.
- A cotação fica em `shipping_quotes` e expira em 30 minutos.
- O checkout envia apenas `shippingQuoteId` ao finalizar.
- O servidor revalida loja, itens, hash dos itens, CEP, expiração e preço.
- Frete grátis é regra do método nativo, não cálculo do frontend.
- Métodos nativos não exigem peso/dimensões.
- Peso interno das variantes é kg; dimensões são cm.
- Provider externo não usa fallback físico silencioso.

Seed inicial Brasil Drones:

- Entrega Brasil Drones ativa.
- Valor: R$49,90.
- Frete grátis acima de R$500.
- Prazo: 2 a 4 dias úteis.
- Retirada local desativada até origem ativa cadastrada.

## 3. Bling

Se o lojista desejar, o Bling pode continuar cuidando de:

- separação;
- nota;
- etiqueta;
- DANFE;
- integração com logística;
- rastreio;
- Melhor Envio.

## 4. Melhor Envio

Integração prevista para fase posterior.

Melhor Envio não deve ser chamado até a pesquisa técnica oficial estar
preenchida em `docs/integrations/melhor-envio-research-template.md`.

Possíveis recursos:

- cotação automática de frete;
- geração de etiqueta;
- rastreamento;
- atualização automática do pedido;
- cálculo por CEP.

## 5. Fluxo ideal futuro

```txt
Cliente informa CEP
↓
Zalen calcula frete via conector
↓
Cliente escolhe modalidade
↓
Pedido é criado
↓
Etiqueta/rastreio é gerado
↓
Cliente acompanha pelo pedido
```

## 6. Tabelas futuras

```txt
store_shipping_origins
shipping_methods
shipping_quotes
shipments
shipment_events
```

## 7. Regra

O rastreio deve ficar salvo no pedido e, quando houver área do comprador, aparecer em “Meus pedidos”.
