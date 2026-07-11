# AGENTS.md — Regras para IA, Codex e IDE

Este repositório implementa a **Zalen Shop**, uma plataforma de e-commerce customizável. A Brasil Drones é a primeira loja/caso de uso, não o produto inteiro.

## Leitura obrigatória antes de alterar código

Antes de qualquer implementação relevante, leia:

- `docs/zalen-shop/PROJECT_OVERVIEW.md`
- `docs/zalen-shop/PRD.md`
- `docs/zalen-shop/ARCHITECTURE.md`
- `docs/zalen-shop/DATA_MODEL.md`
- `docs/zalen-shop/SECURITY.md`
- `docs/zalen-shop/AUTH_AND_ACCESS.md`
- `docs/zalen-shop/CONNECTORS_STRATEGY.md`
- `docs/zalen-shop/ADMIN_EXPERIENCE.md`
- `docs/zalen-shop/STOREFRONT_AND_TEMPLATES.md`
- `docs/zalen-shop/ROADMAP.md`
- `docs/zalen-shop/ACCEPTANCE_CRITERIA.md`

Para integrações externas, leia também:

- `docs/integrations/README.md`
- `docs/integrations/official-sources.md`
- o arquivo de pesquisa técnica do provedor em `docs/integrations/`

## Continuidade entre máquinas

O estado de trabalho que precisa sobreviver à troca de máquina deve ser
registrado em `docs/work-context/CURRENT_STATE.md`. A conversa do Codex é
contexto auxiliar; o handoff versionado, o código e a documentação do projeto
são a fonte de verdade.

Antes de iniciar uma nova frente de trabalho:

1. Leia `docs/work-context/CURRENT_STATE.md` depois da documentação obrigatória.
2. Verifique branch, working tree e mudanças remotas antes de editar.
3. Confirme ou registre o objetivo da tarefa, sem inferir escopo apenas pelo último commit.

Antes de encerrar uma sessão ou passar o trabalho para outra máquina:

1. Atualize o handoff com objetivo, concluído, andamento, próximo passo exato,
   bloqueios, validações, decisões e arquivos relevantes.
2. Não registre tokens, senhas, chaves, payloads sensíveis ou saídas de terminal
   com segredos.
3. Faça commit e push, inclusive um commit `wip` quando o trabalho estiver
   incompleto e for seguro versioná-lo.

`git stash` é local e não substitui um handoff versionado. Em uso sequencial de
duas máquinas, faça `git pull --rebase` antes de começar e só troque de máquina
depois de salvar e enviar o estado atual.

## Decisões centrais

1. **Zalen Shop é a plataforma.**
2. **Brasil Drones é a primeira loja/case.**
3. **LB London é uma loja futura/case planejado.**
4. O login e o admin pertencem à identidade **Zalen Shop**.
5. O storefront público pertence à identidade da loja ativa.
6. `/admin` é o painel operacional da loja.
7. `/platform` será futuro e não deve ser implementado agora.
8. O MVP deve permanecer leve.

## Stack atual

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Cloud
- Supabase Auth
- Supabase PostgreSQL
- Zod
- Server Components, Route Handlers e Server Actions quando necessário

## Modelo de produto

A Zalen Shop deve suportar múltiplas lojas com um único app e um único banco:

```txt
Zalen Shop Platform
├── Store: Brasil Drones
│   └── ERP: Bling
└── Store: LB London (futuro)
    └── ERP: Mercos
```

Toda tabela de dados de loja deve carregar `store_id`.

## Conectores

Conectores pertencem ao core da Zalen Shop. Lojas apenas ativam/configuram conectores.

Exemplos:

- Bling — ERP para Brasil Drones.
- Mercos — ERP futuro para LB London.
- Mercado Pago — pagamento futuro.
- Melhor Envio — logística futura.

Use o modelo:

```txt
integration_providers → catálogo global de conectores
store_integrations → conector configurado por loja
```

## Regras de arquitetura

- Não misturar regra de negócio dentro de componentes visuais.
- Não chamar Bling, Mercos, Mercado Pago ou Melhor Envio diretamente do frontend.
- Toda integração externa deve passar por service/connector server-side.
- O frontend nunca é fonte de verdade para preço, estoque, permissão, frete ou total de pedido.
- Queries de dados de loja devem sempre respeitar `store_id`.
- Storefront, admin e futuras rotas platform devem compartilhar core, services e repositories.

## Segurança obrigatória

Nunca:

- Expor tokens no frontend.
- Salvar tokens em logs.
- Colocar tokens em localStorage.
- Usar service role em Client Components.
- Concatenar SQL com input do usuário.
- Desabilitar RLS para resolver problema rápido.
- Aceitar webhook sem validação quando o provedor oferecer assinatura.
- Processar webhook sem idempotência.
- Permitir HTML ou JavaScript livre no editor da loja no MVP.
- Commitar `.env.local`, tokens, service role, senhas ou saídas de terminal com segredos.

## Integrações externas

Antes de implementar qualquer integração externa:

1. Consulte `docs/integrations/official-sources.md`.
2. Leia a documentação oficial do provedor.
3. Preencha o arquivo de pesquisa técnica correspondente.
4. Valide o plano com `docs/zalen-shop/SECURITY.md`.
5. Só então implemente tipos, clients, services e route handlers.

Não é permitido inventar endpoints, headers, payloads, escopos ou fluxos OAuth.

## Escopo atual permitido

Pode avançar em:

- auth e acesso com Supabase;
- admin Zalen Shop para a loja ativa;
- catálogo e pedidos usando Supabase;
- documentação e preparação de conectores;
- UI do login/admin com identidade Zalen Shop;
- storefront da Brasil Drones como case.

Não avance ainda em:

- `/platform` completo;
- billing/planos;
- marketplace de apps;
- Bling real sem pesquisa técnica aprovada;
- Mercos real sem pesquisa técnica aprovada;
- checkout/pagamento real sem decisão explícita;
- IA/WhatsApp automático.
