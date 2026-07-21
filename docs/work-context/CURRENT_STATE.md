# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-21
- Branch: `refactor/migrate-to-next`
- Commit base antes desta frente: `46060a8` — `feat(domains): add per-store custom domain self-service`
- A branch e o remoto estavam sincronizados antes da correção JWT do Bling.
  Preserve os scripts locais não rastreados que não pertencem a esta frente.
- Guia de continuidade para outra IDE/máquina: `docs/work-context/IDE_HANDOFF.md`.

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Última mudança conhecida

- Em 2026-07-21 o caminho produtivo multi-store do webhook do Mercado Pago foi
  publicado e salvo no painel como
  `/api/webhooks/mercado-pago/<store_id>/production`. A simulação assinada ainda
  retornou `401` mesmo após sincronizar a assinatura atual no ambiente de
  produção e concluir o redeploy `dpl_A6tToUbihERJdpodEzP3qGpKEsN6`. A causa
  foi isolada na opção de tolerância do SDK Node 3.1.0: a documentação e o
  provedor enviam `ts` Unix em segundos, mas essa opção o interpreta como
  milissegundos. O HMAC continua validado pelo SDK e a janela anti-replay de
  cinco minutos passou a ser aplicada separadamente, normalizando segundos ou
  milissegundos. A correção passou em 25 arquivos/104 testes, TypeScript, build,
  scanner de segredos e `git diff --check`; falta publicar e repetir a
  simulação oficial até obter HTTP 200.
- O primeiro CI após esse patch revelou que o npm do runner Linux ainda
  exigia `@emnapi/core@1.11.2` e `@emnapi/runtime@1.11.2` no nível raiz do
  lockfile. As duas dependências transitivas foram declaradas como opcionais e
  fixadas nessas versões, com metadados e integridades confirmados no registry,
  para tornar o `npm ci` reproduzível entre macOS e Linux. Uma nova instalação
  limpa local, 24 arquivos/100 testes, TypeScript, build e varredura de segredos
  passaram. O GitHub Actions `29836267798` concluiu integralmente verde e o
  deployment `dpl_3rC7VD3pWXkcjmmpJRYRqHiaVXTw` ficou `READY` antes do redeploy
  exclusivo de variável citado acima.
- Em 2026-07-21 o domínio comercial `brasildroneseparts.com.br` foi associado e
  ativado pela Zalen/Vercel. No hPanel Hostinger, o apex passou a usar os dois A
  records exatos informados pela Vercel (`216.198.79.1` e `64.29.17.1`) e `www`
  passou a usar o CNAME dedicado da associação. A propagação pública foi
  confirmada: `https://www.brasildroneseparts.com.br/` responde HTTP 200 com
  certificado válido e o storefront Brasil Drones & Parts; o apex responde 308
  para `www`. O subdomínio `brasil-drones.zalenshop.com.br` permanece como
  fallback administrativo/público da plataforma.
- O `package-lock.json` foi regenerado com npm 11.6.2 para incluir dependências
  opcionais `@emnapi/*` ausentes que bloqueavam `npm ci` no GitHub Actions.
  A instalação limpa, TypeScript, build, 24 arquivos/99 testes, cobertura,
  varredura de segredos e `git diff --check` passaram localmente. A auditoria
  com nível de bloqueio alto passou; permanecem duas ocorrências moderadas do
  PostCSS interno do Next, cuja correção automática sugeriria downgrade
  incompatível para Next 9 e não deve ser aplicada.
- Em 2026-07-21 o primeiro checkout completo de produção após a ativação foi
  concluído com sucesso. O pedido `BD-647495` (`269ad7a4-3eae-4532-8670-8162f17fa1e4`)
  ficou `confirmed`, pagamento `paid`, total R$ 5,00 e frete R$ 0,00. O envio
  automático ao ERP terminou `synced`, sem erro, com ID externo
  `26386477388`; o fulfillment permanece `unfulfilled`, aguardando a operação
  normal de separação e expedição.
- Em 2026-07-21 a área pública do pedido deixou de mencionar o Bling enquanto
  aguarda expedição. Para pedidos pagos sem rastreio, o cliente agora vê apenas
  “O rastreio será disponibilizado assim que o pedido for enviado.”; nomes de
  ERP permanecem restritos ao backend e ao admin.
