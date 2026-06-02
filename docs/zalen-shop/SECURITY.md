# SECURITY.md — Regras de Segurança

## 1. Princípios

- Segurança nasce na arquitetura.
- Nenhum dado sensível deve depender apenas de validação no frontend.
- Cada ação deve validar autenticação, autorização e contexto da loja.
- Tokens de terceiros nunca aparecem no frontend.
- Integrações devem ter logs, idempotência e validação.

## 2. Autenticação

- Usar Supabase Auth quando o painel administrativo for implementado.
- Validar sessão no backend.
- JWT identifica o usuário, mas autorização depende de membership/role.

## 3. Autorização

Toda ação sensível deve validar:

- usuário autenticado;
- usuário pertence à loja;
- usuário tem permissão para a ação.

### Modelo leve de acesso multi-store

A autorização da Zalen Shop deve permanecer simples no MVP, mas preparada para multi-store:

- `platform_owner` e `platform_admin` representam acesso global da Zalen e podem acessar qualquer `store_id`.
- `store_owner`, `store_admin`, `store_operator` e `store_viewer` representam acesso de loja e acessam apenas a própria `store_id`.
- Toda autorização sensível deve acontecer server-side, em services, Route Handlers ou Server Components.
- Frontend nunca é barreira de segurança; esconder botões ou rotas é apenas UX.
- RLS e queries devem respeitar `store_id` em toda tabela de loja.
- Integrações, pedidos, catálogo, estoque, temas e uploads devem sempre carregar contexto de loja.
- `/admin` é o painel operacional da loja; acesso global da Zalen será preparado em dados/helpers, sem criar `/platform` agora.

Modelo mínimo:

```txt
platform_users → acesso global Zalen
store_memberships → acesso por loja
store_id → fronteira de isolamento dos dados
```

## 4. RLS

Quando o Supabase for usado, ativar RLS em tabelas com dados da loja:

- platform_users
- store_memberships
- products
- product_variants
- categories
- customers
- orders
- store_integrations
- integrations
- integration_tokens
- theme_settings
- webhook_events
- sync_jobs

## 5. SQL Injection

- Nunca concatenar SQL com input do usuário.
- Usar query builder, Supabase client ou queries parametrizadas.
- Bloquear filtros e ordenações não permitidos.

## 6. XSS

- Não permitir HTML/JS livre no MVP.
- Evitar `dangerouslySetInnerHTML`.
- Sanitizar rich text, se houver.
- Aplicar Content Security Policy.
- Não permitir SVG livre como upload de lojista.

## 7. Tokens e secrets

- Tokens de Bling, Mercado Pago, Melhor Envio e outros devem ser criptografados.
- Nunca salvar tokens em logs.
- Nunca enviar tokens ao frontend.
- Nunca salvar tokens em localStorage.
- Nunca colocar tokens em URLs.

## 8. Webhooks

Todo webhook deve:

1. Validar assinatura/HMAC quando disponível.
2. Salvar payload bruto.
3. Responder rápido.
4. Processar em background.
5. Ser idempotente.

## 9. Idempotência

Usar chaves únicas para:

- pagamentos;
- pedidos;
- webhooks;
- envio para ERP;
- e-mails/notificações.

Antes de processar, verificar se o evento já foi processado.

## 10. Rate limit

Aplicar rate limit em:

- login;
- cadastro;
- checkout;
- webhooks;
- APIs públicas;
- busca;
- criação de pedido;
- integrações.

## 11. Upload seguro

- Limitar tipo e tamanho.
- Renomear arquivos.
- Usar paths por `store_id`.
- Converter imagens quando possível.
- Bloquear SVG livre no MVP.

## 12. CORS

- Não usar `Access-Control-Allow-Origin: *` em APIs autenticadas.
- Permitir apenas domínios esperados.

## 13. Ambientes

- Separar development, staging e production.
- Credenciais de produção nunca em ambiente de teste.
- `.env` nunca deve ir para GitHub.
