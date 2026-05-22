# Pesquisa Técnica — Bling

> Status: **NÃO INICIADA**
> Preencher consultando exclusivamente: https://developer.bling.com.br

---

## Fonte oficial

Links consultados durante a pesquisa:

- [ ] https://developer.bling.com.br/bling-api
- [ ] https://developer.bling.com.br/migracao-jwt
- [ ] https://developer.bling.com.br/aplicativos
- [ ] https://developer.bling.com.br/webhooks

---

## Objetivo da integração

O Bling será o ERP operacional da loja Brasil Drones. A Zalen Shop é a vitrine e experiência de venda. O Bling não é exposto ao cliente final — toda comunicação é server-side.

Responsabilidades do conector Bling:
- Sincronizar catálogo de produtos e estoque do Bling para o banco Zalen.
- Enviar pedidos confirmados do Zalen para o Bling.
- Receber atualizações de status de pedido via webhook.
- Sincronizar categorias.

---

## OAuth 2.0

> Preencher com base em: https://developer.bling.com.br/aplicativos

### URL de autorização
```
# A preencher após consulta à documentação oficial
```

### URL de callback
```
# Definir após consulta — será algo como:
# {APP_URL}/integrations/bling/callback
```

### Troca de authorization_code por tokens
```
# Endpoint: a preencher
# Método: a preencher
# Parâmetros: a preencher
```

### access_token
- Formato: a preencher (JWT ou opaque)
- Expiração: a preencher
- Header de uso: a preencher

### refresh_token
- Expiração: a preencher
- Endpoint de renovação: a preencher
- Parâmetros: a preencher

### Header enable-jwt
```
# Verificar se é necessário e como usar
# Referência: https://developer.bling.com.br/migracao-jwt
```

---

## Escopos

> Preencher com base na documentação oficial de escopos do Bling.

| Escopo | Finalidade | Necessário |
|---|---|---|
| produtos | Leitura/escrita de produtos | A confirmar |
| categorias | Leitura de categorias | A confirmar |
| estoque | Leitura de estoque | A confirmar |
| pedidos | Criação e leitura de pedidos | A confirmar |
| notas | Emissão de notas fiscais | A confirmar |
| webhooks | Recebimento de eventos | A confirmar |

---

## Produtos

> Preencher com endpoints reais da documentação.

### Listar produtos
```
# Método: a preencher
# Endpoint: a preencher
# Parâmetros de filtro: a preencher
# Paginação: a preencher
```

### Buscar produto por ID
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de resposta (produto)
```json
// A preencher com exemplo real da documentação
```

---

## Estoque

> Preencher com endpoints reais da documentação.

### Consultar estoque
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de resposta (estoque)
```json
// A preencher com exemplo real da documentação
```

---

## Pedidos

> Preencher com endpoints reais da documentação.

### Criar pedido
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de criação (pedido)
```json
// A preencher com exemplo real da documentação
```

### Payload de resposta (pedido)
```json
// A preencher com exemplo real da documentação
```

### Atualizar status de pedido
```
# Método: a preencher
# Endpoint: a preencher
```

---

## Webhooks

> Preencher com base em: https://developer.bling.com.br/webhooks

### Eventos disponíveis
```
# A preencher — listar todos os eventos relevantes
```

### Validação de assinatura
```
# Algoritmo: a preencher (HMAC-SHA256 ou outro)
# Header com assinatura: a preencher
# Como calcular: a preencher
```

### Payload de webhook
```json
// A preencher com exemplo real da documentação
```

### Idempotência
```
# Campo de deduplicação: a preencher
# Estratégia: verificar webhook_events antes de processar
```

### Retry
```
# Política de retry do Bling: a preencher
# Quantas tentativas: a preencher
# Intervalo: a preencher
```

---

## Segurança

- [ ] Tokens armazenados criptografados em `integration_tokens`
- [ ] Tokens nunca expostos no frontend
- [ ] Tokens nunca salvos em logs
- [ ] Webhook validado por assinatura antes de processar
- [ ] State anti-CSRF no fluxo OAuth
- [ ] Credenciais de sandbox separadas de produção
- [ ] Variáveis de ambiente definidas em `.env.example`

---

## Variáveis de ambiente necessárias

```env
# A preencher após pesquisa
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=
```

---

## Dúvidas pendentes

> Registrar aqui qualquer ponto não encontrado ou não claro na documentação oficial.

- [ ] Confirmar formato exato do access_token (JWT ou opaque)
- [ ] Confirmar algoritmo de validação de webhook
- [ ] Confirmar escopos mínimos necessários
- [ ] Confirmar se sandbox está disponível e como acessar
- [ ] Confirmar rate limit da API
