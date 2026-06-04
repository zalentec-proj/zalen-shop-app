# Skill: create-plan

## Objetivo

Antes de qualquer alteração relevante no projeto, o agente deve criar um plano curto, claro e revisável.

Essa skill existe para evitar mudanças impulsivas, desalinhadas com a arquitetura ou que quebrem decisões do projeto Zalen Shop.

## Quando usar obrigatoriamente

Use esta skill antes de alterar:

- Auth
- Supabase
- migrations
- RLS
- banco de dados
- conectores
- integrações externas
- webhooks
- checkout
- pedidos
- permissões
- segurança
- estrutura de pastas
- admin
- storefront
- UI relevante
- arquivos de documentação norteadora

## Quando pode usar plano mínimo

Para alterações pequenas, como correção de texto, ajuste simples de classe CSS ou documentação pontual, pode usar um plano mínimo.

## Formato obrigatório do plano

Antes de executar, responder com:

### Plano

1. Objetivo da alteração
2. Arquivos prováveis a alterar
3. O que não será alterado
4. Riscos
5. Critérios de aceite
6. Comandos de validação

## Regras

- Não executar antes de apresentar o plano.
- Não alterar escopo sem avisar.
- Não implementar integração externa sem pesquisa técnica oficial.
- Não mexer em segredos.
- Não commitar `.env.local`.
- Não usar service role em Client Components.
- Não chamar API externa pelo frontend.
- Não quebrar a distinção:
  - Zalen Shop = plataforma
  - Brasil Drones = primeira loja
  - LB London = futura loja
- Não implementar `/platform` agora.

## Comandos de validação padrão

Sempre que fizer sentido, rodar:

```bash
npm run lint
npm run build
```
