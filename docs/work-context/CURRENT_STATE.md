# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-15
- Branch: `refactor/migrate-to-next`
- Commit remoto atual: `8533a5e` — `Update Brasil Drones logo`
- Working tree no momento deste registro: contém apenas automações/auditorias
  locais não rastreadas (`audit-bling-marketplaces.js` e
  `capture-and-audit-bling-marketplaces.js`). Não incluir esses arquivos em
  commits sem decisão explícita.
- Guia de continuidade para outra IDE/máquina: `docs/work-context/IDE_HANDOFF.md`.

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Última mudança conhecida

- A logo do storefront Brasil Drones foi atualizada no asset
  `src/assets/logo brasil.svg` e enviada ao Git no commit `8533a5e`. Se a
  produção ainda exibir a logo antiga, verificar se o deploy em produção está
  apontando para esse commit/branch e se há cache/CDN servindo o asset anterior.

- Foi implementada a base de compatibilidade por modelo DJI para Brasil Drones,
  separada das categorias técnicas do Bling. As migrations de produção
  `20260713200000_add_drone_model_compatibility.sql` e
  `20260713201000_add_drone_model_foreign_key_indexes.sql` criaram tabelas
  com RLS para linhas, modelos e vínculos produto-modelo; foram semeadas oito
  linhas e 31 modelos. Não houve alteração de produto, categoria técnica,
  preço, estoque ou dados no Bling.
- A navegação do storefront recebeu suporte a rotas internas seguras e foram
  preparados os destinos `/modelos/[slug]` e `/modelos/linha/[slug]`, além da
  tela administrativa `/admin/configuracoes/compatibilidade`. As sugestões são
  derivadas de nome/SKU e ficam em revisão; apenas vínculos confirmados por um
  operador aparecem no storefront.
- Os 38 itens de menu por modelo foram propositalmente desativados pela
  migration `20260713202000_defer_model_navigation_until_storefront_deployment.sql`.
  O handoff vigente bloqueia novo deploy até a validação de pagamento em
  produção; isso evita expor itens de menu antes do código de rotas estar
  publicado. Os atalhos anteriores Baterias e Master Airscrew foram mantidos
  visíveis. Após um deploy seguro, o admin permite ativar todos os itens por
  meio do comando protegido “Ativar menu de modelos”, que permanece bloqueado
  enquanto não houver ao menos uma compatibilidade confirmada.

- Foi implementado localmente um Status Screen de Pix para o checkout. Depois
  de criar um Pix pendente, o cliente permanece na tela de pagamento com o
  componente oficial do Mercado Pago e um contador de dois minutos. Nesse
  período, o servidor confere o pagamento a cada quatro segundos, respeitando
  autenticação, vínculo do pedido e rate limit. Quando o pagamento é aprovado,
  a tela confirma e encaminha automaticamente ao pedido.
- A consulta curta do checkout é uma melhoria de experiência e não substitui o
  webhook. O webhook continua sendo a fonte assíncrona para atualização
  definitiva, inclusive quando o cliente fecha a página.
- O detalhe do pedido não deve mais mostrar um aviso de pagamento pendente
  quando a transação já estiver confirmada.
- A publicação desta mudança foi deliberadamente suspensa até restaurar a
  configuração segura de produção do ambiente de deploy e validar novamente a
  assinatura de webhook. Não publicar uma nova versão antes dessa etapa.
- A auditoria de 2026-07-13 confirmou que o `vercel env pull` não deve ser
  usado para inferir que um segredo de produção está vazio: a CLI omite valores
  sensíveis ao baixá-los. A presença de uma variável no arquivo temporário não
  prova o seu conteúdo.
- Foram restauradas na Vercel, sem publicar deployment, as configurações com
  fonte local validada: Supabase, `APP_URL`, OAuth do Bling, chave de
  criptografia de integrações, Resend, fallback de produção do Mercado Pago e
  uma nova chave de hash do rate limit. Os valores não foram registrados aqui.
