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
BLING_ENV=sandbox
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
- Callback valida `state`.
- Callback troca `code` por token server-side.
- Tokens são criptografados e salvos em `store_integrations.credentials_encrypted`.
- Status da loja passa para `connected`.

## O que não foi implementado

- Sync de produtos.
- Sync de estoque.
- Envio de pedidos para Bling.
- Refresh automático de token.
- Teste de conexão real.
- Webhooks reais.
- Reprocessamento de erros.

## Próximas etapas

1. Validar OAuth em sandbox/app Bling real.
2. Implementar refresh token server-side.
3. Implementar `testConnection`.
4. Pesquisar e mapear endpoints de produtos.
5. Implementar sync incremental de produtos e estoque.
6. Implementar envio idempotente de pedidos.
7. Implementar webhooks com validação de assinatura.
