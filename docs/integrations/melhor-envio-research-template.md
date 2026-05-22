# Pesquisa Técnica — Melhor Envio

> Status: **NÃO INICIADA**
> Preencher consultando exclusivamente: https://docs.melhorenvio.com.br

---

## Fonte oficial

Links consultados durante a pesquisa:

- [ ] https://docs.melhorenvio.com.br
- [ ] https://docs.melhorenvio.com.br/docs/autenticacao-1

---

## OAuth / Autenticação

> Preencher com base em: https://docs.melhorenvio.com.br/docs/autenticacao-1

### Tipo de autenticação
```
# OAuth 2.0 ou API Key?
# A confirmar na documentação
```

### URL de autorização (se OAuth)
```
# A preencher
```

### URL de callback
```
# Definir após consulta
# Será algo como: {APP_URL}/integrations/melhor-envio/callback
```

### Troca de código por tokens
```
# Endpoint: a preencher
# Parâmetros: a preencher
```

### access_token
- Expiração: a preencher
- Header de uso: a preencher

### refresh_token
- Expiração: a preencher
- Endpoint de renovação: a preencher

### Ambiente sandbox
```
# URL base sandbox: a preencher
# Como obter credenciais de teste: a preencher
```

### Ambiente produção
```
# URL base produção: a preencher
```

---

## Cotação de frete

> Preencher com base na documentação oficial.

### Calcular frete
```
# Método: a preencher
# Endpoint: a preencher
```

### Payload de cotação
```json
// A preencher com exemplo real da documentação
// Incluir: CEP origem, CEP destino, dimensões, peso
```

### Payload de resposta (opções de frete)
```json
// A preencher — incluindo transportadora, prazo, preço
```

### Campos obrigatórios
```
# CEP de origem: a preencher (formato)
# CEP de destino: a preencher (formato)
# Peso: a preencher (unidade)
# Dimensões: a preencher (unidade)
# Valor declarado: a preencher (obrigatório?)
```

---

## Geração de etiqueta

> Preencher com base na documentação oficial.

### Adicionar item ao carrinho (Melhor Envio)
```
# Método: a preencher
# Endpoint: a preencher
# Payload: a preencher
```

### Comprar etiqueta
```
# Método: a preencher
# Endpoint: a preencher
```

### Imprimir etiqueta
```
# Método: a preencher
# Endpoint: a preencher
# Formato: a preencher (PDF, ZPL, etc.)
```

### Fluxo completo de etiqueta
```
# 1. a preencher
# 2. a preencher
# 3. a preencher
```

---

## Rastreamento

> Preencher com base na documentação oficial.

### Consultar rastreamento
```
# Método: a preencher
# Endpoint: a preencher
# Parâmetros: a preencher
```

### Payload de resposta (rastreamento)
```json
// A preencher com exemplo real da documentação
```

### Status disponíveis
```
# A preencher — listar status e significados
```

---

## Webhooks

> Verificar se o Melhor Envio oferece webhooks para atualizações de rastreamento.

### Disponibilidade
```
# Webhooks disponíveis: a confirmar na documentação
```

### Eventos disponíveis (se houver)
```
# A preencher
```

### Validação de assinatura (se houver)
```
# A preencher
```

---

## Variáveis de ambiente necessárias

```env
# A preencher após pesquisa
MELHOR_ENVIO_CLIENT_ID=
MELHOR_ENVIO_CLIENT_SECRET=
MELHOR_ENVIO_REDIRECT_URI=
MELHOR_ENVIO_TOKEN=
```

---

## Segurança

- [ ] Tokens armazenados criptografados em `integration_tokens`
- [ ] Tokens nunca expostos no frontend
- [ ] Tokens nunca salvos em logs
- [ ] CEP de origem configurado no servidor (não enviado pelo cliente)
- [ ] Valor do frete calculado no servidor (não confiado no valor enviado pelo browser)
- [ ] Credenciais de sandbox separadas de produção

---

## Dúvidas pendentes

- [ ] Confirmar se usa OAuth 2.0 ou API Key
- [ ] Confirmar se webhooks de rastreamento estão disponíveis
- [ ] Confirmar unidades de peso e dimensão aceitas
- [ ] Confirmar se sandbox está disponível e como acessar
- [ ] Confirmar rate limit da API
- [ ] Confirmar se o CEP de origem é fixo ou por pedido
