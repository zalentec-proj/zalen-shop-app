# Handoff para IDE em outra maquina

Este arquivo e o ponto de entrada para continuar o projeto Zalen Shop em outra
maquina/IDE. Ele nao substitui `AGENTS.md`; leia ambos antes de editar.

## Estado atual

- Data do handoff: 2026-07-15.
- Repositorio oficial: `https://github.com/zalentec-proj/zalen-shop-app.git`.
- Branch de trabalho atual: `refactor/migrate-to-next`.
- Ultimo commit local/remoto conhecido: `8533a5e` (`Update Brasil Drones logo`).
- Working tree esperado apos pull: limpo, exceto automacoes locais ignoraveis se
  elas existirem na maquina antiga.

## Primeiro passo na outra maquina

1. Clonar ou atualizar o repositorio oficial.
2. Entrar na branch `refactor/migrate-to-next`.
3. Rodar `git pull --rebase origin refactor/migrate-to-next`.
4. Ler, nesta ordem:
   - `AGENTS.md`
   - `docs/work-context/CURRENT_STATE.md`
   - este arquivo
   - documentacao obrigatoria em `docs/zalen-shop/`
   - docs do provedor em `docs/integrations/` se a frente envolver integracao.
5. Conferir `git status -sb` antes de qualquer edicao.

## Comandos locais usuais

```bash
npm install
npm run dev
npm run lint
npm run test:unit
npm run build
git diff --check
```

Se o dev server herdar variaveis Supabase antigas do shell, iniciar limpo:

```bash
env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_SECRET_KEY npm run dev
```

## Decisoes que continuam valendo

- Zalen Shop e a plataforma; Brasil Drones e apenas a primeira loja/case.
- O core deve permanecer multi-store, com dados de loja sempre isolados por
  `store_id`.
- Admin e login usam identidade Zalen Shop; storefront publico usa identidade
  da loja ativa.
- `/admin` e o painel operacional da loja; `/platform` continua futuro e nao
  deve ser criado agora.
- Frontend nunca e fonte de verdade para preco, estoque, frete, permissao ou
  total de pedido.
- Toda integracao externa deve ser server-side, passando por service/connector.
- Tokens, refresh tokens, service role, payloads sensiveis e segredos nunca
  devem aparecer no frontend, logs, commits ou documentacao.
- `git stash` nao e handoff. Estado relevante entre maquinas deve ser
  versionado em `docs/work-context/CURRENT_STATE.md`.

## Estado funcional por area

### Storefront e checkout

- Storefront Brasil Drones le catalogo do Supabase.
- Checkout publico nao exige senha antes da compra, mas exige identificacao,
  dados fiscais/endereco e validacao de e-mail antes do pagamento.
- CPF/CNPJ definem PF/PJ server-side; preco final deve ser sempre recalculado no
  servidor.
- Mercado Pago usa Payment Brick/API Pagamentos como caminho principal; Checkout
  Pro fica como contingencia/manual.
- Pix, cartao e boleto ja possuem fluxo documentado e testes em parte do
  conector. Webhook continua critico para confirmacao definitiva.

### Mercado Pago

- Modelo correto: OAuth por loja em `store_integrations`, com credenciais
  criptografadas.
- Fallback via ENV existe somente como compatibilidade/controlado, nao como
  modelo final multi-loja.
- Produção ainda deve ser tratada com gate: confirmar segredos por ambiente,
  assinatura de webhook e entrega autenticada antes de liberar novas mudancas
  sensiveis.
- Nunca usar credenciais do Mercado Pago no frontend, exceto Public Key quando
  explicitamente necessaria pelo SDK.

### Bling

- Bling e conector ERP opcional da Brasil Drones, nao dependencia global da
  plataforma.
- Sync de produtos cria/atualiza apenas itens vinculados por
  `store_id + external_provider + external_id`.
- Produtos nativos sem vinculo externo nao devem ser sobrescritos.
- Produto vindo do Bling pode atualizar preco base/default; preco PJ manual da
  Zalen nao deve ser sobrescrito pelo sync.
- Envio de pedido ao Bling e server-side, com idempotencia e travas de
  homologacao/ativacao.
- A categorizacao tecnica do Bling nao deve ser substituida por linhas/modelos.
  Compatibilidade por modelo e uma relacao propria na Zalen.

### Compatibilidade por modelo DJI

- Base implementada para linhas/modelos DJI com migrations e RLS.
- As rotas `/modelos/[slug]` e `/modelos/linha/[slug]` foram preparadas.
- A tela `/admin/configuracoes/compatibilidade` existe para revisar sugestoes.
- Itens de menu por modelo foram adiados/desativados ate deploy seguro e
  confirmacao de vinculos.
- Nao criar vinculos em massa apenas por nome; operador deve revisar antes.

### Admin

- Admin evoluiu de sidebar MVP enxuta para estrutura SaaS operacional.
- Clientes, pedidos, produtos, integracoes e configuracoes fazem parte do core
  operacional.
- Admin nao deve expor `credentials_encrypted`, tokens, secrets ou payloads
  sensiveis.

## Pendencias importantes

- Validar Mercado Pago em producao com webhook autenticado antes de liberar nova
  frente sensivel de pagamento.
- Confirmar deploy que contenha a logo nova da Brasil Drones se a producao ainda
  estiver exibindo asset antigo.
- Revisar compatibilidade por modelo no admin e ativar menu apenas depois de
  pelo menos um vinculo confirmado.
- Manter pedido automatico Bling desligado ate homologacao controlada estar
  concluida.
- Confirmar no Bling/API qualquer endpoint novo antes de implementar listas de
  preco, categorias ou pedidos adicionais.

## Arquivos locais que nao devem ser enviados sem revisao

Na maquina atual havia automacoes/auditorias locais nao rastreadas. Se elas
aparecerem na outra maquina, trate como ferramentas operacionais, nao como
produto:

- `audit-bling-marketplaces.js`
- `capture-and-audit-bling-marketplaces.js`

Nao commitar esses arquivos sem uma decisao explicita.

## Checklist antes de encerrar uma sessao

1. Atualizar `docs/work-context/CURRENT_STATE.md` com objetivo, estado,
   validacoes, bloqueios e proximo passo.
2. Rodar pelo menos `git diff --check`; para codigo, rodar tambem
   `npm run lint` e `npm run build`.
3. Conferir que nenhum segredo entrou no diff.
4. Fazer commit e push do que precisa sobreviver a troca de maquina.
5. Deixar claro quais arquivos ficaram fora do commit e por que.
