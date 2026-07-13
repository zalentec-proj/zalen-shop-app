# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-13
- Branch: `refactor/migrate-to-next`
- Commit remoto atual: `3566597` — `Record payment production validation status`
- Working tree no momento deste registro: contém alterações locais não
  relacionadas de produto/Bling e uma implementação ainda não publicada para
  confirmação visual de Pix.

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Última mudança conhecida

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

## Objetivo atual

Restaurar e validar a configuração de produção do Mercado Pago e publicar a
confirmação visual de Pix somente depois de homologar a assinatura de webhook e
as dependências server-side por ambiente.

## Em andamento

O deployment de produção vigente é anterior à implementação de confirmação
visual de Pix. A conciliação periódica pode atualizar pedidos que não receberam
o webhook em tempo real, mas não oferece a experiência imediata do checkout.

A configuração de pagamentos em produção continua bloqueada até a restauração
controlada dos segredos por ambiente e a validação de entrega autenticada do
webhook.

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
