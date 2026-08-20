# Segurança — Zalen Shop

## 1. Princípios

- Segurança nasce na arquitetura.
- Nenhum dado sensível deve depender apenas de validação no frontend.
- Cada ação sensível deve validar autenticação, autorização e contexto da loja.
- Tokens de terceiros nunca aparecem no frontend.
- Integrações devem ter logs, idempotência e validação.
- Frontend é camada de experiência, não barreira de segurança.

## 2. Autenticação

- Usar Supabase Auth para login.
- Validar sessão no servidor.
- JWT identifica o usuário, mas autorização depende de platform role ou store membership.
- Login e admin usam identidade Zalen Shop.
- Storefront público não exige login.

## 3. Autorização

Toda ação sensível deve validar:

- usuário autenticado;
- papel global, se existir;
- membership da loja, se aplicável;
- `store_id` do recurso acessado;
- permissão suficiente para a ação.

## 4. Modelo leve multi-store

A autorização da Zalen Shop deve permanecer simples no MVP, mas preparada para multi-store.

### Platform roles

- `platform_owner`
- `platform_admin`

Podem acessar qualquer store para suporte, configuração e operação interna.

### Store roles

- `store_owner`
- `store_admin`
- `store_operator`
- `store_viewer`

Acessam apenas a própria `store_id`.

## 5. Regras de acesso

- `platform_owner` e `platform_admin` representam acesso global da Zalen.
- Store roles representam acesso operacional por loja.
- Brasil Drones não pode acessar LB London.
- LB London não pode acessar Brasil Drones.
- Usuário da Zalen pode acessar lojas por permissão global.
- `/admin` é painel operacional da loja.
- `/platform` será futuro e não deve ser implementado agora.

## 6. RLS

Ativar RLS em tabelas sensíveis:

- `platform_users`
- `store_memberships`
- `stores`
- `products`
- `product_variants`
- `product_images`
- `categories`
- `customers`
- `customer_addresses`
- `orders`
- `order_items`
- `integration_providers`
- `store_integrations`
- `webhook_events`
- `sync_jobs`

RLS deve respeitar `store_id` para dados de loja.

## 7. SQL Injection

- Nunca concatenar SQL com input do usuário.
- Usar Supabase client, query builder ou queries parametrizadas.
- Bloquear filtros, ordenações e nomes de coluna não permitidos.
- Nunca aceitar nome de tabela enviado pelo usuário.

## 8. XSS

- Não permitir HTML/JS livre no MVP.
- Evitar `dangerouslySetInnerHTML`.
- Sanitizar rich text se houver.
- Aplicar Content Security Policy.
- Não permitir SVG livre como upload de lojista no MVP.

## 9. Tokens e secrets

- Tokens de Bling, Mercos, Mercado Pago, Melhor Envio e outros devem ser criptografados.
- Nunca salvar tokens em logs.
- Nunca enviar tokens ao frontend.
- Nunca salvar tokens em localStorage.
- Nunca colocar tokens em URLs.
- Nunca commitar `.env.local`.
- Service role nunca pode ser importado em Client Components.

## 10. Webhooks

Todo webhook deve:

1. Validar assinatura/HMAC quando disponível.
2. Salvar payload bruto.
3. Responder rápido.
4. Processar em background.
5. Ser idempotente.
6. Registrar logs sem segredos.

## 11. Idempotência

Usar chaves únicas para:

- pagamentos;
- pedidos;
- webhooks;
- envio para ERP;
- sincronização de produtos;
- e-mails/notificações.

Antes de processar, verificar se o evento já foi processado.

## 12. Rate limit

Aplicar rate limit em:

- login;
- checkout;
- webhooks;
- APIs públicas;
- busca;
- criação de pedido;
- integrações.

## 12.1 Checkout convidado

- Checkout convidado nunca atualiza cadastro ou endereço permanente sem sessão
  autenticada.
- O acesso pós-compra usa capacidade aleatória em cookie HttpOnly, `SameSite=Lax`,
  sem e-mail, documento, telefone ou outra PII.
- A capacidade só é válida quando corresponde ao `store_id`, pedido, chave e
  tentativa de checkout persistida concluída dentro da janela permitida.
- ID de pedido isolado não concede leitura nem permissão de pagamento.
- Associação posterior do pedido exige e-mail verificado pelo Supabase Auth e
  afeta apenas pedidos sem cliente da mesma loja e do mesmo e-mail normalizado.

## 13. Upload seguro

- Limitar tipo e tamanho.
- Renomear arquivos.
- Usar paths por `store_id`.
- Converter imagens quando possível.
- Bloquear SVG livre no MVP.

## 14. CORS

- Não usar `Access-Control-Allow-Origin: *` em APIs autenticadas.
- Permitir apenas domínios esperados.
- Mesmo com CORS correto, autorização server-side é obrigatória.

## 15. Ambientes

- `local`
- `staging`
- `production`

Regras:

- credenciais de produção nunca em staging/local;
- `APP_ENV=production` não pode usar auth mockado;
- `.env.local` nunca vai para GitHub;
- logs não podem conter tokens, senhas ou service role;
- Supabase Cloud é a base atual para staging/desenvolvimento;
- Supabase local é opcional.

## 16. Conectores

- Nenhum conector pode ser chamado do frontend.
- Credenciais são sempre por loja.
- `integration_providers` não guarda credenciais.
- `store_integrations` guarda configuração e credenciais criptografadas por loja.
- Antes de implementar qualquer conector, preencher pesquisa técnica oficial em `docs/integrations`.

## 17. Domínios próprios

- Token Vercel, project ID e team ID ficam somente no servidor.
- O formulário nunca aceita `store_id`; o servidor resolve a loja pelo host administrativo e pela sessão.
- `store_domains` e `store_domain_events` não concedem acesso `anon`.
- Membros consultam apenas a própria loja; owner/admin e papéis globais alteram via Server Actions.
- Nunca usar `force` para mover domínio de outro projeto.
- Eventos guardam códigos seguros, sem token ou resposta bruta da Vercel.
- Host externo desconhecido retorna 404 e não herda o fallback Brasil Drones.