- Durante o deployment dessa mensagem, uma consulta pública vazia de resolução
  de loja expôs uma inconsistência do fallback da primeira loja. O repositório
  agora usa o contexto estático somente quando o slug conhecido
  `brasil-drones` retorna vazio ou erro; qualquer slug desconhecido continua
  bloqueado. A seleção do hostname também prioriza o domínio público solicitado
  e normaliza listas de proxy. URL e chave pública do Supabase na Vercel foram
  alinhadas com o par local validado, sem registrar valores.
- O storefront público foi revalidado com catálogo real. A URL direta do pedido
  não abriu na sessão de navegador usada na checagem final porque aquela sessão
  pertencia a outra conta autenticada e não listava o pedido; o vínculo correto
  do comprador foi preservado no banco. A suíte passou com 24 arquivos e 99
  testes, além de TypeScript e `git diff --check`. O deployment final é
  `dpl_eZnVMedngPnYwJiXFeb3rAmLYFk3` e ficou `READY`.
- Em 2026-07-21 foi corrigida em produção a regra de frete grátis por produto
  sincronizado do Bling. O contrato oficial `ProdutosDadosDTO.freteGratis` foi
  mapeado para a nova coluna `products.free_shipping`, criada pela migration
  `20260721104332_add_product_free_shipping.sql`. O valor ausente assume
  `false`.
- A cotação continua consultando o provider e preserva modalidade,
  transportadora, prazo e preço original nos metadados, mas cobra zero quando
  todos os itens físicos do carrinho forem elegíveis. Carrinho misto permanece
  com frete pago. A elegibilidade participa da chave do cache e é revalidada
  server-side antes do pedido.
- O produto Bling `16676393579` (`PRO-TP`) foi marcado como elegível após a
  confirmação do lojista. O endpoint de sincronização manual não foi usado
  porque a sessão administrativa disponível não tinha vínculo com a Brasil
  Drones; as próximas sincronizações e webhooks já preservam o campo oficial.
- A validação real no checkout da Brasil Drones retornou PAC, SEDEX, Mini
  Envios, Jadlog e Loggi como `Grátis`, mantendo os respectivos prazos. As
  cinco cotações foram persistidas com preço `0.00`, marca de frete grátis e
  preço original. O total do produto de teste permaneceu R$ 5,00.
- O deployment de produção `dpl_2tn3SCYwPUqLoQnPrpNAyxgZgKSr` ficou `READY`.
  A suíte completa passou com 23 arquivos e 95 testes, além de lint, build e
  `git diff --check`.
- O Security Advisor não apontou regressão da migration; permanece apenas o
  aviso já conhecido de proteção contra senhas vazadas desativada. Os avisos
  de performance existentes são dívida anterior e não foram ampliados por esta
  coluna.
- Ainda em 2026-07-21, o envio de código por e-mail foi recuperado com a
  configuração válida do Resend em produção e confirmado por envio com status
  `sent`; nenhum segredo foi registrado neste handoff.

- Em 2026-07-20 o envio automático de pedidos ao Bling foi ativado somente para
  a Brasil Drones (`orderSend.enabled = true`), depois da criação/cancelamento
  controlado do pedido `BD-167498`. O painel e o banco confirmaram a trava
  ligada; novos envios continuam condicionados a pagamento aprovado, SKU
  existente e idempotência por pedido/ID externo.
- A chave de criptografia de integrações foi rotacionada sem indisponibilidade.
  Os três registros criptografados existentes — Bling produção e Mercado Pago
  teste/produção — foram recriptografados e validados somente com a chave nova.
  A chave anterior foi removida da Vercel e do ambiente local. Uma sincronização
  real de 77 saldos Bling terminou com sucesso após a rotação.
- A conta Bling Drones Brasil está corretamente conectada como cliente OAuth do
  aplicativo público criado pela Zalen. O endpoint oficial de homologação só
  aceita a empresa/conta criadora do aplicativo; por isso o erro Bling de
  empresa divergente não é falha operacional da loja cliente. O painel passa a
  explicá-lo como “Conta cliente (OK)” e não renova token nesse caso.
