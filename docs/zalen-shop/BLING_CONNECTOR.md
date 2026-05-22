# Integração Bling

## 1. Papel do Bling

O Bling será o ERP operacional.

A Zalen não deve substituir:

- nota fiscal;
- DANFE;
- estoque operacional;
- separação;
- financeiro;
- logística;
- certificado digital;
- automações internas.

## 2. Papel da Zalen

A Zalen será a vitrine e experiência de venda:

- loja online;
- layout;
- catálogo público;
- carrinho/pedido;
- área do comprador;
- status visual;
- integração com o Bling.

## 3. Autenticação

- Usar OAuth 2.0 Authorization Code.
- Usar JWT do Bling desde o início.
- Ao obter/renovar token, utilizar `enable-jwt: 1`.
- Armazenar access_token e refresh_token criptografados.
- Nunca expor token no frontend.

## 4. Escopo MVP

- Conectar conta Bling.
- Importar produtos.
- Importar categorias, quando aplicável.
- Sincronizar estoque básico.
- Criar pedido de venda no Bling.
- Receber webhooks de produto/estoque/pedido/nota.
- Registrar logs de integração.

## 5. Fluxo de produtos

Preferência inicial:

```txt
Bling como fonte principal
↓
Zalen importa/cacheia produtos
↓
Zalen exibe na loja
```

## 6. Fluxo de pedido

```txt
Cliente cria pedido na Zalen
↓
Zalen cria pedido local
↓
Zalen envia pedido ao Bling conforme regra operacional
↓
Bling opera nota, estoque, separação e envio
↓
Zalen atualiza status com base em webhook/sync
```

## 7. Logs obrigatórios

- product_sync_started
- product_sync_finished
- product_sync_failed
- order_send_started
- order_send_finished
- order_send_failed
- webhook_received
- webhook_processed
- token_refresh_failed

## 8. Fora do MVP

- Múltiplos depósitos.
- Financeiro completo.
- NF-e automática avançada.
- NFS-e/NFC-e.
- Ordem de serviço.
- Ordem de produção.
- POS.
