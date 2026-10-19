# Cadastro e personalização de lojas

Incremento autorizado em 19/10/2026, conforme
`../work-context/PLATFORM_ADMIN_NEXT_STEPS_2026-10-16.md`.
A implementação está na branch `codex/platform-store-customization`.
Conferir `../work-context/CURRENT_STATE.md` para o estado de publicação.

## Operação

1. No admin geral, abrir **Lojas → Nova loja**.
2. Informar nome, endereço (slug) e e-mail de uma conta já existente no
   Supabase Auth **da Zalen Shop**. O cadastro não cria conta nem envia convite.
3. A loja nasce **Em preparação**, com responsável `store_owner`, apresentação
   neutra e tabelas PF/PJ vazias, sem desconto automático. Catálogo, documentos,
   frete e integrações não são copiados de outra loja.
4. Abrir **Personalizar** e configurar nome público, logo, ícone, cores, banner,
   textos, atendimento, Instagram e SEO. Imagens usam URL HTTPS de PNG, JPG,
   WebP ou AVIF; upload de arquivos fica para outro incremento.
5. **Salvar rascunho → Ver prévia do rascunho**. A prévia exige papel global,
   não é indexada e bloqueia navegação de compra. Alterar um rascunho não muda
   a apresentação publicada.
6. O dono confere a prévia e confirma **Publicar e ativar loja**. Depois pode
   publicar alterações ou **Desativar loja** com confirmação explícita.
7. Uma loja ativa tem acesso ao admin operacional no seu subdomínio Zalen.
   Domínios próprios continuam sendo configurados pelo módulo existente.

Slug fica fixo; o responsável é vinculado no cadastro e exibido na ficha.
Troca de responsável, convites e editor avançado não fazem parte deste incremento.
O modelo Essencial usa o catálogo e checkout compartilhados. A Brasil Drones
mantém seu renderer custom, com a identidade configurável nas partes comuns.

## Autorizações

| Operação | Dono global | Admin global | Papel de loja / visitante |
| --- | --- | --- | --- |
| Listar, ficha e prévia | Sim | Sim | Não |
| Criar loja | Sim | Não | Não |
| Salvar nome interno e rascunho | Sim | Sim | Não |
| Publicar, ativar ou desativar | Sim | Não | Não |

Cada ação valida sessão/papel antes de obter o cliente privilegiado. A transação
reconfere `platform_users`; nunca usa `user_metadata` nem papel enviado no form.
O papel global não é concedido ao responsável da loja.

## Persistência e segurança

- `storefront_drafts`: configuração completa em edição e revisão crescente;
  sem grants de leitura/escrita para `anon` ou `authenticated`.
- `storefront_presentations`: snapshot publicado, isolado por `store_id`.
  Leitura pública somente para loja ativa. Não contém credenciais ou rascunho.
- `platform_store_profiles`: responsável e criador; leitura somente pelo
  servidor autorizado.
- `private.platform_store_requests`: idempotência por ator/chave, com trava
  transacional. Repetir o mesmo envio retorna a mesma loja; mudar o payload
  com a mesma chave falha. Slug único e transação evitam registros parciais.
- `platform_store_events`: ator, loja, ação, resultado e horário; sem payload,
  e-mail, senha, token ou resposta bruta de provedor.
- A função `private.platform_store_command` é definer com `search_path` vazio;
  o wrapper público é invoker e só `service_role` pode executá-lo. JWT de
  usuário não executa os comandos nem escreve diretamente nas novas tabelas.
- RLS de produtos e documentos públicos também exige loja ativa. Variantes,
  imagens e vínculos de categoria herdam a visibilidade do produto pelas
  políticas existentes. Nenhum fallback estático reativa loja ausente do banco.
- Zod limita campos, comprimentos, cores hexadecimais, URLs e renderers. Não há
  HTML, CSS, JS ou SVG livre. O renderer custom Brasil Drones é reservado a esse
  case; novas lojas usam `neutral`.
- Versão do rascunho é checada no banco: uma aba antiga não sobrescreve outra.
- Brasil Drones mantém seus dados e configurações; nenhuma cópia comercial é
  feita. O fallback legado de pagamento continua restrito ao seu `store_id`.

## Validação e release

- `npm run test:platform-stores:db`: PostgreSQL 17 descartável sem rede, sem
  `.env`, com teardown; atomicidade, retries, concorrência, papéis, grants/RLS,
  rascunho, publicação e desativação. Não roda no banco cloud.
- `node scripts/dev-platform-stores-fixture.mjs`: app Next temporário + SDK +
  PostgreSQL local descartável. Auth fictício somente no loopback. O endpoint
  de sessão é criado apenas na cópia temporária e não existe no app versionado.
  Responsável fictício: `merchant@platform.invalid`. Ctrl+C remove o ambiente.
- Regressões cobrem validação, guard global, marca comum, ausência de contatos
  herdados e bloqueio de pagamento sem credencial própria.
- Antes de publicar, aplicar a migration aditiva revisada
  `20261019150054_platform_store_provisioning.sql` e o índice complementar
  `20261019165113_platform_store_request_store_index.sql` no projeto correto e
  conferir tabelas, grants, função e políticas. Depois publicar o código e validar com a
  sessão real do dono. A migration não cria uma nova loja real nem altera
  catálogo, integrações ou status da Brasil Drones.
- Aplicadas em 19/10/2026 no projeto Zalen Shop. O MCP registrou as versões
  remotas `20261019165012` e `20261019165142`; não reaplicar pelo timestamp
  local. O handoff contém a correspondência, commits e deployment da entrega.
- Reverter o código é compatível com as tabelas adicionais; não remover tabelas
  que já contenham lojas/configurações. Conferir status das lojas caso haja
  rollback para uma versão antiga com fallback estático da Brasil Drones.

Vendas reais em novas lojas continuam dependentes das pendências de estoque,
pedidos e pagamentos registradas no plano de 16/10 e no handoff. Este incremento
não homologa esses fluxos nem ativa um ERP ou meio de pagamento novo.

Fontes consultadas: [grants e Data API](https://supabase.com/docs/guides/api/securing-your-api),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Auth admin getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid).
As Server Actions seguem os guias da versão instalada em
`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` e
`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`.
