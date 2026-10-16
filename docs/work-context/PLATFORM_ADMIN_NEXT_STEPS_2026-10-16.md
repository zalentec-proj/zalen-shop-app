# Próximos passos para o painel da plataforma e novas lojas

Atualização após autorização do responsável: a primeira etapa de acesso,
login e listagem de lojas foi implementada em `codex/platform-admin-access`.
O estado de validação e publicação está em `CURRENT_STATE.md`. O diagnóstico
abaixo registra a base anterior; cadastro e personalização continuam próximos.

Diagnóstico de 16/10/2026. O próximo incremento recomendado é um Platform Admin
enxuto, acompanhado de apresentação configurável por loja. O resultado esperado
é o dono da Zalen cadastrar uma segunda loja, definir seu responsável e sua
identidade e acessar seu painel operacional, reutilizando o core existente.

Este documento é uma proposta de próxima fase. A solicitação desta sessão foi
ler a documentação e identificar o próximo passo; não houve implementação nem
liberação de `/platform` no escopo vigente.

## O que já existe

| Base | Evidência no repositório | Consequência |
| --- | --- | --- |
| Uma aplicação e um banco com dados por loja | `ARCHITECTURE.md`, `DATA_MODEL.md` e migrations | Novas lojas devem reutilizar esse core. |
| Papéis globais e vínculos por loja | `src/modules/auth/auth.service.ts`, `auth.types.ts` e migrations de acesso | Reaproveitar `platform_users` e `store_memberships`. |
| Resolução por subdomínio e domínio próprio | `src/modules/stores/store-resolution.ts` e módulo `domains` | O endereço identifica a loja; hosts desconhecidos não ganham outra loja como fallback. |
| Admin operacional compartilhado | `src/app/admin/` e `ADMIN_EXPERIENCE.md` | Cada loja usa `/admin` no seu subdomínio, com identidade Zalen Shop. |
| Catálogo de conectores e configurações por loja | `src/modules/integrations/core/` | Conexões e credenciais devem continuar isoladas por `store_id`. |

Essas evidências são de documentação, código e migrations versionados. Não
houve consulta ao banco ou à configuração de produção nesta sessão.

## O que falta

- Não existe uma área `src/app/platform/` nem fluxo administrativo de criação
  de lojas no código consultado. O seed inicial cadastra somente Brasil Drones.
- O login sem destino específico continua usando Brasil Drones como destino
  padrão quando autorizado. Não existe seletor das lojas acessíveis à conta.
  O proxy e a validação de `next` também precisam reconhecer as novas rotas.
- A home resolve os dados pela loja, mas sempre renderiza `src/App.tsx` com a
  composição visual atual. `Hero`, `Footer`, `GGGroupCompanies` e outros
  componentes contêm identidade e conteúdo da Brasil Drones/GG/DJI.
- `src/lib/branding/current-store-brand.ts` deriva da loja estática. A home e
  outras páginas ainda têm títulos e conteúdo de SEO específicos de drones.
- A configuração de loja online existente edita navegação; ainda não fornece
  um modelo de tema/apresentação persistido nem seleção de storefront.
- Os documentos `README.md`, `AUTH_AND_ACCESS.md` e partes do roadmap conservam
  descrições antigas de loja única/fixa. A resolução por host já está no código.

## Sequência de entrega recomendada

### 1. Formalizar a próxima fase e separar o acesso global

Ao iniciar a implementação, atualizar `AGENTS.md`, PRD, arquitetura, segurança,
auth, roadmap e critérios de aceite para permitir o **Platform Admin mínimo**.
A regra atual ainda diz que `/platform` é futuro. Essa atualização deve manter
billing, marketplace e editor visual avançado fora desta entrega.

Criar o guard global server-side baseado em sessão validada e `platform_users`,
usado em cada entrada de leitura e mutação, além do layout. Um `store_owner`
continua sendo dono apenas da sua loja. Nenhuma conta deve ganhar papel global
automaticamente por e-mail, cadastro ou `user_metadata`.

Destino proposto após login, respeitando primeiro um `next` autorizado:

- Papel global: `app.zalenshop.com.br/platform`.
- Um vínculo de loja: admin daquela loja.
- Vários vínculos: seletor das lojas permitidas.
- Sem acesso: mensagem de acesso indisponível, sem encaminhamento para outra loja.

O painel global precisa resolver sua própria autorização no host `app`, sem
exigir a resolução de uma loja ativa. Verificar o papel da conta que será dona
da plataforma antes do piloto; esta análise não conferiu nem alterou esse papel.

### 2. Entregar gestão mínima de lojas

Rotas propostas:

- `/platform`: resumo de lojas e pendências operacionais.
- `/platform/lojas`: lista, busca e ação de abrir o admin da loja.
- `/platform/lojas/nova`: criação da loja.
- `/platform/lojas/[id]`: dados, responsável, apresentação, endereço e status.

