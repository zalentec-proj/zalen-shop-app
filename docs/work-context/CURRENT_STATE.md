# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-07-11
- Branch: `refactor/migrate-to-next`
- Commit: `cea0556` — `Move internal job schedule to Supabase Cron`
- Working tree no momento deste registro: limpa

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Última mudança conhecida

- O agendamento de jobs internos foi movido para Supabase Cron.
- O plano de implementação e a pesquisa do Bling foram atualizados.
- O guia do piloto Brasil Drones foi atualizado.
- `vercel.json` foi removido.
- Foi adicionada a migration `supabase/migrations/20260711134815_schedule_internal_jobs_with_supabase_cron.sql`.

## Objetivo atual

Corrigir a falha do pré-cadastro no checkout em produção: a consulta de CEP é
interrompida quando a infraestrutura de rate limit falha. Manter o rate limit
persistente, configurar o segredo próprio na Vercel e registrar a causa de forma
segura para diagnóstico.

## Em andamento

- Diagnóstico confirmou que `85801210` não falha na SuperFrete: a mensagem
  exibida vem da proteção de rate limit usada antes da consulta ViaCEP.
- A causa raiz foi reproduzida no Supabase: a função
  `consume_security_rate_limit` usava `current_time`, que o PostgreSQL
  interpretava como uma expressão de hora no `INSERT`, causando erro de tipo no
  campo `updated_at`.
- A migration `20260711165637_fix_security_rate_limit_timestamp.sql` substitui
  essa variável por `request_timestamp` e já foi aplicada no projeto Supabase
  de produção.
- `RATE_LIMIT_HASH_SECRET` foi criado como segredo sensível na Vercel para
  produção. O preview não possui branch independente porque
  `refactor/migrate-to-next` é o branch de produção configurado na Vercel.
- O checkout agora envia ao Sentry apenas um código operacional seguro quando a
  infraestrutura de rate limit falhar; nenhum CEP, IP ou segredo é registrado.

## Próximo passo exato

1. Commitar e enviar a correção para `refactor/migrate-to-next`.
2. Confirmar o deployment de produção gerado pela Vercel.
3. Repetir o fluxo de CEP no checkout e avançar até a cotação de frete.

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
