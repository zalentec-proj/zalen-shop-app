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
shipping_methods
shipments
shipment_events
```

## 7. Regra

O rastreio deve ficar salvo no pedido e, quando houver área do comprador, aparecer em “Meus pedidos”.