O cadastro inicial recebe nome, slug validado contra os hosts reservados,
responsável e apresentação escolhida. Usar `planned` para preparação,
`active` para publicada e `inactive` para desativada, formalizando esses valores
no contrato. Manter o slug estável nesta primeira versão.

Criar loja, vínculo com usuário existente e configuração inicial em operação
atômica e idempotente. Convites por e-mail podem ser incremento separado.
Registrar ator, loja, ação e resultado em auditoria sem segredos. Nesta versão,
propor criação/ativação/desativação apenas para `platform_owner`; o
`platform_admin` mantém suporte e configuração permitidos pelo modelo atual.

Lojas em preparação precisam ser legíveis pelo painel autorizado, embora não
sejam públicas. Não usar o repository público atual como listagem global,
porque as políticas públicas de `stores` expõem somente lojas ativas.

### 3. Separar apresentação e configuração de cada loja

Propor configuração persistida com `store_id` único, modo `custom` ou
`template`, chave de implementação permitida e conteúdo validado por Zod:
logo, favicon, cores, banners, textos, contatos, redes sociais e SEO.
Definir RLS e grants junto do schema; dados públicos de apresentação devem ficar
separados de configurações internas e credenciais.

Preservar a composição Brasil Drones como implementação custom própria e criar
uma apresentação neutra reutilizável. O renderer escolhe a apresentação pelo
contexto resolvido no servidor. Cabeçalho, rodapé, produto, categoria, carrinho,
conta e metadados também precisam receber essa configuração; trocar apenas a
home não entrega uma loja personalizada completa.

Separar configuração em edição e publicada. A prévia de uma loja `planned`
deve ser protegida; ativar a loja é uma ação explícita. Não permitir HTML, JS ou
CSS arbitrários nem SVG livre enviado por lojista. Uploads usam paths por loja.

### 4. Provar o fluxo com uma segunda loja em homologação

Criar uma loja piloto isolada, com marca, catálogo e responsável próprios,
usando a apresentação neutra. A LB London é o segundo caso previsto nos docs,
mas seus dados reais e seu ERP precisam ser definidos na frente correspondente.
Validar primeiro a plataforma com catálogo de teste, sem depender de concluir
Mercos.

Antes de ativar uma segunda operação, revisar fallbacks e configurações globais
de catálogo, navegação, SEO, contatos, e-mail, frete, pagamentos e webhooks.
Nenhuma loja nova pode herdar conteúdo comercial ou credenciais da Brasil
Drones. O cadastro deixa integrações desconectadas até configuração própria.
Se houver controle de quais conectores a loja pode usar, sua permissão deve ser
distinta do estado da conexão e aplicada também no serviço, além da interface.

## Critérios de aceite da primeira entrega

1. Dono global entra pelo login central e chega ao painel da plataforma;
   lojistas não conseguem ler nem alterar suas rotas e ações globais.
2. Criar uma loja duas vezes com o mesmo envio não duplica loja ou vínculo;
   slug duplicado/reservado falha sem deixar cadastro parcial.
3. Loja `planned` tem prévia autenticada e não fica pública; ativar/desativar
   altera a disponibilidade pública inclusive com domínio próprio.
4. Segunda loja apresenta nome, logo, cores, conteúdo e SEO próprios em todas
   as páginas compartilhadas; Brasil Drones preserva sua apresentação custom.
5. Conta da loja A não acessa dados privados ou mutações da loja B por URL,
   requisição direta ou Data API. Testar também conta com múltiplos vínculos,
   papel global, sessão expirada e conta sem vínculo.
6. Loja vazia não exibe produtos, menus de drones ou contatos da Brasil Drones;
   loja sem pagamento configurado não cria cobrança com credenciais de outra.
7. Regressões de auth, resolução, isolamento, criação e apresentação passam,
   junto de TypeScript, build, scanner de segredos e revisão de migrations/RLS.

O acesso privilegiado do servidor exige autorização antes da consulta. A
documentação oficial do Supabase confirma que `service_role` pode contornar
RLS; manter grants e políticas coerentes e testar os casos de permitir/negar:
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Condições para liberar vendas em novas lojas

O handoff mais recente de 06/10 ainda registra pendências de concorrência de
estoque, persistência atômica de pedido/itens, eventos de pagamento fora de ordem
e conferência operacional do Bling. Essas pendências não impedem desenvolver o
painel em homologação, mas devem ser tratadas antes de expandir vendas reais.
Não interpretar o histórico antigo do handoff como homologação atual.

Continuam fora desta proposta: billing/planos, marketplace, editor livre,
novas automações de IA e implementação real de Mercos sem pesquisa oficial.

## Primeiro incremento executável

Atualizar o escopo documental para esta fase mínima e implementar guard global,
destino de login por papel/vínculo e `/platform/lojas` com listagem e acesso ao
admin das lojas permitidas. Depois entregar criação atômica e apresentação por
loja, antes do piloto da segunda loja. Esse primeiro incremento não requer
alterar o checkout ou conectar um novo ERP.
