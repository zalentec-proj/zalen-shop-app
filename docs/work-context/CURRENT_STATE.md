# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-11
- Branch: `refactor/migrate-to-next`
- Commit funcional: `12c989f` — `Display Mercado Pago boleto instructions`
- Working tree no momento deste registro: contém uma alteração local em
  `package.json` e automações de produto/Bling fora destes commits.

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Última mudança conhecida

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
  vencimento e URL externa. A página do pedido permite copiar o código, imprimir
  ou salvar PDF e baixar as instruções locais.

## Objetivo atual

Retestar a exibição e exportação local do boleto no detalhe do pedido, usando a
tentativa pendente já criada no sandbox.

## Em andamento

O commit funcional `12c989f` foi validado localmente e aguarda deployment de
produção. O sandbox usa o e-mail validado no checkout e não pré-preenche
CPF/CNPJ do cliente para cartões.

## Próximo passo exato

1. Aguardar o deployment de `12c989f` ficar `READY`.
2. Reabrir o detalhe do pedido de boleto pendente. O código deve aparecer com
   as ações de cópia, impressão/salvar PDF e download de instruções.
3. Confirmar Pix e cartão: Pix sem campos de cartão, cartão de sandbox sem
   documento do cadastro pré-preenchido.

## Bloqueios e dúvidas

Nenhum bloqueio registrado neste handoff inicial.

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