- Ainda não foi recebido webhook Bling. O cron incremental e o processador de
  pendências permanecem ativos a cada 10 minutos e foram aceitos como
  contingência temporária. A configuração e o teste do webhook devem ser feitos
  posteriormente na conta Bling criadora do aplicativo Zalen.
- A conta criadora foi confirmada na interface do Bling como Bza Soluções em
  Tecnologia LTDA, com o cadastro do aplicativo Zalen Shop aberto. Após
  autorização explícita, o servidor `Zalen Shop Produção` foi salvo em
  `https://app.zalenshop.com.br/api/webhooks/bling`; a persistência foi
  confirmada após recarregar a página. Estoques e produtos v1 estão ativos para
  criação, atualização e exclusão. Pedidos de venda foi desligado após aparecer
  ativo além do escopo suportado; fornecedores de produtos também está inativo.
  O painel Zalen ainda mostra zero webhooks recebidos, como esperado antes de um
  novo evento real; cron incremental, estoque e filas permanecem sem erro.

- Em 2026-07-20 foi concluída a homologação controlada do envio de pedidos no
  Bling real. A correção publicada resolve previamente o contato por documento,
  cria-o quando ausente, resolve os produtos por SKU e envia `contato.id` e
  `produto.id`, como exigido pelo `POST /pedidos/vendas`.
- O pedido pago histórico `BD-167498` foi enviado uma única vez e criado no
  Bling com ID `26384566933`, número de venda `73` e referência de loja
  `BD-167498`. Foram conferidos cliente, SKU `PRO-TP`, quantidade 1, preço
  histórico de R$ 10,00 e total de R$ 22,16. O registro continha observação
  explícita para não faturar nem expedir e foi alterado para `Cancelado` na
  interface autenticada do Bling após a validação.
- A Zalen persistiu o vínculo com `external_erp_sync_status = synced`, sem erro.
  O deployment de produção do commit `d4e3f9e` ficou `READY`. A suíte completa
  passou (21 arquivos, 87 testes), além de lint, build, checagem de segredos e
  `git diff --check`. A trava automática permaneceu desligada durante esse teste
  e só foi ativada após as validações posteriores registradas acima.

- Em 2026-07-20 foi auditada ao vivo a integração Bling da Brasil Drones. O
  admin Zalen mostrou `connected`, ambiente `production`, sync incremental de
  77 produtos/variantes/saldos e 56 categorias ERP, sem erro. No Bling, a conta
  está em teste Cobalto com módulos de produtos e pedidos acessíveis; a
  instalação pública `Zalen Shop` aparece autenticada e possui recursos de
  leitura e gerenciamento de produtos e pedidos de venda.
- Durante essa auditoria, a trava `orderSend.enabled` permanecia desligada. O último envio registrado em
  2026-07-13 terminou em erro, `BD-167498` não existia na listagem de pedidos do
  Bling durante aquela auditoria e nenhum pedido externo foi criado. O painel também
  mostrou zero webhooks recebidos, pendentes ou com erro.
- A homologação oficial falhava no primeiro `GET produtos` com
  `request_failed`, mesmo após renovar o token. A auditoria encontrou ausência
  de `enable-jwt: 1` nas chamadas autenticadas dos clientes operacional e de
  homologação, embora o fluxo OAuth já enviasse o header. A correção foi
  aplicada nos dois clientes e coberta por testes de regressão; o envio
  automático não deve ser ligado antes do deployment e do novo teste manual
  controlado.

- Em 2026-07-16 foi implementado o autosserviço de domínio próprio por loja,
  protegido por `DOMAIN_SELF_SERVICE_ENABLED` e allowlist. Owner/admin pode
  cadastrar um domínio já adquirido, copiar os registros DNS retornados pela
  Vercel, acompanhar propriedade/DNS/SSL, verificar, ativar, trocar o principal
  e remover apenas a associação com o projeto. Operador e viewer permanecem em
  modo leitura. Token e IDs da Vercel são exclusivamente server-side e o client
  nunca envia `force`.