- A validação de API confirmou as credenciais locais de Supabase e o token de
  produção de Mercado Pago antes da restauração.
- O callback OAuth de produção do Mercado Pago foi salvo na Vercel. A auditoria
  do painel do provedor confirmou tentativas de `payment.updated` respondidas
  com `401`, o que mantém como causa ativa a assinatura de webhook ausente ou
  divergente no deployment vigente.
- A tela de configuração de webhooks confirma que o ambiente de produção tem
  uma assinatura secreta própria. O seu valor não foi copiado para arquivos,
  logs ou documentação e ainda precisa ser salvo como
  `MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION` na Vercel.

- A função persistente de rate limit foi corrigida pela migration
  `20260711165637_fix_security_rate_limit_timestamp.sql`.
- A migration foi aplicada ao Supabase de produção e uma chamada real retornou
  `allowed = true`.
- `RATE_LIMIT_HASH_SECRET` foi configurado na Vercel para produção.
- O deployment de produção do commit `e8e9a5a` está `READY`.
- Falhas de infraestrutura do rate limit na consulta de CEP agora são enviadas
  ao Sentry somente com código operacional seguro.
- A cotação de frete passou a validar apenas o CEP de destino, que é o único
  dado usado pelo cálculo. O endereço completo continua validado antes da
  criação do pedido.
- A validação completa do endereço agora usa campos obrigatórios explícitos e
  aceita complemento vazio, evitando bloqueio antes do Mercado Pago.
- O Payment Brick também exige `www.mercadolibre.com` para frame e verificações
  de segurança executadas pelo SDK. A CSP global deve permitir esse host apenas
  em `connect-src` e `frame-src`, mantendo `script-src` restrito ao SDK oficial.
- O boleto falhava ao criar o pagamento porque o backend descartava o endereço
  validado do pedido. O payload agora envia `payer.address` com CEP, rua,
  número, bairro, cidade e UF, como exigido pelo endpoint `/v1/payments`.
- O `entityType` do Payment Brick é sempre inicializado como `individual` ou
  `association`, inclusive no sandbox, sem voltar a pré-preencher CPF/CNPJ,
  nome ou endereço nos cartões de teste.
- O conector agora persiste os dados de instrução de boleto retornados pelo
  Mercado Pago: código de barras, linha digitável quando disponível, referência,
  vencimento e URL externa. A página do pedido permite copiar o código para
  pagamento manual, mas não cria arquivo, PDF ou boleto local: o documento é
  aberto somente pela URL oficial retornada pelo Mercado Pago.
- O deployment de produção `dpl_E4Mf3FSYHC8euP4C3RukyHnsiy7U` do commit
  `0cdf2f9` está `READY` e foi associado ao domínio
  `brasil-drones.zalenshop.com.br`.
- Auditoria de 2026-07-11 do conector Mercado Pago: a validação de entrega de
  webhooks em produção permanece pendente. O diagnóstico detalhado e quaisquer
  dados operacionais sensíveis devem ficar fora de documentação versionada.
- Foi preparada localmente uma homologação manual de pedido para a conta Bling
  operacional. Ela permanece separada do disparo automático: exige owner/admin,
  confirmação explícita e um pedido Zalen já pago; registra `testMode` no job e
  inclui o aviso “não faturar / não expedir” nas observações do Bling. Nenhum
  pedido externo foi enviado durante essa preparação.
- O painel de homologação Bling agora aceita o número visível do pedido ou o
  UUID interno. O erro `order_not_found` observado ao informar `BD-167498`
  ocorreu porque a primeira versão consultava somente `orders.id`; a resolução
  passa a usar `orders.order_number` quando a referência não é UUID, sempre
  filtrada pela loja ativa.
- A árvore de categorias de linhas/modelos DJI foi criada no Bling usando
  exclusivamente o app privado da Brasil Drones. Foram incluídas 38 categorias:
  `Flip` e as linhas Lito, Neo, Mini, Air, Avata, Mavic e Phantom, com seus
  respectivos modelos. A criação retornou zero erros e não alterou produtos,
  estoque, preço ou as categorias técnicas existentes.
