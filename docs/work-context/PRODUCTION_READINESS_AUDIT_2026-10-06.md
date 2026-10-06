# Auditoria de prontidão para produção — 06/10/2026

## Conclusão

**Não aprovado para declarar o app integralmente pronto para produção.** O app
publicado atende vendas, mas há falhas operacionais confirmadas e lacunas no
código que afetam estoque, pagamento, acesso e consistência de pedidos.
Build e testes aprovados não eliminam esses riscos.

Esta entrega altera somente a sidebar solicitada: remove números e siglas,
preservando ícones, nomes, rotas, loja ativa e comportamento responsivo. As demais
correções abaixo são propostas, não implementadas nem publicadas nesta auditoria.

## Escopo e limites da verificação

- Base local, remoto e produção conferidos: `a376b1ac539c4862b4af52cf5f33ba2357ffa7c3`.
  Produção Vercel estava `READY` nessa base. Alterações desta entrega ficam em
  `codex/production-readiness-audit`, sem merge na branch de produção.
- Revisão estrutural dos fluxos: host/loja, autenticação, autorização,
  catálogo/compatibilidade, preços PF/PJ, checkout, frete, pedidos, pagamentos,
  webhooks, Bling, e-mail, WhatsApp, observabilidade e publicação.
- Inspeção em leitura das 17 telas do admin e de páginas públicas; verificações
  responsivas pontuais. Isso **não equivale** a E2E de todas as telas e papéis.
- Supabase `zalen.shop` acessível novamente pelo plugin. Consultas de schema,
  políticas, integridade, saúde e contagens foram somente de leitura e limitadas
  à loja Brasil Drones quando envolviam dados comerciais.
- Não foram criadas compras, pagamentos, cotações, clientes, mensagens, envios
  ao ERP, etiquetas ou notas fiscais. Nenhum pedido ou item do carrinho existente
  foi alterado. Nenhuma migration, reconexão OAuth ou configuração foi aplicada.
- O ambiente de homologação isolado do banco e credenciais reais não foi
  comprovado. Testes que persistem dados ou chamam provedores ficaram pendentes.
- Não se afirma leitura manual de cada linha do repositório, teste de invasão,
  certificação financeira/fiscal ou inexistência de outras falhas.

## Validações executadas

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| TypeScript (`npm run lint`) | Aprovado | O script é `tsc --noEmit`, não uma análise ESLint |
| Testes unitários/renderização | 266 testes, 58 arquivos aprovados | Não exercitam uma venda completa com provedores |
| Build de produção | Aprovado | Não confirma credenciais, callbacks ou integridade em execução |
| Scanner de segredos | Aprovado | Detector de padrões de alta confiança; não prova ausência de qualquer segredo |
| `git diff --check` | Aprovado | Qualidade do diff, não segurança funcional |
| Dependências de produção | **Reprovado** | 9 pacotes afetados: 1 crítico, 7 altos, 1 moderado |
| Vercel: erros de runtime nos últimos 7 dias | Nenhum retornado pela consulta | Há jobs de negócio falhando no banco; ausência de log não significa saúde |
| Supabase: schema público | 43 tabelas com RLS habilitada | Service role exige autorização no servidor, independentemente de RLS |
| E2E financeiro, ERP e matriz de papéis | **Não executado integralmente** | Exige homologação isolada e contas de teste |

O relatório de cobertura apresenta 99,37% de statements, mas a configuração
inclui apenas quatro arquivos: documento brasileiro, consulta de CEP,
rate limit e payload de pagamento. **Não é 99% de cobertura do app.** Os testes
atuais de pagamento cobrem mapeamento de status e comparação de valores, não
a reconciliação concorrente com múltiplas tentativas.

## Evidência operacional de produção

Snapshot agregado em 06/10/2026, com integridade reconferida às 18:48 UTC:

- 22 pedidos: 5 confirmados/pagos, 15 pendentes com pagamento não aprovado e
  2 pendentes com pagamento pendente.
- Zero pedidos sem itens; zero divergências na fórmula
  `total = subtotal + shipping_total - discount_total`; zero valores de itens
  negativos/quantidades não positivas nessas consultas.
