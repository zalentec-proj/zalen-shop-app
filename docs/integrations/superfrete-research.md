# Pesquisa Técnica — SuperFrete

## Fontes oficiais consultadas

- https://superfrete.readme.io/reference/primeiros-passos
- https://superfrete.readme.io/reference/frete
- https://superfrete.readme.io/reference/cotacao-de-frete
- https://superfrete.readme.io/reference/informações-dos-pacotes
- https://superfrete.readme.io/reference/autenticação

## Decisão V1

A SuperFrete será usada somente como camada de cotação no checkout.

Permitido na V1:

- `POST /api/v0/calculator`;
- cotação por CEP de origem, CEP de destino, serviços, peso e dimensões;
- envio de `products[]` para a API calcular a caixa ideal;
- persistência de snapshot sanitizado em `shipping_quotes`.

Fora da V1:

- envio de frete para carrinho SuperFrete;
- geração de etiqueta;
- pagamento de etiqueta;
- link de impressão;
- webhook;
- rastreio direto;
- OAuth por loja;
- tela de token SuperFrete.

## Endpoint de cotação

Base:

- sandbox: `https://sandbox.superfrete.com`
- produção: `https://api.superfrete.com`

Endpoint:

```http
POST /api/v0/calculator
```

Headers:

```http
Authorization: Bearer <token>
User-Agent: <SUPERFRETE_USER_AGENT>
Accept: application/json
Content-Type: application/json
```

## Payload V1

```json
{
  "from": { "postal_code": "01153000" },
  "to": { "postal_code": "20020050" },
  "services": "1,2,3,17",
  "options": {
    "own_hand": false,
    "receipt": false,
    "insurance_value": 0,
    "use_insurance_value": false
  },
  "products": [
    {
      "quantity": 1,
      "height": 4,
      "width": 3,
      "length": 3,
      "weight": 0.03
    }
  ]
}
```

Serviços usados inicialmente:

- `1` — PAC
- `2` — SEDEX
- `3` — Jadlog
- `17` — Mini Envios

Loggi não será enviada manualmente no campo `services`; depende da configuração do token SuperFrete.

## Segurança

- Token apenas em variável server-side.
- Variável preferida para o token inicial: `SUPERFRETE_API_TOKEN_BRASIL_DRONES`.
- Alias operacional aceito em produção: `SUPER_FRETE_API`.
- Nenhuma variável `NEXT_PUBLIC_*`.
- Não salvar token em banco, log, payload bruto ou resposta ao frontend.
- Não salvar header `Authorization`.
- Frontend recebe apenas cotação normalizada e `shippingQuoteId`.
- Antes do pagamento, o servidor revalida a cotação.

## Operação

### Preço e desconto da cotação

- `price` é o valor final normalizado e cobrado do comprador pela Zalen;
- `discount` é preservado apenas no snapshot sanitizado para auditoria e nunca
  é subtraído novamente;
- a Zalen não adiciona taxa ou margem sobre a cotação da SuperFrete;
- quando todos os produtos físicos têm frete grátis no Bling, o comprador paga
  zero e o `price` retornado pela SuperFrete fica preservado como custo de
  referência nos metadados internos da cotação.

Depois do pagamento aprovado, o pedido vai para o Bling com o frete escolhido.
A etiqueta e a expedição continuam sendo feitas operacionalmente no Bling/SuperFrete.