- As migrations `20260716193747_custom_domain_self_service`,
  `20260716193934_custom_domain_fk_indexes` e
  `20260716194351_defer_empty_domain_verification_cron` foram aplicadas ao
  Supabase `xtwobxfepsdfjrtducqb`. Elas criam `store_domains`,
  `store_domain_events`, RLS sem acesso `anon`, unicidade global, ativação
  transacional, auditoria e o job de verificação a cada cinco minutos. O cron
  só faz a chamada HTTP quando existe domínio pendente com verificação vencida;
  as tabelas estão vazias e a rota ainda não existe no deployment atual, então
  não há chamada 404 periódica antes da publicação.
- A resolução pública agora diferencia localhost, `lvh.me`, subdomínio Zalen e
  domínio externo ativo. Host externo desconhecido ou pendente retorna 404 e
  nunca abre a Brasil Drones. O hostname principal alimenta SEO, feed e URLs
  públicas; variantes e domínios antigos recebem redirect 308, preservando path
  e query. `/admin` em domínio próprio passa pelo resolvedor central e termina
  no subdomínio administrativo da loja.
- A integração oficial da Vercel está documentada em
  `docs/integrations/vercel-domains-research.md`. O recurso permanece desligado,
  sem token/IDs configurados, sem domínio real cadastrado e sem deployment. O
  piloto planejado continua sendo `www.brasildrones.com.br`, somente depois do
  bloqueio de pagamento descrito abaixo ser resolvido.

- Em 2026-07-16 a autenticação e a área do cliente foram simplificadas para a
  experiência da loja. A tela de entrada deixou de exibir a coluna institucional
  “Conta do comprador”, regras PF/PJ e explicações sobre o painel Zalen; agora
  apresenta apenas logo, e-mail, código de acesso e criação de cadastro. O
  resumo da conta também passou a falar somente de pedidos, pagamentos e
  entregas. A autenticação por código e os redirecionamentos permanecem iguais.

- Em 2026-07-16 foi revisada a estrutura responsiva compartilhada do admin. A
  navegação lateral fica fixa a partir de 1280 px e pode ser recolhida para uma
  coluna de ícones; abaixo disso ela vira um drawer. A preferência de largura é
  persistida no navegador e o conteúdo acompanha a transição. Cards e grids
  compartilhados agora aceitam encolhimento com
  `min-width: 0`, painéis laterais empilham antes de comprimir o conteúdo e
  tabelas largas mantêm rolagem horizontal dentro do próprio módulo.
- Formulários de envio, domínios, pagamentos e navegação da loja foram ajustados
  para não deixar inputs, selects ou colunas implícitas aumentarem a largura da
  página. `npm run lint` e `npm run build` passaram antes da revisão preventiva
  final; devem ser executados novamente antes de publicar. O preview local está
  em `http://localhost:3012`, sem novo deployment nesta etapa.

- Em 2026-07-16 foi concluída a auditoria e correção de integridade do admin.
  O dashboard agora calcula faturamento, ticket médio, série temporal e consumo
  de clientes apenas a partir de pedidos com `payment_status = 'paid'`; valores
  pendentes permanecem em fila separada. A distribuição de categorias deixou
  de usar percentuais fixos e passa a derivar os valores dos itens de pedidos
  pagos e dos vínculos reais de produto-categoria.
- As ações que criam clientes e os endpoints operacionais do Bling passaram a
  exigir função operacional (`owner`, `admin` ou `operator`); OAuth e
  homologação exigem `owner` ou `admin`. A interface também desabilita essas
  operações para leitor e quando a origem exibida é mock/indisponível. O admin
  não exibe mais perfil, notificações, meios de pagamento ou domínio próprio
  como se fossem configurações persistidas quando não são.
- Foi aplicada ao projeto Supabase de produção a migration
  `20260716143538_harden_admin_data_integrity`. Ela fixa o `search_path` dos
  dois gatilhos apontados pelo advisor, mantém inativos os 38 links de modelos
  até o deploy seguro e cria a restrição que impede novos pedidos sem pagamento
  de avançar para processamento, envio ou entrega. A validação posterior
  confirmou zero links de modelo ativos e o `search_path` vazio nos dois
  gatilhos.