- A automação idempotente está em
  `scripts/bling/create-brasil-drones-model-categories.mjs`; o callback OAuth
  separado está em `capture-and-create-bling-model-categories.js`. Os scripts
  exigem as variáveis de ambiente exclusivas do app do cliente e não aceitam as
  credenciais globais da Zalen Shop. O resultado e o mapa local de categorias
  ficam em `saida_bling/`, que é ignorado pelo Git.
- Produtos no Bling mantêm uma categoria principal. As linhas/modelos não devem
  substituir as categorias técnicas como Braços, Câmeras ou Frames. Para o
  menu estilo Mundrone filtrar todas as peças compatíveis com um drone, o
  catálogo Zalen precisará de uma relação própria de compatibilidade por modelo.
- A tela administrativa de compatibilidade foi ajustada para usar caixas de
  seleção agrupadas por linha, em vez de um seletor múltiplo que dependia de
  `Cmd` no macOS. Cada modelo selecionado pode ser removido individualmente,
  toda a seleção pode ser limpa e uma sugestão pode ser adicionada ou usada
  como substituta. O detector também reconhece referências abreviadas com barra,
  como `Air 3 / 3S`, como compatibilidade com ambos os modelos.
- Em 2026-07-15 foram consultados exclusivamente os SKUs
  `BDP-AIR3S-BRACO-TRASEIRO-DIREITO-L060` e
  `BDP-AIR2S-HELICE-GERAL-L072`. Os vínculos já estavam corretos: o braço tem
  Air 3 e Air 3S, e as hélices têm somente Air 2S. Nenhuma alteração direta de
  dados foi necessária.

## Objetivo atual

Restaurar e validar a configuração de produção do Mercado Pago e publicar a
confirmação visual de Pix somente depois de homologar a assinatura de webhook e
as dependências server-side por ambiente. A compatibilidade por modelo DJI está
preparada e deve ser ativada somente no mesmo ciclo de deploy seguro.

## Em andamento

O deployment de produção vigente é anterior à implementação de confirmação
visual de Pix. A conciliação periódica pode atualizar pedidos que não receberam
o webhook em tempo real, mas não oferece a experiência imediata do checkout.

A configuração de pagamentos em produção continua bloqueada até a restauração
controlada dos segredos por ambiente e a validação de entrega autenticada do
webhook.

O catálogo de modelos no banco está pronto e já possui vínculos manuais
confirmados pontuais; o menu público permanece inativo. O próximo operador deve
revisar as sugestões na tela de compatibilidade depois que o código estiver
publicado; não deve criar vínculos automáticos em massa apenas pelo nome da
peça.

Nenhum deployment foi criado após a restauração parcial das variáveis. A versão
em produção continua sendo a previamente validada.

No momento deste handoff, a sessão de navegador do titular está compartilhando
uma atividade não relacionada. Não interromper essa atividade para alternar de
guia: retomar somente quando o painel do Mercado Pago e o dashboard do
Supabase estiverem disponíveis novamente.

## Próximo passo exato

1. Copiar, diretamente do painel de credenciais de produção, `Client ID` e
   `Client Secret` do Mercado Pago para as variáveis sensíveis da Vercel,
   sem expor os valores em terminal, código ou documentação.
2. Na configuração de Webhooks, abrir o modo de produção e copiar a assinatura
   secreta para `MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION` na Vercel. Não alterar
   a `notification_url` contextualizada por loja e ambiente gerada pelo app.
3. Gerar um único segredo de cron e atualizar, na mesma operação, os valores
   `CRON_SECRET` e `INTERNAL_JOB_SECRET` na Vercel e o segredo
   `zalen_cron_secret` do Vault do Supabase.
4. Criar o deployment somente após todos os valores anteriores estarem
   configurados e confirmar uma entrega de `payment.updated` autenticada.
5. Preservar a `notification_url` contextualizada por loja e ambiente em cada
   pagamento e manter somente os tópicos efetivamente processados pelo conector.
