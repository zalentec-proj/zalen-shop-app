# Envios e Logística

## 1. Decisão inicial

O MVP não deve tentar replicar logística completa da Nuvemshop ou do Bling.

## 2. V1

- Cotação real no checkout via SuperFrete quote-only.
- Cliente escolhe transportadora/serviço antes do pagamento.
- Pedido salva snapshot da cotação.
- Pedido pago vai ao Bling com o frete escolhido.
- Bling continua como hub operacional de expedição, etiqueta e rastreio.
- Código de rastreio segue manual ou via sincronização futura do Bling.

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
- O frete grátis por produto vindo do Bling também é aplicado no servidor.
- O carrinho recebe frete grátis por produto somente quando todos os itens
  físicos estiverem marcados como elegíveis; carrinho misto mantém a cotação
  normal.
- A modalidade, transportadora e prazo calculados continuam visíveis e salvos;
  apenas o valor cobrado do comprador é zerado.
- Métodos nativos não exigem peso/dimensões.
- Peso interno das variantes é kg; dimensões são cm.
- Provider externo não usa fallback físico silencioso.
- SuperFrete usa `products[]`; se peso ou dimensões estiverem ausentes, a cotação é bloqueada.

Seed inicial Brasil Drones:

- SuperFrete quote-only ativo como provider externo de cotação.
- Entrega Brasil Drones ativa.
- Valor: R$49,90.
- Sem gratuidade automática por subtotal; a Brasil Drones usa somente a
  elegibilidade por produto sincronizada do Bling.
- Prazo: 2 a 4 dias úteis.
- Retirada local desativada até origem ativa cadastrada.

O fallback manual só deve ser usado quando explicitamente habilitado por
configuração de ambiente.

### 2.1.1 Frete grátis por produto do Bling

O detalhe oficial do produto Bling expõe `freteGratis`. A sincronização grava
esse valor em `products.free_shipping`, com `false` como padrão seguro quando o
campo não vier no payload.

Na cotação, a Zalen ainda consulta o provider para preservar serviço,
transportadora e prazo. Se todos os produtos físicos do carrinho tiverem
`free_shipping = true`, as opções persistidas recebem preço zero e guardam o
preço original nos metadados da cotação. A chave do cache inclui a elegibilidade
para que uma mudança no Bling não reutilize uma cotação paga antiga. A mesma
regra é recalculada no servidor antes da criação do pedido.

## 2.2 SuperFrete quote-only

A V1 usa apenas:

```http
POST /api/v0/calculator
```

Não usar na V1:

- envio de frete para carrinho SuperFrete;
- geração de etiqueta;
- pagamento de etiqueta;
- link de impressão;
- webhook;
- rastreio direto;
- OAuth por loja.

Serviços iniciais:

- `1` PAC;
- `2` SEDEX;
- `3` Jadlog;
- `17` Mini Envios.

Loggi depende da configuração do token SuperFrete e não deve ser incluída
manualmente no campo `services`.

## 3. Bling

Se o lojista desejar, o Bling pode continuar cuidando de:

- separação;
- nota;
- etiqueta;
- DANFE;
- integração com logística;
- rastreio;
- Melhor Envio.

## 4. SuperFrete e futuros providers

SuperFrete direta completa fica prevista para fase posterior.

Melhor Envio não deve ser chamado até a pesquisa técnica oficial estar
preenchida em `docs/integrations/melhor-envio-research-template.md`.

Possíveis recursos:

- geração de etiqueta;
- rastreamento;
- atualização automática do pedido;
- webhooks;
- cálculo por CEP para providers adicionais.

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