- Zero divergências de `store_id` entre pedidos/itens e produtos/variantes
  nas relações consultadas. Isso não substitui teste de autorização entre lojas.
- Um pedido pago sem ID externo no ERP. Precisa de conferência operacional;
  envio automático desligado pode explicar a pendência. Não foi enviado.
- Últimos sete dias: 121 jobs de produtos e 121 de estoque com erro, iniciando
  em 01/10 às 18:00 UTC e seguindo até 06/10 às 18:00 UTC. Últimos sucessos
  observados em 01/10 por volta de 17:00 UTC.
- Códigos recentes: `token_refresh_already_attempted` para produtos e
  `bling_inventory_sync_failed` para estoque. Não permitem concluir sozinhos
  se a causa é revogação, credencial, escopo ou outra resposta do provedor.
- WhatsApp: 15 entregas registradas, 14 `accepted`, 1 `delivered`.
  Aceitação pela API **não prova entrega ao destinatário**.
- Nenhuma alteração corretiva foi feita nesses registros. O relatório não
  inclui nomes de clientes, documentos, endereços, tokens ou payloads.

## Prioridade 1 — corrigir antes de considerar o sistema pronto

### P1-01 — Bling conectado não significa sincronização saudável

**Confirmado em produção:** o painel apresenta conexão ativa enquanto os jobs
de produtos/estoque falham há dias. Risco de operar catálogo/estoque desatualizado,
especialmente junto da ausência de proteção de estoque no checkout.

Evidência: `src/app/admin/integracoes/bling/page.tsx:73`,
`src/modules/integrations/bling/bling.api-client.ts:111` e contagens acima.
Correção proposta: separar conexão, última sincronização bem-sucedida e saúde;
exibir alerta acionável no painel principal. Conferir autorização com o responsável
pela conta; não limpar marcadores nem repetir envio de pedido sem conferência no ERP.
Aceite: novo job bem-sucedido, estoque comparado com amostra do ERP e alertas que
não indiquem saúde apenas por `connected`.

### P1-02 — Checkout não valida/reserva estoque no servidor

**Confirmado pelo percurso do código, sem tentativa de compra real:**
`resolveCheckoutPricing` busca produto/variante e recalcula preço, mas multiplica
pela quantidade sem comparar `variant.stock`. A criação do pedido também não
reserva ou desconta estoque de forma atômica. Bloquear um botão no frontend não
protege chamadas alteradas, carrinhos antigos ou compras concorrentes.

Evidência: `src/modules/pricing/pricing.service.ts:187`,
`src/app/carrinho/actions.ts:1469`, `src/modules/orders/order.service.ts:116`,
`src/modules/orders/order.repository.ts:1023`.
Correção proposta: consolidar quantidades por variante, validar disponibilidade
no servidor e definir reserva/baixa/liberação atômicas, conciliadas com o ERP.
Essa decisão requer regra de negócio explícita para evitar dupla baixa.
Aceite: estoque zero, quantidade acima do estoque, variante repetida e duas
compras simultâneas da última unidade, sem pagamento de item indisponível.

### P1-03 — Eventos de pagamento podem regredir um pedido já pago

**Confirmado pelo código; não observado como ocorrência nos pedidos consultados:**
o fluxo aprovado tem atualização condicional, mas pending/rejected/cancelled
chamam uma atualização sem condição sobre o estado atual ou a tentativa que
efetivamente quitou a venda. Uma tentativa antiga recusada pode substituir
`paid` por `failed` e ainda gerar aviso de falha ao cliente.

Evidência: `src/modules/payments/mercado-pago-payment.service.ts:378` e
`src/modules/orders/order.repository.ts:803`.
Também há resposta visual insegura: a ação Brick usa `payment.status` quando a
reconciliação falha; um retorno bruto aprovado pode aparecer como sucesso sem
aprovação local válida (`src/app/carrinho/actions.ts:1920`).
Correção proposta: máquina de estados condicionada à tentativa/transação,
tratamento específico de reembolso/chargeback e falha fechada na reconciliação.
Aceite: aprovação seguida de falha de tentativa antiga, eventos duplicados e
fora de ordem, valor/ambiente divergente, concorrência e notificações únicas.

