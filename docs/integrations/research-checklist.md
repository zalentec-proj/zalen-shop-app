# Checklist de Pesquisa Técnica — Integrações

> Preencha este checklist para cada provedor antes de iniciar qualquer implementação.
> Nenhum item pode ser marcado como "assumido" — deve ser confirmado na documentação oficial.

---

## Como usar

1. Copie este checklist para o arquivo de pesquisa do provedor.
2. Preencha cada item com a informação encontrada na documentação oficial.
3. Registre o link da fonte para cada item.
4. Itens não encontrados devem ir para "Dúvidas pendentes".

---

## Checklist padrão

### Autenticação

- [ ] Fluxo de autenticação documentado (OAuth 2.0 / API Key / outro)
- [ ] Tipo de token (JWT / opaque / outro)
- [ ] URL de autorização (se OAuth)
- [ ] URL de troca de código por token (se OAuth)
- [ ] Parâmetros obrigatórios do fluxo OAuth
- [ ] Como renovar o token (refresh_token / reautenticação)
- [ ] Tempo de expiração do access_token
- [ ] Tempo de expiração do refresh_token
- [ ] Headers obrigatórios nas requisições autenticadas
- [ ] Onde armazenar credenciais (apenas servidor, criptografado)

### Escopos e permissões

- [ ] Lista de escopos disponíveis documentada
- [ ] Escopos mínimos necessários para o projeto identificados
- [ ] Como solicitar escopos no fluxo OAuth

### Endpoints

- [ ] URL base da API (produção)
- [ ] URL base da API (sandbox/teste)
- [ ] Endpoints necessários listados com método HTTP
- [ ] Parâmetros obrigatórios de cada endpoint documentados
- [ ] Parâmetros opcionais relevantes documentados

### Payloads

- [ ] Payload de criação documentado (com exemplo real da doc oficial)
- [ ] Payload de resposta documentado (com exemplo real da doc oficial)
- [ ] Campos obrigatórios identificados
- [ ] Tipos de dados confirmados

### Webhooks

- [ ] Eventos disponíveis listados
- [ ] Formato do payload de webhook documentado
- [ ] Método de validação de assinatura documentado (HMAC / outro)
- [ ] Header com assinatura identificado
- [ ] Algoritmo de hash confirmado
- [ ] Implementação de idempotência planejada (campo de deduplicação)
- [ ] Política de retry do provedor documentada

### Rate limit

- [ ] Limite de requisições por minuto/hora documentado
- [ ] Comportamento em caso de rate limit (código HTTP, retry-after)
- [ ] Estratégia de retry planejada

### Erros comuns

- [ ] Códigos de erro documentados
- [ ] Erros de autenticação identificados
- [ ] Erros de validação identificados
- [ ] Comportamento esperado em caso de timeout

### Ambiente de testes

- [ ] Sandbox disponível confirmado
- [ ] Credenciais de sandbox separadas das de produção
- [ ] Limitações do sandbox documentadas

### Variáveis de ambiente

- [ ] Lista de variáveis necessárias definida
- [ ] Variáveis públicas (`NEXT_PUBLIC_`) identificadas (nenhuma deve ser token)
- [ ] Variáveis secretas identificadas (apenas servidor)
- [ ] `.env.example` atualizado

### Segurança

- [ ] Tokens nunca expostos no frontend
- [ ] Tokens nunca salvos em logs
- [ ] Webhook validado antes de processar
- [ ] Idempotência implementada
- [ ] Credenciais de produção separadas de desenvolvimento

### Critérios de aceite

- [ ] Fluxo de autenticação testado em sandbox
- [ ] Endpoints testados em sandbox
- [ ] Webhook recebido e validado em sandbox
- [ ] Erros tratados corretamente
- [ ] Logs sem dados sensíveis

---

## Dúvidas pendentes

> Liste aqui qualquer ponto que não ficou claro na documentação oficial.
> Não implemente até que as dúvidas sejam resolvidas.

- [ ] (vazio — preencher durante a pesquisa)