6. Criar uma transação de produção controlada e confirmar a entrega do webhook
   antes de publicar e liberar o novo acompanhamento de Pix.
7. Para validar o conector Bling sem conta de homologação ativa, criar primeiro
   um pedido pago controlado, copiar seu ID e usar o painel “Enviar um pedido
   de homologação”. Confirmar o registro no Bling, não faturar/não expedir e
   cancelá-lo após a validação; manter `orderSend.enabled` desligado.
8. Depois do deploy seguro do código de compatibilidade, abrir
   `/admin/configuracoes/compatibilidade`, revisar os modelos sugeridos por
   produto e salvar apenas os vínculos confirmados. Só então usar “Ativar menu
   de modelos”. Não recategorizar produtos já classificados tecnicamente no
   Bling.

## Bloqueios e dúvidas

Validação de pagamentos em produção pendente de restauração segura da
configuração server-side e reteste controlado do webhook. A sessão atual do
MCP do Mercado Pago não expôs as ferramentas OAuth necessárias para consultar
a configuração da aplicação. O acesso pelo painel web do provedor também está
aguardando uma validação interativa da conta, que deve ser concluída pelo
titular sem compartilhar códigos ou credenciais.

O acesso administrativo ao Vault do Supabase ainda precisa ser autenticado para
concluir a troca coordenada do segredo de cron.

## Validação

- Documentação obrigatória do projeto e o handoff foram relidos antes da alteração.
- A interface de compatibilidade compilou e a checagem de TypeScript passou
  com `npm run lint`; a suíte Vitest passou com 53 testes. O build de produção
  também compilou e concluiu a validação de TypeScript via `npm run build`.
- A chamada direta de `consume_security_rate_limit` falhava antes da migration
  com erro de tipo e passou depois, retornando `allowed = true`.
- `npm run lint` passou.
- Testes de rate limit, CEP e frete passaram: 16 testes em 3 arquivos.
- `npm run build` passou. O Next utilizou o fallback WASM para SWC local, sem
  impacto no resultado do build.
- Testes de input de cotação, frete, CEP e rate limit passaram: 18 testes em 4
  arquivos.
- `npm run lint` e `npm run build` passaram novamente após a correção da
  cotação.
- Testes de endereço, cotação, frete, CEP e rate limit passaram: 20 testes em
  5 arquivos.
- `npm run lint` e `npm run build` passaram após a correção do complemento.
- A implementação local do acompanhamento de Pix passou em `npm run lint`,
  `npm test` (44 testes) e `npm run build`. O build utilizou o fallback WASM
  local conhecido para SWC e terminou com sucesso.
- A preparação do envio manual de homologação Bling passou no teste dedicado
  de mapeamento (2 testes), em `npm run lint` e em `npm run build`; o build
  usou o fallback WASM local conhecido. Não houve chamada externa ao Bling.
- A correção de referência de pedido passou em 49 testes, `npm run lint` e
  `npm run build`. A validação de produção confirmou `BD-167498` como pago por
  Pix em produção, ainda sem ID externo Bling; nenhum envio foi disparado pelo
  diagnóstico.
- A captura de produção posterior mostrou a CSP bloqueando explicitamente
  `https://www.mercadolibre.com` em `connect-src` e `frame-src`, origem usada
  pelo Payment Brick para segurança. O ajuste foi mantido restrito a esse host.
- O deployment de produção `dpl_DsGNoGZftFze51LiTA4TNbUo5yub` do commit
  `3ffaf07` ficou `READY`. A resposta HTTPS de `/carrinho` confirmou
  `www.mercadolibre.com` nas diretivas `connect-src` e `frame-src`.
- A captura de console seguinte mostrou bloqueios explícitos do script de
  componente em `https://http2.mlstatic.com` e da telemetria em
  `https://api.mercadolibre.com/tracks`. Ambas as permissões adicionais foram
  mantidas no escopo estrito do Payment Brick.