### P1-04 — Leitura administrativa privilegiada depende demais do layout

**Lacuna confirmada; exposição por usuário indevido não foi testada em produção:**
produtos, clientes e compatibilidade consultam services com cliente privilegiado
sem autorização local antes da leitura. O layout compartilhado verifica vínculo,
mas não deve ser a única barreira de acesso a dados em Server Components/RSC.
Pedidos já fazem a verificação antes da consulta e servem de referência.

Evidência: `src/app/admin/{produtos,clientes}/page.tsx`,
`src/app/admin/configuracoes/compatibilidade/page.tsx`,
`src/modules/catalog/product.repository.ts:1407`,
`src/modules/customers/customer.repository.ts:655` e
`src/app/admin/pedidos/page.tsx:22`.
Correção proposta: guard server-side próximo da leitura privilegiada e retorno
mínimo de dados. RLS habilitada não protege queries com service role.
Aceite: sem sessão, usuário autenticado sem vínculo, owner/admin/operator/viewer
e usuário de outra loja, incluindo navegação direta/RSC e ações.
Referência: [autorização e camada de acesso a dados no Next.js](https://nextjs.org/docs/app/guides/authentication).

### P1-05 — Persistência do pedido e itens não é transacional

**Lacuna confirmada; nenhum órfão encontrado no snapshot:** são dois inserts
separados. Se o insert de itens falhar após o pedido, a venda fica parcialmente
gravada; repetir o checkout não garante recuperação íntegra.

Evidência: `src/modules/orders/order.repository.ts:1064` e `:1123`.
Correção proposta: operação transacional com validação de loja/itens e
idempotência; tratar falha e retomada sem pedido incompleto nem duplicado.
Aceite: falha forçada no segundo insert, retry e dois submits concorrentes em
homologação. Não aplicar SQL de correção em pedidos reais nesta auditoria.

### P1-06 — Valores/promessas comerciais divergem entre telas

**Confirmado na página pública de produto por URL:** ainda anuncia 5% de desconto
no Pix com multiplicação somente visual, não representada no cálculo do pedido.
Uma página mostrou parcela `R$ 33,333` e Pix `R$ 379,991` para preço `R$ 399,99`.
A home usa outro componente, já com formatação diferente.

Evidência: `src/app/produto/[slug]/ProductDetailClient.tsx:45` e `:249`,
`src/components/product/ProductDetailsView.tsx` e pricing server-side.
Correção proposta: uma única apresentação de preço, proveniente da mesma regra
do checkout; duas casas decimais; não anunciar desconto não implementado.
Promessas de 12x sem juros e 50% de desconto no frete acima de R$300 também
precisam ser homologadas com a configuração comercial/provedor. A regra de 50%
não foi localizada no cálculo nativo de frete; isso não comprova ausência de
eventual condição comercial configurada fora do app.
Aceite: comparar home, categoria, modelo, produto, carrinho, Pix e cartão PF/PJ.

### P1-07 — Auditoria de dependências reprovada

`next` 16.2.11 e `sharp` 0.35.3 estão entre os pacotes afetados. Os overrides de
`sharp`, `brace-expansion` e `fast-uri` também prendem versões vulneráveis.
Atualizar pacote sem revisar esses overrides pode manter o problema.

O alerta crítico não é prova de exploração da loja. As condições diferem:
[Windows-hosted](https://github.com/advisories/GHSA-p293-qw3h-jr36),
[otimização AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) e
[ImageResponse/next-og](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
Não foi localizado uso de `ImageResponse`; a exposição específica de cada
advisory precisa ser distinguida do resultado agregado do scanner.
Correção proposta: atualização controlada para versões corrigidas compatíveis,
com lockfile, testes, build, nova auditoria e homologação. Não executar
`npm audit fix --force` nem misturar atualização às mudanças operacionais.
Aceite: auditoria sem vulnerabilidades altas/críticas não justificadas e testes
de autenticação, Server Actions, imagens e checkout após a atualização.

## Prioridade 2 — confiabilidade e simplicidade

- **Fila prioritária:** `src/app/admin/page.tsx:30` considera pedidos pendentes
  ou erro de ERP, mas não destaca um pago sem ERP/expedição. A fila é calculada
  apenas sobre a página carregada. Separar “receber pagamento” de “atender venda
  paga”, com contagem global e prioridade operacional.
- **Feedback:** `AdminActionForm` trata retorno `void` como sucesso, some em 5s
  inclusive para erros e pode desmontar ao salvar item que sai do filtro atual.
  Padronizar retorno explícito, manter erros até resolução e feedback em host
  persistente do shell. Não foi testado salvar/excluir dados reais para prová-lo.
- **Overlays acessíveis:** o seletor de foco de `AdminDrawer` inclui inputs
  hidden e conteúdo recolhido; não filtra `:disabled` herdado de fieldset. O
  handler fecha com parâmetros capturados inicialmente. Não há isolamento do
  fundo/body scroll, e duas aberturas usam o mesmo ID de título. Usar um modal
  compartilhado com foco/estado de URL atuais e teste de teclado.
- **URLs copiáveis:** produtos/clientes/compatibilidade encontram `record`
  apenas nos itens da página atual. Abrir registro por loja independentemente
  de filtro/página, como já foi feito em pedidos.
- **Compatibilidade:** schema fixa máximo de 31 seleções enquanto há 34 modelos
  ativos no catálogo consultado. Contadores representam a página, não o total.
  Derivar limite do catálogo/autorização, explicar categorias x modelos e dar
  acesso direto a compatibilidade a partir de Produtos.
- **Busca administrativa:** produtos pesquisam só nome, embora SKU seja chave
  operacional relevante. A busca pública funciona nas amostras desktop/mobile,
  mas a descrição amplia resultados; priorizar nome/SKU em vez de apresentar
  produtos de outros modelos primeiro. Não confundir busca global com vínculo.
- **Responsividade:** em 390×844, após carregar a categoria Carregadores e Hubs,
  largura útil 382px e scrollWidth 557px; checkout 538px. Os glows de 500px
  posicionados fora do viewport explicam o excesso. Home não apresentou esse
  problema na amostra. Evidência: `CategoryClient.tsx:66` e `CartClient.tsx:1677`.
- **Newsletter e vídeo:** Footer confirma cadastro só com estado local, sem
  persistência. A tela de detalhe da home oferece vídeo com alert de simulação.
  Ocultar ações não implementadas ou conectá-las em entrega autorizada; nunca
  confirmar uma ação não realizada.
- **Resend:** o webhook registra a chave de deduplicação antes de atualizar a
  mensagem; a atualização ignora o erro retornado pelo banco. Retry passa como
  duplicado sem recuperar a atualização perdida. Usar estado processado/retry
  confiável e ordenação de eventos. Envio HTTP de e-mail também precisa timeout.
  Evidência: `src/app/api/webhooks/resend/route.ts:75` e
  `src/modules/email/email.repository.ts:236`.
- **Falhas de leitura:** repositories frequentemente retornam lista vazia na
  indisponibilidade. Diferenciar “nenhum registro” de “não conseguimos carregar”
  para não mascarar problemas de banco/integração.
- **SEO/condição:** JSON-LD anuncia `NewCondition` para todo o catálogo, inclusive
  nomes com seminovo. Derivar condição real ou omitir informação desconhecida;
  não prometer garantia/originalidade fixa sem validar por item.

## Revisão das 17 telas administrativas

Um único shell e componentes comuns continuam sendo o padrão. Não criar um
design individual por tela. Propostas abaixo reduzem conteúdo da superfície
principal; não foram implementadas nesta entrega.

| Tela | Ajuste principal proposto |
| --- | --- |
| Visão geral | Vendas pagas por atender e saúde real dos conectores primeiro |
| Pedidos | Preservar detalhe fiscal completo; destacar pagamento, ERP e envio |
| Produtos | Atalho de compatibilidade, SKU pesquisável, record independente e permissão de leitura |
| Clientes | Dados e histórico úteis no detalhe; ocultar escrita de viewer; record independente |
| Compatibilidade | Busca/filtros reais, contagens claras e seleção válida para todo o catálogo |
| Loja online | Separar menu público x categorias; hierarquia/reordenação e lista compacta pesquisável |
| Configurações | Estado derivado de dados: não dizer “Pendente/Planejado” para algo ativo |
| Preços | Regra única PF/PJ, exemplo e preço exibido coerente com checkout |
| Pagamentos | Saúde, ambiente e habilitação; parâmetros somente ao editar |
| Envios | Método/prioridade/estado em lista; detalhe ao editar; regra comercial explícita |
| Domínios | Estado/progresso/última verificação; DNS e histórico recolhidos |
| Documentos legais | Lista com estado de publicação; um editor aberto por vez |
| Integrações | Conexão x saúde x configuração, com uma ação principal |
| Bling | Falha de sincronização visível; diagnóstico/homologação/IDs/logs avançados |
| WhatsApp | Conexão e preferências separados; accepted não apresentado como entregue |
| Marketing | Um serviço por edição; IDs e estados técnicos recolhidos |
| Mercado Pago | Ambiente/saúde/reconciliação primeiro; runtime e IDs avançados |

## Supabase: segurança e desempenho

- RLS habilitada nas 43 tabelas consultadas. A função pública com
  `SECURITY DEFINER` observada não permite execução por anon/authenticated.
  Isso é uma evidência positiva, não substitui testes negativos multi-store.
- Advisor de segurança: proteção contra senhas vazadas desabilitada. Revisar
  o recurso com o administrador, conforme
  [orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Grants amplos de TRUNCATE/TRIGGER/REFERENCES para papéis públicos merecem
  revisão de menor privilégio. Não foi demonstrada exploração via PostgREST;
  não revogar permissões em produção sem validar a matriz de acesso.
- Advisor de desempenho: 25 FKs sem índice de cobertura, 43 achados de
  reavaliação de auth em RLS, 49 de políticas permissivas múltiplas e 30 índices
  sem uso observado. Esses achados não são 147 vulnerabilidades de segurança.
  Priorizar pedidos/itens, clientes, pagamentos e catálogo com medição; não
  remover índices só por estatística de “unused”. Referências:
  [FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
  [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan),
  [políticas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies),
  [índices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Condições para concluir a homologação

1. Confirmar ambiente de teste separado do banco/credenciais de produção e
   proteção de previews. Não visitar fluxo financeiro de preview presumindo
   que ele está isolado. Configuração de env por ambiente não foi comprovada.
2. Corrigir P1 em entregas pequenas, com teste de regressão de cada cenário.
3. Matriz owner/admin/operator/viewer, sem vínculo e segunda loja: páginas,
   dados privilegiados, ações e URLs diretas.
4. Venda convidado/PF/PJ, preço promocional, quantidades e concorrência, frete
   expirado/alterado, Pix/cartão recusado/pendente/aprovado, retries e eventos
   repetidos/fora de ordem; sem efeitos reais em produção.
5. Pedido pago → ERP → separação → rastreio, com conferência manual do responsável
   antes de faturar. Validar e-mail/WhatsApp até entrega, não só aceitação.
6. Todas as rotas em 1440×1000 e 390×844, busca, filtros, última página/vazia,
   record copiável, feedback, Tab/Shift+Tab/Esc, foco, labels e contraste.
7. Ampliar cobertura dos fluxos críticos e executar E2E em CI. Hoje há um único
   cenário E2E, executado para dois dispositivos, skip sem `E2E_BASE_URL`, e ele
   não está no workflow de qualidade.
8. Garantir que falha no quality gate bloqueia promoção para produção. Publicação
   `READY` da Vercel não comprova gate verde. Validar backup/restauração,
   observabilidade/alertas e rollback com os responsáveis; não foram testados.

## Próxima entrega recomendada

Primeiro conter o risco operacional: conferir a saúde/autorização Bling e o pedido
pago pendente com o lojista. Em paralelo ao preparo de homologação, tratar
dependências e guards de leitura. Em seguida corrigir estado de pagamento,
estoque/persistência e preço comercial, com testes isolados. Só então simplificar
as telas usando os mesmos componentes e publicar lotes validados.

Não marcar esta auditoria como “todos os fluxos aprovados” nem usar os dados reais
como base para testes destrutivos ou transações de homologação.
