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

A preencher no início de cada nova frente de trabalho. Não inferir uma nova
feature apenas a partir deste arquivo ou do último commit.

## Em andamento

Nenhuma tarefa em andamento foi registrada neste handoff inicial.

## Próximo passo exato

1. Ler este arquivo e o `AGENTS.md`.
2. Registrar aqui o objetivo da próxima tarefa antes de alterar código.
3. Verificar branch, working tree e mudanças remotas.
4. Executar a tarefa somente dentro do escopo e das regras documentadas.

## Bloqueios e dúvidas

Nenhum bloqueio registrado neste handoff inicial.

## Validação

- Documentação obrigatória do projeto relida ao criar este arquivo.
- Testes de aplicação não foram executados nesta sessão de configuração do handoff.

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