- Há um único pedido histórico já enviado com pagamento pendente. Ele foi
  preservado: não é seguro inferir se o correto é confirmar o pagamento ou
  reverter a expedição. Um operador deve resolver esse registro no processo
  operacional; depois disso, validar a restrição do banco se desejar remover o
  estado `NOT VALID`.
- O Security Advisor agora só aponta a proteção contra senhas vazadas do
  Supabase Auth como desativada. Essa opção precisa ser habilitada no painel do
  projeto, pois não há alteração de schema ou de código que a substitua.

- O navbar público da Brasil Drones foi reorganizado em duas faixas: a superior
  concentra logo, busca, conta e carrinho; a inferior concentra somente a
  navegação de categorias. A fonte continua sendo `storefront_navigation_items`,
  portanto visibilidade, ordem e submenus seguem controlados pelo admin. As
  páginas de categoria e compatibilidade por modelo receberam espaçamento para
  o novo cabeçalho fixo. Nos submenus de desktop, a lista de subcategorias é
  acompanhada por uma prévia navegável de produto do catálogo. Sem acesso local
  ao Supabase, o fallback preserva linhas e modelos a partir de
  `drone-model.definitions.ts`; em produção a configuração salva pela loja tem
  prioridade. Esta alteração ainda não foi publicada.

- A logo do storefront Brasil Drones foi atualizada no asset
  `src/assets/logo brasil.svg` e enviada ao Git no commit `8533a5e`. Se a
  produção ainda exibir a logo antiga, verificar se o deploy em produção está
  apontando para esse commit/branch e se há cache/CDN servindo o asset anterior.

- Foi implementada a base de compatibilidade por modelo DJI para Brasil Drones,
  separada das categorias técnicas do Bling. As migrations de produção
  `20260713230351_add_drone_model_compatibility.sql` e
  `20260713230504_add_drone_model_foreign_key_indexes.sql` criaram tabelas
  com RLS para linhas, modelos e vínculos produto-modelo; foram semeadas oito
  linhas e 31 modelos. Não houve alteração de produto, categoria técnica,
  preço, estoque ou dados no Bling.
- A navegação do storefront recebeu suporte a rotas internas seguras e foram
  preparados os destinos `/modelos/[slug]` e `/modelos/linha/[slug]`, além da
  tela administrativa `/admin/configuracoes/compatibilidade`. As sugestões são
  derivadas de nome/SKU e ficam em revisão; apenas vínculos confirmados por um
  operador aparecem no storefront.
- Os 38 itens de menu por modelo foram propositalmente desativados pela
  migration `20260713230806_defer_model_navigation_until_storefront_deployment.sql`.
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
  `20260711165710_fix_security_rate_limit_timestamp.sql`.
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

Acompanhar o primeiro pedido novo pago enviado automaticamente ao Bling pela
Brasil Drones, confirmando criação única e ausência de erro. Configurar e validar
o webhook Bling na conta criadora do aplicativo Zalen, substituindo a
contingência temporária de polling. Preservar em paralelo os bloqueios e
validações pendentes do Mercado Pago, domínios e compatibilidade descritos abaixo.

## Em andamento

A correção `enable-jwt: 1`, a resolução de referências de contato/produto e a
rotação segura de chave estão publicadas. A homologação de pedido criou e depois
cancelou o Bling `26384566933`; `BD-167498` está sincronizado sem erro. O envio
automático está ligado somente para a Brasil Drones.

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

O deployment funcional de produção do commit `43ce6cb` está `READY`; o redeploy
`dpl_EGmmuwnQ4BmugPjzX5nFr3Su2zCk` carregou a chave nova com a janela temporária
de fallback. Os registros foram recriptografados, a chave anterior foi removida
e o próximo deployment deve confirmar a configuração final sem fallback. Os
scripts locais não rastreados e não relacionados devem continuar preservados.

O autosserviço de domínios está publicado e o primeiro piloto real foi concluído
com DNS, SSL, storefront e redirecionamento validados. As credenciais continuam
exclusivamente server-side e a habilitação permanece restrita à allowlist.

## Próximo passo exato

0. Publicar a normalização do timestamp do webhook do Mercado Pago, aguardar CI
   e deployment verdes e repetir a simulação assinada da URL produtiva com o
   pagamento `168939464233` até confirmar HTTP 200 e evento processado.