- O deployment de produção `dpl_7drvtibNjaVKmzQMPYYLKyT74Q4B` do commit
  `6b0b679` ficou `READY`. A resposta HTTPS de `/carrinho` confirmou
  `http2.mlstatic.com` em `script-src` e `connect-src`, além de
  `api.mercadolibre.com` em `connect-src`.
- O SDK público do Payment Brick foi inspecionado para cobrir os meios sem
  depender de tentativa e erro: Pix e boleto usam a API principal já permitida,
  enquanto cartão usa `api-static.mercadopago.com` e os hosts `secure-fields`
  de produção e sandbox. Os payloads de Pix e boleto já têm testes que asseguram
  a ausência de token, emissor e parcelas de cartão.
- O deployment de produção `dpl_D2BQxqezzjm5ko14d6zig9jZ7ipZ` do commit
  `27b98b8` ficou `READY`. A resposta HTTPS de `/carrinho` confirmou
  `api-static.mercadopago.com`, `secure-fields.mercadopago.com` e
  `secure-fields-stg.mercadopago.com` em `connect-src`. Os testes de CSP,
  payload de Pix/boleto/cartão e conector passaram: 11 testes em 3 arquivos.
- A tentativa de cartão posterior foi salva como erro técnico sem dados
  pessoais. A documentação oficial foi relida: o e-mail do Brick em teste deve
  ser um e-mail comum diferente do vendedor, não um usuário de teste. O ajuste
  remove a injeção de e-mail de teste, não pré-preenche CPF/CNPJ no Brick de
  sandbox e impede o fallback do documento salvo em cartões de sandbox.
- O deployment de produção `dpl_9dkYsStvnphxq5FGZuSEtiLGo43x` do commit
  `4194e84` ficou `READY`. Os testes de CSP, payload de cartão/Pix/boleto e
  conector passaram: 12 testes em 3 arquivos; `npm run lint` e `npm run build`
  também passaram.
- O commit funcional `745836e` passou nos testes de payload e conector do
  Mercado Pago: 12 testes em 2 arquivos. `npm run build` e `npm run lint`
  passaram; o build usou o fallback WASM já conhecido para SWC local.
- O deployment de produção `dpl_C11LitsEu9YD9ivA1BZGE3C4LpVe` chegou a
  `READY` com o commit `454e3e5`, que contém a correção funcional `745836e`.
- O commit funcional `12c989f` passou nos testes de payload e conector do
  Mercado Pago: 12 testes em 2 arquivos. `npm run lint` e `npm run build`
  também passaram; o build usou o fallback WASM já conhecido para SWC local.
- O deployment de produção `dpl_27w5qbDkCJ7vD9GX91geqtFiwdki` chegou a
  `READY` com o commit `231ca62`, que contém a correção funcional `12c989f`.
- A implementação de compatibilidade por modelo passou em `npm run lint`,
  `npm run test:unit` (52 testes em 13 arquivos) e `npm run build`. O build
  local utilizou o fallback WASM conhecido para SWC e terminou com sucesso.
- As migrations de modelo foram aplicadas ao projeto Supabase `zalen.shop`.
  A validação posterior confirmou 8 linhas, 31 modelos, zero vínculos de
  produto e 38 itens de navegação adiados. A auditoria de segurança não apontou
  alerta novo das funções adicionadas; a auditoria de performance confirmou os
  índices das duas novas chaves estrangeiras.

## Decisões de continuidade

- O estado técnico relevante deve ser atualizado aqui e enviado ao Git.
- A conversa do Codex é contexto auxiliar; este arquivo e o código versionado são a fonte de verdade entre máquinas.
- Trabalho incompleto pode ser salvo em commit `wip`, desde que não contenha segredos.
- `git stash` é local e não substitui um handoff versionado.

## Encerramento de uma sessão

Antes de trocar de máquina:

1. Atualizar objetivo, concluído, andamento, próximo passo, bloqueios e validações.
2. Remover qualquer segredo ou saída sensível acidental.
3. Verificar `git diff` e `git status`.
4. Fazer commit, inclusive `wip` quando necessário, e enviar ao remoto.
