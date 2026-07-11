# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-11
- Branch: `refactor/migrate-to-next`
- Commit: `e8e9a5a` — `Fix checkout rate limit persistence`
- Working tree no momento deste registro: contém apenas automações locais de
  produto/Bling fora deste commit.

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

## Objetivo atual

Retestar o fluxo de checkout em produção após a correção do rate limit: consulta
de CEP, preenchimento de endereço e cotação de frete.

## Em andamento

Nenhuma alteração de código pendente. Aguardando o reteste do checkout em
produção.

## Próximo passo exato

1. No checkout, informar o CEP `85801210` e confirmar o preenchimento de
   endereço.
2. Avançar para a etapa de envio e verificar as cotações retornadas.
3. Se o frete ainda falhar, consultar o Sentry pelo código operacional seguro e
   investigar a integração SuperFrete separadamente.

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
