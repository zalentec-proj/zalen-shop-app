# Critérios de Aceite — Zalen Shop

## 1. Plataforma

- Projeto usa Next.js App Router.
- Supabase Cloud está documentado e configurável por env.
- Dados de loja usam `store_id`.
- A arquitetura permite mais de uma store sem reescrever o core.
- Brasil Drones é a primeira store.
- LB London está documentada como store futura.

## 2. Auth e acesso

- Login usa identidade Zalen Shop.
- Storefront público continua sem login.
- `/admin` exige sessão.
- Usuário `platform_owner` ou `platform_admin` pode acessar a store ativa.
- Usuário com `store_membership` acessa apenas sua store.
- Usuário sem permissão não acessa dados de loja.

## 3. Storefront

- Home carrega corretamente.
- Categoria carrega produtos da store ativa.
- Produto abre com dados corretos.
- Carrinho funciona.
- Layout responsivo.
- Performance aceitável.
- Storefront Brasil Drones mantém identidade Brasil Drones.

## 4. Admin

- Admin usa identidade Zalen Shop.
- Admin mostra contexto da loja ativa.
- Produtos são visíveis.
- Pedidos são visíveis.
- Integrações mostram status.
- Erros aparecem de forma compreensível.
- Admin não expõe segredos.

## 5. Catálogo

- Produto pode ser listado.
- Produto pode ter imagem.
- Produto pode ter variante.
- Estoque aparece corretamente.
- Produto inativo não aparece no storefront público.
- Admin pode visualizar produtos ativos/inativos quando autorizado.

## 6. Pedidos

- Carrinho adiciona/remove itens.
- Total é calculado no backend quando checkout real for implementado.
- Pedido é criado com número amigável.
- Pedido é salvo no banco.
- Pedido pode ser preparado para envio ao ERP.

## 7. Conectores

- `integration_providers` representa conectores globais.
- `store_integrations` representa conectores por loja.
- Brasil Drones usa Bling como conector ERP planejado.
- LB London usa Mercos como conector futuro planejado.
- Nenhuma API externa é chamada pelo frontend.
- Credenciais não aparecem no frontend.

## 8. Bling

Antes de implementação real:

- pesquisa técnica oficial preenchida;
- OAuth documentado;
- JWT com `enable-jwt: 1` documentado;
- endpoints documentados;
- webhooks documentados;
- plano de idempotência definido.

Após implementação:

- conexão OAuth funcionando;
- tokens criptografados;
- produto importado;
- estoque sincronizado;
- pedido enviado;
- erro registrado em log;
- webhook salvo antes de processar.

## 9. Mercos

Antes de implementação real:

- pesquisa técnica oficial preenchida;
- ApplicationToken e CompanyToken documentados;
- sandbox documentado;
- homologação documentada;
- throttling 429 documentado;
- webhooks HMAC documentados.

## 10. Segurança

- RLS ativo em tabelas sensíveis.
- Service role não é importado em Client Components.
- Tokens não aparecem no frontend.
- Webhook é idempotente.
- Upload é limitado.
- Sem HTML/JS livre no MVP.
- `.env.local` e segredos não são commitados.

## 11. Deploy

- Build passa.
- Variáveis configuradas.
- Supabase Cloud conectado quando necessário.
- Vercel preparado.
- Ambiente staging separado de production.