1. Acompanhar o próximo pedido novo pago da Brasil Drones e confirmar que foi
   criado uma única vez no Bling, com `external_erp_sync_status = synced`.
2. Gerar uma alteração controlada no produto de teste do Bling e confirmar no
   painel Zalen o primeiro webhook assinado válido de produto; depois repetir
   com estoque e conferir processamento sem erro ou duplicidade.
3. Depois do primeiro webhook processado, manter o cron de 10 minutos somente
   como camada de reconciliação, não como fonte principal de atualização.

### Pendências paralelas já registradas

0. Resolver manualmente o pedido histórico que está como enviado sem pagamento
   confirmado; registrar a decisão operacional antes de validar integralmente a
   restrição `orders_fulfillment_requires_payment`.
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
7. A validação controlada do pedido Bling foi concluída com criação, conferência
   e cancelamento; o envio automático foi ativado posteriormente, após rotação
   de chave e nova validação de estoque.
8. Depois do deploy seguro do código de compatibilidade, abrir
   `/admin/configuracoes/compatibilidade`, revisar os modelos sugeridos por
   produto e salvar apenas os vínculos confirmados. Só então usar “Ativar menu
   de modelos”. Não recategorizar produtos já classificados tecnicamente no
   Bling.
9. No mesmo deployment seguro, publicar o código de domínios com
   `DOMAIN_SELF_SERVICE_ENABLED=false`; configurar no servidor
   `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` e a allowlist da
   Brasil Drones, sem expor valores no cliente ou no Git.
10. Habilitar apenas a Brasil Drones e cadastrar `www.brasildrones.com.br` como
    piloto, sem alterar inicialmente o A record do apex. Validar endpoint
    `.well-known`, SSL, storefront, login do comprador e pagamento controlado.
11. Alterar o apex somente em janela explícita de corte; depois validar o
    redirect 308 para `www`. Só liberar todas as lojas após o piloto.

## Bloqueios e dúvidas

Validação final de pagamentos em produção depende somente da publicação da
normalização do timestamp e de uma nova simulação assinada HTTP 200. URL,
assinatura produtiva, pedido pago real, reconciliação e domínio estão
configurados. Nenhum código ou credencial deve ser compartilhado no handoff.

O acesso ao projeto Supabase correto foi restabelecido. A troca coordenada do
segredo de cron continua condicionada à validação dos ambientes da Vercel e não
deve expor o valor em terminal, código ou documentação.

## Validação

- A correção JWT do Bling passou em 84 testes distribuídos em 20 arquivos,
  `npm run lint`, `npm run build` e `git diff --check`. Os testes novos validam
  `enable-jwt: 1` no cliente operacional e na sequência de homologação.
- O autosserviço de domínios passou em `npm run lint`, `npm test` (82 testes em
  18 arquivos), `npm run build`, `git diff --check` e no scanner de segredos.
  O build confirmou as novas rotas `.well-known`, job e resolvedor
  administrativo.
- `npx supabase migration list --linked` terminou sem divergências após
  reconciliar as versões locais de 11 e 13 de julho e aplicar as três migrations
  de domínio. A inspeção do catálogo confirmou RLS ativo, zero privilégio
  `anon`, leitura `authenticated` por política, escrita/RPC por `service_role`,
  FKs compostos e cron ativo a cada cinco minutos.
- O Security Advisor não apontou alerta novo para domínios; permanece somente o
  aviso global de proteção contra senhas vazadas desativada. O Performance
  Advisor deixou de apontar FKs sem índice nas tabelas novas; os avisos restantes
  nelas são apenas índices ainda não usados porque não existem registros.
- `npm run security:audit` não encontrou vulnerabilidade alta/crítica. Há duas
  ocorrências moderadas de PostCSS dentro do Next; a correção automática
  sugerida exigiria `--force` e downgrade incompatível para Next 9, por isso não
  foi aplicada.

- A correção de integridade do admin passou em `npm run lint`, `npm run
  test:unit` (53 testes em 13 arquivos) e `npm run build`. A migração foi
  aplicada e verificada no Supabase de produção sem expor dados sensíveis.
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
