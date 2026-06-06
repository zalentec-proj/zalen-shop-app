# Plano de Implementação — Bling Ready

## Status desta sprint

Implementada a base segura para preparar OAuth Bling da Brasil Drones, sem sync real de produtos, pedidos ou webhooks.

## O que foi implementado

- Registro inicial Brasil Drones → Bling em `store_integrations`, sem credenciais.
- Configuração server-side por env.
- Construção de URL de autorização OAuth.
- Callback OAuth server-side.
- Validação de `state` anti-CSRF.
- Troca de `authorization_code` por tokens apenas quando envs estiverem configuradas.
- Criptografia AES-256-GCM para credenciais quando `INTEGRATION_TOKEN_ENCRYPTION_KEY` existir.
- Bloqueio de persistência de tokens se criptografia estiver ausente.
- Página `/admin/integracoes/bling`.
- Botão de conexão a partir da seção de integrações do admin.

## Rotas

```txt
GET /api/integrations/bling/connect
GET /api/integrations/bling/callback
POST /api/integrations/bling/homologation/run
```

## Domínios oficiais

```txt
Homepage pública: https://www.zalenshop.com.br
Manual público: https://www.zalenshop.com.br/manual/bling
Redirect produção: https://app.zalenshop.com.br/api/integrations/bling/callback
Redirect local: http://localhost:3000/api/integrations/bling/callback
```

## Variáveis de ambiente

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=https://app.zalenshop.com.br/api/integrations/bling/callback
BLING_SCOPES=
BLING_ENV=production
INTEGRATION_TOKEN_ENCRYPTION_KEY=
```

Para desenvolvimento local, usar:

```env
BLING_REDIRECT_URI=http://localhost:3000/api/integrations/bling/callback
```

## Comportamento esperado

### Envs ausentes

- Página mostra aviso discreto.
- Botão de conexão fica indisponível.
- Rotas retornam falha controlada via redirect com `error`.

### Envs presentes, criptografia ausente

- Fluxo OAuth não é iniciado.
- Nenhum token é recebido ou salvo.
- Admin mostra aviso de criptografia pendente.

### Envs presentes e criptografia presente

- `/api/integrations/bling/connect` redireciona para autorização Bling.
- A URL de autorização envia apenas `response_type`, `client_id` e `state`;
  `redirect_uri` e `scope` ficam definidos no cadastro do app Bling.
- Callback valida `state`.
- Callback troca `code` por token server-side.
- Tokens são criptografados e salvos em `store_integrations.credentials_encrypted`.
- Status da loja passa para `connected`.

## Homologação oficial da API Bling

Fonte oficial: https://developer.bling.com.br/homologacao#execu%C3%A7%C3%A3o

A execução de homologação é server-side e só pode ser iniciada por usuário autenticado
com acesso à loja ativa. O frontend chama apenas a rota interna da Zalen Shop:

```txt
POST /api/integrations/bling/homologation/run
```

A rota descriptografa as credenciais salvas em
`store_integrations.credentials_encrypted`, executa a sequência oficial e retorna
somente um resumo por etapa. Access token e refresh token nunca são enviados ao
frontend, nunca são logados e nunca entram em payload público.

### Sequência executada

```txt
GET    https://api.bling.com.br/Api/v3/homologacao/produtos
POST   https://api.bling.com.br/Api/v3/homologacao/produtos
PUT    https://api.bling.com.br/Api/v3/homologacao/produtos/{id}
PATCH  https://api.bling.com.br/Api/v3/homologacao/produtos/{id}/situacoes
DELETE https://api.bling.com.br/Api/v3/homologacao/produtos/{id}
```

Regras implementadas:

- O body do `POST` usa os dados retornados em `data` pelo `GET`, sem wrapper.
- O `PUT` envia os dados atualizados do produto com `nome` alterado para `Copo`,
  conforme exemplo oficial.
- O `PATCH` envia `{ "situacao": "I" }`.
- O produto retornado pelo `POST` é removido no `DELETE`.

### Header `x-bling-homologacao`

A cada request de homologação, o Bling retorna um header
`x-bling-homologacao`. O valor recebido em uma etapa deve ser enviado na etapa
seguinte. Se o header estiver ausente, a execução para com falha controlada.

### Limites

- Tempo total máximo: 10 segundos.
- Limite entre requests: 2 segundos.
- A implementação usa deadline total de 10 segundos, timeout curto por request
  e aguarda 2 segundos entre chamadas para não acionar `429` no fluxo aceito
  pela homologação.

### Refresh token

Se uma chamada de homologação retornar erro compatível com token inválido ou
expirado, a rota tenta renovar o access token uma única vez usando o refresh
token, salva novamente as credenciais criptografadas e repete apenas a chamada
que falhou. Não há loop infinito.

Durante a homologação, o Bling pode invalidar o access token em uma das etapas
e retornar uma falha genérica `400`. A implementação trata `400` como candidato
a refresh apenas nesse fluxo controlado e repete a chamada uma única vez. Se a
falha persistir após o refresh, o erro é retornado sem nova tentativa.

### Resultado no admin

A página `/admin/integracoes/bling` mostra um bloco "Homologação" com:

- status geral;
- resultado de GET, POST, PUT, PATCH e DELETE;
- duração total;
- indicação de token renovado, sem mostrar o token.

O resumo operacional é salvo em `settings_json.homologation`, sem payloads
sensíveis.

## O que não foi implementado

- Sync de produtos.
- Sync de estoque.
- Envio de pedidos para Bling.
- Sync real baseado no produto usado na homologação.
- Webhooks reais.
- Reprocessamento de erros.

## Próximas etapas

1. Validar OAuth em produção com o app Bling real.
2. Executar a homologação no admin após o OAuth conectado.
3. Implementar `testConnection`.
4. Pesquisar e mapear endpoints de produtos.
5. Implementar sync incremental de produtos e estoque.
6. Implementar envio idempotente de pedidos.
7. Implementar webhooks com validação de assinatura.
