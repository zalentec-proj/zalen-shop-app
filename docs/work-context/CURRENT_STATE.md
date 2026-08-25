# Estado atual — Zalen Shop

Este arquivo é o handoff versionado do projeto. Ele deve permitir que o trabalho
continue em outra máquina sem depender da memória de uma conversa. Não registrar
tokens, senhas, chaves, payloads sensíveis ou qualquer outro segredo aqui.

## Snapshot

- Atualizado em: 2026-08-25
- Branch: `refactor/migrate-to-next`
- Commit funcional base antes desta revisão: `a005471` —
  `fix: preserve payment transition after checkout`
- A publicação e a restauração seletiva de imagens/compatibilidades devem ser
  conferidas no bloco mais recente antes de iniciar uma nova frente.
  Preserve os scripts locais não rastreados que não pertencem a esta frente.
- Guia de continuidade para outra IDE/máquina: `docs/work-context/IDE_HANDOFF.md`.

## Contexto permanente

- A Zalen Shop é a plataforma; Brasil Drones é o primeiro caso de uso.
- O core deve permanecer multi-store, com dados de loja isolados por `store_id`.
- Login e admin pertencem à identidade Zalen Shop; o storefront pertence à loja ativa.
- `/platform` completo, billing, marketplace e automações de IA continuam fora do MVP.
- Integrações externas passam por services/connectors server-side e seguem a pesquisa oficial documentada.

## Estoque e composição do detalhe de produto (24/08/2026)

- Objetivo: confirmar se produtos sem dados físicos e estoque zero estavam
  chegando indevidamente ao carrinho e antecipar as ações de compra na página
  pública de produto.
- A auditoria somente-leitura de produção confirmou 419 produtos físicos ativos
  sem peso/dimensões, todos com estoque zero. Os 111 produtos ativos com estoque
  positivo possuem peso e as três dimensões completos; não existe atualmente
  produto comprável com dados físicos incompletos.
- O SKU `1395`, Bling `16690730980`, está ativo com saldo zero. A sincronização
  integral de estoque concluída em 24/08/2026 às 14:01 BRT consultou as 679
  variantes, retornou zero alteração e confirmou que o saldo local já coincidia
  com o Bling.
- O storefront deriva disponibilidade de `stock > 0`. Cards e detalhe bloqueiam
  as ações de compra quando o saldo é zero; o handler compartilhado também
  recusa adicionar produto indisponível. Portanto, o comportamento exibido para
  o SKU `1395` está correto.
- A descrição longa foi removida da coluna de preço/compra nos dois detalhes de
  produto. Em desktop, ela aparece abaixo da galeria à esquerda; em mobile, a
  ordem é galeria, informações/compra e descrição. Isso mantém os CTAs antes do
  conteúdo longo sem duplicar a descrição.
- Arquivos alterados: `src/components/product/ProductDetailsView.tsx` e
  `src/app/produto/[slug]/ProductDetailClient.tsx`.
- Validações: TypeScript, testes do parser de descrição, build de produção e
  inspeção visual local em 1440x1000 e 390x844 passaram. Nenhum pedido, sync ou
  dado de produção foi alterado pela validação.
- Próximo passo: publicar somente após autorização explícita e conferir um
  produto real com descrição longa no domínio comercial.

## Auditoria de dimensões Bling (em andamento seguro)

- Em 2026-08-21 foi executado o dry-run somente-leitura contra o aplicativo
  privado da Brasil Drones no Bling. Foram listados e lidos 534 produtos, sem
  erro de API e sem qualquer `POST`, `PUT`, `PATCH` ou `DELETE`.
- O contrato vigente do Bling foi confirmado pela referência oficial:
  `dimensoes.unidadeMedida` usa `0` para metros, `1` para centímetros e `2`
  para milímetros. O relatório local ignorado pelo Git está em
  `saida_bling/bling_dimensoes_dry_run.md`.
- Resultado: 98 produtos tinham medidas numéricas plausíveis (majoritariamente
  `12 x 7 x 16`) gravadas no Bling com unidade `metros`. A sincronização
  anterior as converteu para `1200 x 700 x 1600 cm` na Zalen, por isso a
  SuperFrete as rejeitava. A correção aplicada a cada um deles foi estritamente
  `unidadeMedida: 1`, mantendo largura, altura, profundidade e peso intactos.
- Há 432 produtos no Bling sem medidas físicas válidas. Eles permanecem
  bloqueados de cotação SuperFrete até receberem dados reais; nenhum valor deve
  ser inferido. Apenas 4 produtos atuais já estão seguros sem correção.
- A consulta somente-leitura ao catálogo Zalen confirmou 679 variantes
  históricas, 178 com peso e as três dimensões, 501 incompletas e 98 acima de
  500 cm. Logo, as medidas existiam no sync anterior, mas havia uma
  inconsistência de unidade e também variantes históricas que exigiam
  reconciliação após a correção no Bling. A reconciliação foi concluída em
  seguida: 86 variantes foram atualizadas, 12 já estavam corretas, não houve
  erros e nenhuma cotação de frete aberta precisou ser expirada.
- A verificação final do catálogo ativo retornou 534 produtos/variantes, 102
  com peso e dimensões completas e zero dimensão acima de 500 cm. As 432
  variantes restantes continuam sem dados físicos suficientes e não devem ser
  estimadas.
- Foram adicionados um auditor local, testes para a conversão de unidades e
  uma proteção de frete: dados físicos inválidos não caem silenciosamente no
  frete fixo. Validações desta frente: `npm test` (198 testes), `npm run lint`,
  `npm run build`, `node --check` dos scripts e `git diff --check`.
- A correção e sua reflexão no catálogo Zalen foram concluídas usando somente
  o aplicativo privado da Brasil Drones no Bling. Próximo passo operacional:
  testar uma cotação real no checkout com um dos SKUs corrigidos; depois,
  completar os dados físicos reais das 432 variantes ainda pendentes.

## Última mudança conhecida

- Em 2026-08-21 foi implementada a correção da política de frete da Brasil
  Drones. A gratuidade geral acima de R$ 500 foi removida da configuração
  versionada sem alterar o preço de contingência de R$ 49,90 nem o prazo do
  método `fixed-standard`. Uma trigger em schema privado expira imediatamente
  cotações abertas quando preço, gratuidade, prazo ou status de um método muda.

  A cotação da SuperFrete continua usando `price` como valor final cobrado,
  arredondado em centavos; `discount` e o preço informado pelo provedor ficam
  apenas no snapshot sanitizado de auditoria e não sofrem nova subtração. A
  gratuidade agora depende de todos os produtos físicos estarem elegíveis no
  ERP. Nesse caso, o checkout recebe `freeShippingReason: 'product'`, mostra
  “Frete grátis pelos produtos” e preserva o preço original da cotação como
  custo interno de referência. Carrinho misto e produto não elegível pagam a
  cotação final; a chave de cache continua separando mudanças de elegibilidade.

  O admin orienta deixar o limite por subtotal vazio quando a loja usa somente
  o ERP e não aceita mais zero como limite de gratuidade. A pesquisa SuperFrete,
  a documentação de frete e os critérios de aceite foram atualizados.

  Validações locais concluídas: TypeScript, 186 testes em 44 arquivos, testes
  dirigidos de frete/SuperFrete/Mercado Pago, build de produção, auditoria npm
  com zero vulnerabilidades e `git diff --check`. O build terminou com sucesso;
  houve apenas aviso `ENOSPC` ao gravar parte do cache local do webpack.

  A Supabase CLI foi autenticada novamente na organização correta e a migration
  `20260821165412_brasil_drones_erp_only_free_shipping.sql` foi aplicada em
  produção. Antes do push, cinco migrations de WhatsApp com o mesmo nome e SQL
  tinham somente timestamps locais/remotos diferentes; hashes do conteúdo
  compactado comprovaram equivalência e os arquivos locais foram renomeados
  para as versões remotas, sem reexecutar SQL antigo. A lista final de migrations
  ficou integralmente alinhada.

  A verificação de produção confirmou `free_over_subtotal=null`, preço R$ 49,90,
  prazo de 2 a 4 dias e zero cotação aberta do método antigo. A trigger está ativa
  em `private`, usa `security definer` com `search_path` vazio e não expõe função
  aos papéis de navegador. O SKU `1379` permanece ativo com
  `free_shipping=false`. Um sync incremental oficial do Bling foi disparado e
  terminou com sucesso: 40 produtos processados/atualizados e inventário sem
  divergência.

  Security Advisor não apontou alerta criado pela DDL; permanece o aviso global
  já existente de proteção contra senhas vazadas desativada. Performance Advisor
  continua listando avisos preexistentes de políticas RLS não inicializadas por
  `select` e políticas permissivas sobrepostas; nenhum deles foi introduzido
  pela trigger de frete. Próximo passo operacional: repetir no storefront uma
  cotação com o SKU `1379`, um carrinho misto e um carrinho integralmente elegível
  para confirmar os três textos/valores no ambiente público.

  A primeira verificação pública adicionou duas unidades do SKU `1379`, total de
  R$ 898,00, e confirmou no checkout “Frete: A calcular” e “Total parcial”, sem
  gratuidade automática pelo subtotal. A sessão de comprador disponível está
  com cadastro incompleto; o teste parou antes de transmitir ou sobrescrever
  dados pessoais. O carrinho dessa sessão permaneceu com as duas unidades para
  não apagar estado do usuário sem autorização.

- Em 2026-08-20 foi corrigida a entrada do checkout expresso com endereço
  salvo. A consulta automática de CEP repetia o endereço completo logo após a
  primeira cotação e limpava a modalidade recém-selecionada; como o CEP não
  mudava, a cotação não era refeita até o cliente clicar em “Recalcular”. O CEP
  de um endereço completo agora inicia como já resolvido, preservando o cálculo
  automático. Falhas inesperadas da Server Action de frete também encerram o
  estado de carregamento e permitem nova tentativa.

  O resumo não confunde mais frete desconhecido com frete grátis: antes de uma
  modalidade válida mostra “A calcular” ou “Calculando...” e “Total parcial”;
  “Grátis” aparece somente depois de uma opção de preço zero ter sido realmente
  retornada. O cálculo continua necessário mesmo para produto com gratuidade,
  pois valida cobertura, serviço e prazo de entrega.

  Após gerar Pix pendente, cliente autenticado agora segue para
  `/conta/pedidos/[id]?payment=pending`, onde encontra QR Code, copia-e-cola,
  botão de cópia, link oficial e vencimento devolvido pelo Mercado Pago. A tela
  atualiza o pedido automaticamente nos dois primeiros minutos e pode ser
  reaberta enquanto o pagamento estiver válido. Durante essa validade, a ação
  de gerar outra cobrança fica oculta; ela reaparece depois do vencimento ou
  quando não há instruções recuperáveis. Webhook assinado e
  reconciliação permanecem como fontes de confirmação. Checkout convidado
  mantém a Status Screen antes do acesso público temporário ao pedido.

  Validações locais concluídas: TypeScript, 183 testes unitários em 43 arquivos,
  build de produção, auditoria npm com zero vulnerabilidades, scanner de
  segredos, `git diff --check`, inspeção no navegador sem overlay/erros e dois
  E2E Playwright em Chromium desktop/Pixel 7. O navegador confirmou “A
  calcular” e ausência de “Grátis” antes da modalidade. A jornada autenticada
  real não foi executada localmente porque o dev server não possui as variáveis
  Supabase; a transição foi coberta por teste de contrato e TypeScript. Próximo
  passo operacional após a publicação: repetir uma compra Pix supervisionada
  com a conta recorrente da Brasil Drones, sem concluir uma cobrança não
  desejada.

  O commit funcional `9ed1b18` (`fix: stabilize shipping and pix checkout`) foi
  enviado ao branch `refactor/migrate-to-next` e publicado automaticamente pela
  integração Git/Vercel em 2026-08-20. O status Vercel associado ao commit foi
  `success`; `https://www.brasildroneseparts.com.br/` e `/carrinho` responderam
  HTTP 200, e `https://brasil-drones.zalenshop.com.br/carrinho` respondeu 308
  para o domínio principal. A verificação pós-deploy em navegador separado
  adicionou um produto real sem concluir pedido e confirmou “A calcular”,
  “Total parcial”, ausência de “Grátis” antes da cotação, ausência de overlay e
  zero erros de console. Os logs runtime da Vercel não puderam ser consultados
  pela CLI local porque a sessão retornou `Not authorized`; não relincar o
  projeto para contornar isso.

- Em 2026-08-20 foi implementada a revisão completa da experiência observada
  no vídeo do cliente. “Adicionar ao carrinho” agora abre um drawer global em
  home, categorias, modelos e produto; “Comprar agora” adiciona o item e segue
  diretamente para `/carrinho`. O drawer mostra frete como calculado no
  checkout, permite continuar comprando, bloqueia o scroll de fundo, prende e
  restaura o foco e funciona sem overflow horizontal em viewport móvel.

  O visitante começa o checkout diretamente em quatro etapas: Dados, Entrega,
  Envio e Pagamento. Conta, senha e OTP deixaram de ser barreira anterior ao
  pagamento. Entrar continua opcional para preencher dados salvos, e clientes
  autenticados completos preservam o checkout expresso existente.

  No servidor, checkout convidado não cria nem altera `customers` ou endereços:
  os dados ficam no snapshot imutável do pedido. Depois da criação, um cookie
  HttpOnly `SameSite=Lax`, sem PII e limitado a cinco pedidos por 24 horas,
  guarda uma capacidade aleatória. Pagamento, polling de Pix e `/pedido/[id]`
  só são liberados quando loja, pedido, chave e tentativa idempotente concluída
  correspondem no banco. Validar posteriormente o mesmo e-mail pelo Supabase
  Auth associa à conta apenas pedidos convidados sem `customer_id` da mesma
  loja. O ID do pedido isolado não concede leitura.

  Os retornos do Mercado Pago preservam o acompanhamento convidado, enquanto
  e-mails de pedido direcionam à ativação autenticada. O script de marketing
  foi ajustado para `afterInteractive`, eliminando o aviso de script em
  navegação cliente sem carregar o GTM antes do consentimento padrão.

  Validações concluídas: TypeScript, 180 testes unitários em 43 arquivos, build
  de produção, auditoria npm com zero vulnerabilidades, scanner de segredos,
  `git diff --check`, dois E2E Playwright em Chromium desktop/Pixel 7 e
  verificação independente no navegador. A jornada adicionar → drawer →
  checkout e Comprar agora → checkout passou; Axe encontrou zero violações
  WCAG A/AA no checkout e no drawer. Link de pedido sem capacidade exibiu
  recuperação genérica sem revelar o pedido. Nenhuma conta pessoal, pedido real
  ou cobrança foi usado nessa validação local.

- Em 2026-08-20 foi implementado o checkout expresso para clientes
  recorrentes. Depois que uma conta existente é validada, clientes com dados
  cadastrais e endereço completos seguem diretamente para a revisão e o
  pagamento. A tela final mostra o endereço salvo e a modalidade de envio,
  ambos com ação `Alterar`; as etapas completas continuam disponíveis quando
  faltam dados ou quando o comprador deseja fazer uma mudança. Clientes novos
  permanecem no fluxo integral de identificação, cadastro e entrega.

  As cotações de frete passam a ser solicitadas imediatamente para o cliente
  recorrente assim que carrinho e endereço ficam disponíveis. O pagamento fica
  bloqueado enquanto o frete está sendo calculado ou quando nenhuma cotação
  válida foi selecionada, evitando iniciar uma cobrança com frete ausente ou
  divergente. Após validar o OTP, os endereços da conta são carregados no
  servidor e devolvidos somente para a sessão autenticada da mesma loja.
  Nenhuma migration ou alteração de integração externa foi necessária.

  Validações locais concluídas: TypeScript, 174 testes em 40 arquivos, build
  de produção, scanner de segredos e `git diff --check`. A automação visual no
  navegador local não ficou disponível nesta sessão. O commit `c3024e4`
  (`feat: streamline checkout for returning customers`) foi enviado ao branch
  padrão; o deployment de produção `dpl_5st9qSdrAZvKujNbJ7qULAJbMkkQ` chegou a
  `READY`, recebeu os domínios públicos da Brasil Drones, respondeu HTTP 200 em
  `/carrinho` e não apresentou erros de runtime após a publicação. O próximo
  passo é repetir uma compra supervisionada, primeiro com uma conta recorrente
  e depois com uma conta nova.

- Em 2026-08-20, a primeira tentativa de pagamento após a homologação do OTP
  foi bloqueada antes de criar pedido ou chamar o Mercado Pago. A auditoria da
  tentativa registrou `shipping_quote_stale`; a cotação ainda estava dentro dos
  30 minutos de validade e preservava frete grátis. A causa foi a segunda
  consulta à SuperFrete: quando a modalidade escolhida não era reencontrada, a
  revalidação podia cair para o método fixo da loja e apresentar o conflito
  como uma falha genérica de pagamento.

  A correção mantém a validação server-side, mas não troca silenciosamente o
  provedor escolhido. Falhas ou mudanças da modalidade agora retornam uma ação
  segura de recuperação: a tentativa idempotente é descartada no navegador, o
  cache antigo é ignorado, as opções são cotadas novamente e o cliente volta à
  etapa de envio para confirmar a nova seleção. Nenhum pedido, preferência ou
  cobrança é criado nesse caminho. A telemetria passa a usar o código seguro da
  causa conhecida em vez de agrupar tudo como `checkout_start_failed`.

  Validações locais concluídas: 171 testes em 39 arquivos, TypeScript, build de
  produção e `git diff --check`. O próximo passo é publicar a correção e repetir
  a compra supervisionada com uma cotação nova.

- Em 2026-08-19 foi implementada localmente a integração transacional de
  WhatsApp por loja com Evolution API. Ela usa o provider global
  `evolution_whatsapp`, uma integração de produção por `store_id`, QR Code
  efêmero no Admin e uma fila idempotente para notificações de pedido,
  pagamento e envio. A URL e a chave global nunca entram no frontend, no banco
  ou no Git; o segredo de webhook é exclusivo por loja e criptografado no cofre
  já existente. O cliente só recebe mensagens depois de confirmar o telefone
  em "Minha conta" e optar pelas mensagens transacionais. O e-mail continua
  obrigatório no primeiro vínculo; para contas já autenticadas e com opt-in,
  o mesmo OTP também é enviado imediatamente pelo WhatsApp.

  A VPS central foi inspecionada sem expor segredos: Evolution API `2.3.7`,
  imagem `evoapicloud/evolution-api:latest`, volume persistente em
  `/evolution/instances` e instância existente `brasil_drones`. Em 2026-08-19
  ela foi vinculada pelo Admin à loja Brasil Drones sem recriação, conferida
  como `connected` e teve o webhook configurado. A pesquisa técnica está em
  `docs/integrations/evolution-whatsapp-research.md`.

  A migration `20260819210003_whatsapp_evolution_integration.sql` foi aplicada
  ao projeto Supabase de produção `xtwobxfepsdfjrtducqb`. Ela cria
  preferências/validação de contato, fila, auditoria de webhook, provider, RLS
  de service role e cron de entregas a cada cinco minutos; o provider e as
  quatro tabelas com RLS foram conferidos após a aplicação. O advisor de
  segurança não apontou regressão nesta frente; permanece apenas o aviso
  preexistente de proteção contra senhas vazadas desativada no Supabase Auth.

  `EVOLUTION_API_BASE_URL` e `EVOLUTION_API_GLOBAL_API_KEY` foram salvas como
  segredos criptografados na Vercel; a chave global também ficou disponível em
  Preview e deve ser restrita a Production antes da liberação final. Nunca
  registrar os valores dessas variáveis neste arquivo. O commit `1c5c2db`
  (`feat: add per-store WhatsApp integration`) foi enviado ao branch padrão
  `refactor/migrate-to-next`; ele inclui a correção de categoria `communication`
  e o link direto do card para a integração. As notificações foram ativadas
  para `access_code`, `order_received`, `payment_approved` e os dois alertas
  operacionais; o telefone de alerta ainda não foi definido. Validações locais
  concluídas: `npm run lint` e `npm test` (143 testes). O build compilou e
  passou no TypeScript, mas a execução nesta sessão não retornou após a etapa
  de coleta de dados; repetir `npm run build` antes de outro deploy manual.

- Ainda em 2026-08-19, o primeiro teste de confirmação de telefone falhou
  antes de enfileirar a mensagem. A causa foi a expressão regular E.164 da
  migration inicial, que escapava o `+` duas vezes e rejeitava números válidos.
  A migration `20260819223000_fix_whatsapp_phone_e164_validation.sql` foi
  aplicada no Supabase de produção e validada com um formato `+55…`. O campo de
  telefone da conta agora remove caracteres não numéricos, aceita colagem com
  ou sem código do país e exibe `(DD) 9XXXX-XXXX`. Commit `bdf5c41` enviado ao
  branch padrão; o deployment de produção correspondente ficou `READY`.

- A mesma máscara reutilizável foi aplicada ao telefone operacional da
  integração WhatsApp. O admin e "Minha conta" aceitam dígitos ou colagem em
  E.164, exibem o número nacional formatado e mantêm a normalização E.164 no
  servidor. Teste unitário em `src/lib/phone/brazilian-phone.test.ts`; commit
  `cedeb6f` enviado ao branch padrão (deployment em andamento no momento do
  handoff).

- No teste do checkout em 2026-08-19, o WhatsApp recebeu com atraso um código
  de confirmação de telefone, que pertence a outro desafio e, portanto, não
  pode validar o OTP de login emitido pelo Supabase. O serviço de login foi
  ajustado para usar a preferência de WhatsApp já verificada e com opt-in como
  critério de elegibilidade, sem exigir novamente que o vínculo `authUserId`
  esteja preenchido no mesmo registro de cliente. Assim, quando elegível, o
  mesmo OTP recém-emitido segue para e-mail e WhatsApp. As telas de conta e
  checkout agora confirmam explicitamente se o segundo canal foi enfileirado;
  mensagens genéricas de busca de conta não revelam a existência do cadastro.
  Não reutilizar códigos anteriores: sempre solicitar um novo código após o
  deploy desta correção.

- Ainda em 2026-08-19 foi corrigido um retry indevido da fila WhatsApp. Após a
  Evolution aceitar uma mensagem, o worker voltava a selecionar a linha com
  status `accepted` a cada cron de cinco minutos e reenviava o mesmo conteúdo.
  `accepted` agora é terminal para o envio; somente `queued` pode entrar no
  worker de retry, enquanto um webhook futuro pode promover o estado para
  `delivered` sem reenviar a mensagem. A entrega que já havia sido aceita na
  Brasil Drones foi marcada como `delivered` e a migration
  `20260819234000_stop_accepted_whatsapp_delivery_retries.sql` foi aplicada e
  verificada em produção: não restaram linhas aceitas/na fila e o índice de
  busca passou a cobrir somente `queued`.

- A etapa de validação de conta no checkout explica que o WhatsApp confirmado
  recebe o mesmo código do e-mail. Depois de solicitar o código, a confirmação
  é precisa: informa e-mail e WhatsApp quando a entrega complementar foi
  enfileirada, ou somente e-mail quando não há preferência elegível.

- Em 2026-08-19, um novo teste deslogado com uma conta já configurada não criou
  entrega WhatsApp. A auditoria de produção confirmou um único cliente para a
  conta, vínculo com Auth, telefone confirmado e opt-in transacional ativo; também
  confirmou integração conectada, notificações globais ativas e worker com
  respostas HTTP 200. A causa foi exclusivamente operacional: o array
  `enabledEvents` havia sido salvo sem `access_code`, mantendo apenas
  `order_received` e `operator_payment_approved`. O evento `access_code` foi
  reativado diretamente na configuração da integração Brasil Drones, sem
  alterar os demais eventos e sem disparar um OTP durante a correção. O próximo
  teste deve solicitar um código novo; a evidência esperada é uma única linha
  `customer_login` na fila, seguida de `accepted`/`delivered`, sempre com o
  mesmo OTP enviado pelo e-mail.

- A revisão final de QA do WhatsApp em 2026-08-19 encontrou e corrigiu riscos
  que ainda impediam considerar a entrega pronta: workers concorrentes podiam
  reivindicar a mesma linha; códigos permaneciam legíveis na fila; eventos
  reais `messages.update` da Evolution 2.3.7 não eram reconhecidos; números
  nacionais com DDD 55 podiam ser confundidos com código do país; o admin
  podia apagar o telefone operacional ao salvar outro campo; e telas exibiam
  estado antigo após Server Actions. A UI do checkout agora mostra os canais
  efetivamente usados, bloqueia reenvio por 60 segundos e deixa claro que o
  mesmo OTP vale no e-mail e no WhatsApp. Em "Minha conta", a pessoa vê o
  número confirmado, pode trocar o número e pode ativar ou desativar o opt-in
  sem repetir a confirmação.

  As migrations `20260819235900_harden_whatsapp_delivery_queue.sql` e
  `20260820001000_add_whatsapp_foreign_key_indexes.sql` foram aplicadas ao
  Supabase de produção. A auditoria posterior confirmou zero linha em fila ou
  processamento, zero mensagem terminal não redigida, políticas das quatro
  tabelas restritas explicitamente a `service_role`, colunas de expiração e
  trava presentes e todos os índices desta frente criados. O advisor não
  apontou problema de performance nessas tabelas; na segurança permaneceu
  somente o aviso preexistente de proteção contra senhas vazadas desativada.
  Validações locais: 158 testes em 38 arquivos, TypeScript, build de produção,
  scanner de segredos e `git diff --check` aprovados. O commit `9df60c5`
  (`fix: harden WhatsApp delivery experience`) foi publicado e o deployment de
  produção `dpl_4qKgieMSWzRj3qzUTndjnTpvy7Xi` chegou a `READY`. A inspeção
  autenticada de `/conta` confirmou número atual, consentimento marcado e as
  ações de salvar preferência e trocar número; a Vercel não registrou erro de
  runtime no deployment. O próximo passo exato é repetir uma jornada
  supervisionada com um OTP novo e confirmar o mesmo código uma única vez.

- Em 2026-08-19, os cards de produto passaram a apresentar uma etiqueta
  prioritária e visível de `Sem estoque` no canto superior da imagem, tanto em
  desktop quanto em mobile. A etiqueta substitui o aviso discreto anterior no
  rodapé da imagem; o botão de adicionar ao carrinho continua bloqueado para
  esses itens. A alteração é exclusivamente visual, centralizada em
  `ProductCard`, portanto cobre vitrines, busca e categorias sem alterar
  estoque, catálogo ou Bling. TypeScript e 140 testes foram aprovados; o build
  de produção compilou e concluiu a checagem de tipos.

- Em 2026-08-19 foi restaurada a navegação com submenus e preview visual no
  desktop, sem reintroduzir o mega-menu vazio. `Categorias` conserva seu
  dropdown compacto por clique; cada item editorial que possui filhos também
  volta a exibir seta e, no hover/foco, apresenta seus links e preview de
  produto. As categorias filhas do Bling permanecem visíveis no submenu mesmo
  se ainda estiverem sem produtos, permitindo que `Novos` e `Semi novos`
  apareçam sob `Drones`. A alteração é somente de interface e não modifica
  dados do catálogo ou do Bling. Validações locais: TypeScript, 140 testes,
  build de produção e `git diff --check` aprovados.

- Em 2026-08-19 foi corrigida a seleção da vitrine "Drones" da home. Quando
  uma seção possui categoria sincronizada, a vitrine agora usa exclusivamente
  seus vínculos de categoria e descendentes, sem complementar por palavras do
  título/descrição. Isso impedia que hélices, placas e outras peças cujo nome
  contém "drone" aparecessem como se fossem aeronaves. A categoria Bling
  `Semi novos` já possui o produto SKU `1251` vinculado; `Novos` está criada
  como filha de `Drones`, mas ainda não possui produto vinculado no Bling.
  A navegação editorial `Drones` também foi ajustada no banco da loja para
  expandir os filhos vindos do Bling, exibindo `Novos` e `Semi novos` no menu.
  Nenhum produto, preço, estoque, pedido ou categoria no Bling foi alterado.
  Validações locais: TypeScript, 140 testes, build de produção e
  `git diff --check` aprovados. A mudança de código ainda precisa de commit e
  publicação para alcançar o storefront; a alteração de navegação já está
  persistida para a loja Brasil Drones.

- Em 2026-08-19 foi simplificado o menu desktop de categorias do storefront.
  O item `Categorias` agora abre apenas por clique um dropdown compacto,
  acessível por teclado e fechado por clique externo ou `Esc`. O antigo
  mega-menu por hover, com preview de produto e coluna vazia quando a página
  não possuía produtos, foi removido. O dropdown parte somente dos itens
  editoriais da navegação, mantém filhos úteis em uma expansão curta e oculta
  ramos sem produtos. As categorias e vínculos no Bling não foram modificados
  por essa alteração de interface. TypeScript e 140 testes passaram; o build
  de produção compilou, concluiu a checagem de tipos e gerou as 21 páginas.

  Foi iniciada pelo Admin a sincronização incremental do catálogo para trazer
  uma mudança feita no Bling no produto SKU `1251` (Drone DJI Avata 2 seminovo).
  Antes do job, as categorias Bling `Novos` e `Semi novos` já existiam como
  filhas de `Drones`, mas ainda não tinham produtos vinculados no espelho. O
  job deve ser conferido até o estado final `success` antes de validar a página
  pública de `Semi novos`; não iniciar outro sync concorrente.

- Em 2026-08-19 foi removida a nuvem de tags técnicas da página pública de
  categoria. A rota não repassa mais toda a árvore de categorias sincronizada
  do Bling para renderização como chips; preserva título, contagem de produtos,
  ordenação e grade. A navegação superior e os filtros próprios continuam
  disponíveis em seus respectivos contextos. A correção não altera categorias,
  produtos, preços, estoque, pedidos ou qualquer dado no Bling. Validações
  locais: TypeScript, 140 testes, build de produção e `git diff --check`
  aprovados.

- Em 2026-08-18 foi reforçada a apresentação de descrição e imagem do
  catálogo. A normalização de conteúdo do Bling agora é compartilhada pelo
  conector e pela leitura do catálogo, de modo que registros antigos com HTML
  ou Markdown não exibam tags, ícones ou marcação literal no storefront. A
  página de produto converte esse conteúdo em títulos, parágrafos e listas
  renderizados exclusivamente como nós de texto React — nunca injeta HTML do
  ERP. Produtos sem uma imagem permanente renderizável, inclusive no Admin,
  usam agora um fallback local com fundo preto e a logo Brasil Drones, em vez
  da imagem genérica. Nenhum produto, preço, estoque, pedido ou dado no Bling
  foi alterado por esta correção. Validações locais: TypeScript, 140 testes,
  build de produção e `git diff --check` aprovados. A mudança foi publicada em
  2026-08-19 no commit `d129bbd` (`fix: render Bling catalog content safely`)
  no branch `refactor/migrate-to-next`.

- Em 2026-08-18 foi corrigida a persistência de mídia e descrições retornadas
  pelo Bling. A sincronização agora coleta todas as fotos do produto e de suas
  variações, copia URLs internas assinadas de `orgbling.s3.amazonaws.com` para
  o bucket permanente `product-images` e vincula a galeria completa ao produto.
  O download é estritamente server-side, valida hostname HTTPS, tipo, limite de
  10 MiB, timeout de 15 segundos e não segue redirecionamentos. Os caminhos no
  Storage são determinísticos por loja/produto/origem, permitindo reexecução
  idempotente sem expor a assinatura temporária. Galerias permanentes auditadas
  são preservadas e referências temporárias só são removidas depois de existir
  imagem durável.

  `descricaoCurta` agora é convertida de HTML do Bling para texto simples
  legível antes da persistência; blocos ativos como `script` e `style` são
  descartados e quebras CRLF são normalizadas. Os commits `dabe92b` e `711e5d2`
  foram publicados; o deployment produtivo final da implementação
  `dpl_79QwL3XpJvjfFjRFES4VcfZJTNKL` ficou `READY`. O produto Bling
  `16689921780` foi reprocessado com sucesso: passou de uma URL temporária para
  cinco imagens permanentes nas posições 0–4, ficou sem referência a
  `orgbling.s3.amazonaws.com`, tags HTML ou caracteres CR na descrição. A
  página pública carregou as cinco imagens reais do Storage, com dimensões
  naturais válidas e sem exibir HTML literal. A implementação local passou em
  TypeScript, 137 testes e build de produção.

- Em 2026-08-18 foi implementada a reconciliação automática de ausências do
  catálogo Bling. O job diário consulta todas as páginas de `GET /produtos` e
  só então inativa registros locais `active` cujo `external_id` não apareceu no
  snapshot. Falha de rede, resposta sem lista, ID inválido, duplicidade ou
  repetição de página encerra o job sem alterar produto algum. Produtos
  atualizados após o início da leitura também são preservados para não competir
  com o sync incremental/webhook. A auditoria fica em `sync_jobs` com
  `job_type = product_reconciliation` e em
  `store_integrations.settings_json.productReconciliation`.

  A rota interna protegida é
  `/api/jobs/bling/products/reconcile`; a migration
  `20260818193356_bling_product_reconciliation_schedule.sql` a agenda para
  06:15 UTC (03:15 BRT). Os testes locais cobrem snapshot paginado, página
  repetida e falha parcial sem inativação. TypeScript, 132 testes, build,
  scanner de segredos, `git diff --check` e auditoria npm sem vulnerabilidades
  altas/críticas passaram. O commit `ae28884` foi publicado e o deployment de
  produção `dpl_G67m9vZFmYBN6UAGBv4JG1r6yyBo` ficou `READY`; a rota respondeu
  corretamente `401` sem o segredo interno. A migration foi aplicada ao
  Supabase de produção e `zalen-bling-product-reconciliation` está agendado
  para `15 6 * * *` (06:15 UTC / 03:15 BRT). O histórico de migrations local e
  remoto está alinhado. Os Advisors não apontaram regressão: permanecem o aviso
  global conhecido de proteção contra senhas vazadas e avisos de performance
  preexistentes sobre FKs/políticas.

  Antes dessa migration, os três timestamps divergentes do histórico local de
  migrations foram comparados ao schema remoto e alinhados aos registros já
  aplicados (`20260721104839`, `20260724173855` e `20260813114549`), sem rodar
  SQL ou alterar dados. `supabase migration list --linked` ficou sem
  divergências.

- Em 2026-08-18 foi reparado o vínculo das imagens do lote legado da Brasil
  Drones. O Bling devolvia as mídias internas como URLs S3 assinadas e
  temporárias; elas expiraram e fizeram Admin e storefront exibirem o fallback.
  O artefato auditado de julho ainda continha 91 imagens públicas permanentes
  para 72 produtos identificados pelos IDs reais do Bling. A restauração foi
  executada em uma única transação e alterou somente `product_images`, sem tocar
  em produtos, variantes, preços, estoque, pedidos ou categorias.

  A quantidade de produtos com imagem permanente passou de 597 para 645 e as
  referências temporárias restantes caíram de 53 para 5. Os cinco produtos
  restantes não pertencem ao conjunto aprovado; outros 29 não possuem linha de
  imagem. O código do repositório agora descarta URL não renderizável antes de
  montar a galeria. A validação no domínio público encontrou 64 imagens do
  Storage entre 75 imagens renderizadas, quatro fallbacks legítimos e zero
  imagem quebrada. No Admin, os produtos citados na falha — FPV Controller 3,
  DJI Neo 2, HUB Flip, HUB Mini 5 Pro e controle Mavic — carregaram as imagens
  reais, também sem erro no console. O reparo reproduzível está em
  `scripts/catalog/restore-brasil-drones-legacy-images.mjs`.

- Em 2026-08-18 o catálogo de produtos do Admin passou a ter paginação real.
  A tela renderiza 50 produtos por página por padrão, permite alternar para
  100 e calcula 14 ou 7 páginas, respectivamente, para os 679 produtos atuais.
  Os controles anterior/próxima agora são funcionais, o intervalo exibido é
  informado no rodapé e qualquer alteração em busca, categoria, origem, status
  ou tamanho da página retorna à primeira página. A implementação passou em
  TypeScript, 126 testes em 30 arquivos, build de produção e
  `git diff --check`.

- Em 2026-08-18 foi concluído o reparo das imagens temporárias do catálogo
  legado. A API do Bling devolvia mídia interna como URLs S3 assinadas com
  `AWSAccessKeyId`, `Expires` e `Signature`; a sincronização antiga persistiu
  esses endereços como se fossem permanentes. Havia 78 produtos nesse estado,
  76 URLs já expiradas, 39 produtos ativos e 36 ativos com estoque.

  O commit `6399b7b` centralizou a detecção dessas URLs e passou a descartá-las
  tanto no adapter server-side quanto no componente visual antes da primeira
  renderização. O deployment produtivo
  `dpl_4qUsSHMWrkpWjSCVe7UtM9GDCW9i` ficou `READY`. A auditoria encontrou 25
  correspondências únicas por nome normalizado com produtos do catálogo
  permanente e zero correspondências ambíguas. Uma transação atômica removeu
  25 linhas temporárias e copiou 63 imagens permanentes do Storage para esses
  25 produtos, sem alterar produtos, variantes, estoque, preços ou pedidos.

  Restaram 53 produtos legados com a referência temporária preservada apenas
  para auditoria; 24 estão ativos e com estoque. No storefront, eles recebem o
  fallback local antes de qualquer requisição ao S3. A verificação final
  confirmou 679 produtos, 679 variantes, 594 ativos, 597 produtos com imagens
  permanentes e 1.488 linhas permanentes. O navegador confirmou zero imagens
  quebradas, zero URL temporária no DOM, fallback local carregado e nenhuma
  mensagem de erro no console.

- Em 2026-08-18 o aviso público de desconto PJ recebeu espaçamento responsivo
  compatível com as duas linhas do cabeçalho desktop. Em telas `xl`, a faixa
  agora começa abaixo do menu fixo de categorias; em tablet/mobile preserva o
  deslocamento menor do cabeçalho de uma linha.

- Em 2026-08-18 foi corrigido o contraste dos seletores nativos de categoria e
  ordenação nas páginas públicas de modelos e categorias. Os controles agora
  declaram esquema de cores escuro e opções com fundo escuro/texto branco,
  evitando texto branco sobre o menu nativo claro observado no macOS. A
  alteração passou em TypeScript, 123 testes e build de produção.

- Em 2026-08-18 foi corrigida a causa de o Admin exibir apenas seis produtos:
  as consultas de variantes, imagens e categorias enviavam os 679 UUIDs em um
  único `.in()`, excediam o limite da URL do PostgREST e acionavam silenciosamente
  o catálogo de demonstração. As relações agora são consultadas em lotes de 100,
  e produção nunca mais substitui uma falha real por dados mockados; o painel
  mostra indisponibilidade explícita.

  O sync Bling deixou de apagar galerias auditadas e passou a rejeitar URLs
  assinadas/temporárias de `orgbling.s3.amazonaws.com`. O script seletivo
  `scripts/catalog/restore-brasil-drones-storefront-assets.mjs` foi criado com
  dry-run e trava de autorização. O plano auditado contém 599 produtos, 1.425
  imagens permanentes no Storage e 818 vínculos de compatibilidade, sem tocar
  em produtos, variantes, preços, estoque, pedidos ou categorias. Executar a
  restauração real somente depois que o commit protetor estiver em produção.
  O commit foi publicado no deployment produtivo
  `dpl_397ofhJpmmBBB8iqPuzdsWTWiAFK`, que ficou `READY`, e então a restauração
  foi executada em 12 transações idempotentes. A verificação final confirmou
  599 produtos, 1.425 imagens, 572 produtos com galeria, 818 vínculos e zero
  URL não permanente nesse conjunto. Os 80 produtos anteriores ao novo
  catálogo foram preservados; 40 continuam ativos e 37 deles possuem estoque
  positivo. Eles não pertencem ao artefato auditado e, por isso, não tiveram
  suas imagens substituídas automaticamente.

  O storefront agora ordena itens disponíveis antes dos esgotados, bloqueia
  compra sem estoque e troca imagens inválidas por fallback local. O menu móvel
  é opaco, fixo, rolável e bloqueia o scroll do fundo; os filtros mostram 12
  categorias inicialmente e oferecem busca/expansão; as empresas do Grupo GG
  usam carrossel horizontal compacto no mobile. Admin e configuração Bling
  foram simplificados com seções recolhíveis e sem rótulos técnicos de
  Supabase/Mock para o lojista.

  Validações concluídas: TypeScript, 123 testes em 29 arquivos, build de
  produção, scanner de segredos, `git diff --check` e teste responsivo local.
  O teste visual confirmou página com conteúdo, sem overlay/erro de console,
  nenhuma imagem quebrada após fallback, menu móvel opaco e filtro limitado.
  No domínio comercial, o Admin autenticado passou a carregar 679 produtos
  reais (594 ativos), sem fallback de demonstração. A integração Bling de
  produção permanece `connected`, com envio automático ligado; catálogo e
  estoque registraram `success` em 18/08/2026 às 11:00 e 11:01 BRT.

- Em 2026-08-17 foi recuperada e concluída a sincronização incremental do
  catálogo Bling da Brasil Drones. A investigação nos erros de runtime da
  Vercel mostrou que um delta grande de produtos excedia o limite de 300 s e
  deixava jobs em estado `running`. O client Bling agora tem limite de resposta
  de 20 s, a sincronização pagina o delta, persiste um cursor de retomada e
  atualiza categorias somente na primeira página. As gravações de produtos já
  resolvidos usam concorrência limitada de três, preservando o ritmo de leitura
  da API Bling. Os commits publicados foram `c3e9165`, `6cbdafc`, `e4eb56b` e
  `ca16715`; o deployment produtivo final `dpl_AwGXDeMmgjLisv6KxYdsPsNT1zKd`
  ficou `READY`.

  A execução manual percorreu 14 páginas, atualizou 555 registros e terminou
  às `2026-08-17T17:34:14Z`; o último lote atualizou 36 produtos sem erro e o
  estado da integração ficou `success`. Uma página intermediária registrou uma
  falha transitória entre 40 itens (39 atualizados); o diagnóstico mantido no
  resumo do job foi deslocado pelos itens posteriores e não conservou o ID
  daquele item. Os 679 produtos e 679 variantes ligados ao Bling continuam
  presentes no catálogo. A sincronização de estoque executada em seguida
  processou as 679 variantes às `2026-08-17T17:36:26Z`, com zero alterações e
  zero erros. A Vercel não registrou erro de runtime no endpoint de catálogo
  nos 30 minutos posteriores à correção.

  Próxima melhoria operacional recomendada: preservar diagnósticos de erro
  independentemente do limite de itens recentes e não avançar `last_sync_at`
  quando qualquer página incremental tiver erro. Isso permitirá reprocessar
  precisamente um item transitório sem repetir o catálogo inteiro.

- Em 2026-08-13 foi concluída a carga auditada de imagens do MundoDrone para o
  novo catálogo da Brasil Drones. Dos 599 produtos, 581 tiveram página/galeria
  compatível; 572 passaram pela auditoria visual e receberam 1.425 imagens
  únicas no bucket público `product-images`, sob o prefixo exclusivo
  `bling/brasil-drones/catalogo-2026-08/`. O app privado da Brasil Drones enviou
  somente `midia.imagens.imagensURL` ao Bling. A API aceitou os 572 produtos e
  terminou sem erro pendente; amostras de duas e sete imagens foram confirmadas
  diretamente no painel, preservando a primeira imagem como principal. O campo
  `imagensURL` é `writeOnly` no OpenAPI, por isso o `GET` de produto não serve
  para conferir as URLs enviadas. Dezoito produtos sem correspondência segura e
  nove com imagem principal inválida permaneceram sem imagem. A função
  temporária usada apenas na cópia ao Storage foi neutralizada com resposta 410
  e exigência de JWT; nenhum segredo foi versionado.

- Em 2026-08-12 foi preparado o novo catálogo da Brasil Drones a partir de
  `Catalogo_Bling_por_Modelo_Editavel (1) (4) (1).xlsx`. As abas por modelo são
  a fonte de quantidade e categoria: 600 linhas de origem resultam em 599
  produtos físicos, porque os códigos `12918` e `3345436` descrevem o mesmo
  DJI RC 2 e foram mesclados. A colisão real do código `593` foi resolvida:
  o cabo Mavic 3 preserva `593` e o braço dianteiro esquerdo Mini 3 usa
  `593-MINI3-DE`. A carga deve preservar o estoque das abas por modelo: 504
  unidades, distribuídas em 111 produtos positivos; os demais ficam em zero.
  O pipeline usa exclusivamente credenciais `BLING_CUSTOMER_*` do app privado
  da Brasil Drones, recusa o token global da Zalen, valida o OpenAPI oficial
  vigente, verifica código antes de criar e não envia GTIN, imagens ou custo.
  As categorias ausentes `Mini SE`, `Mavic 2` e `Mavic Platinum` serão criadas
  na mesma autorização antes dos produtos. A execução real foi concluída pelo
  app privado `Brasil Drones Parts GPT`: 599 produtos criados, zero produtos
  existentes, zero erros de produto e zero conflitos de código. O depósito
  `Geral` foi selecionado por ser o único ativo que considera saldo. Foram
  criados 111 balanços positivos e os outros 488 produtos permaneceram em
  zero, totalizando 504 unidades. A conferência posterior via API não encontrou
  divergência de saldo nem erro de estoque. O produto Mini 3 corrigido foi
  criado com o código `593-MINI3-DE`; o código `593` permaneceu no cabo Mavic 3.
  As credenciais privadas ficam somente no `.env.local`, com permissão `0600`,
  e não foram registradas neste handoff ou nos logs versionados.

- Em 2026-08-12 foi corrigido o roteamento do admin no host central. Uma sessão
  autenticada que acessava `app.zalenshop.com.br/admin` não era redirecionada ao
  subdomínio da loja e, por isso, a resolução de storefront a tratava como host
  reservado e exibia “Loja não encontrada”. A proxy agora encaminha o admin do
  host central para `brasil-drones.zalenshop.com.br/admin`, preservando path e
  query. A resolução de domínios próprios permanece encaminhada pelo resolver
  server-side. Os testes de host/store passaram; o typecheck completo estava
  bloqueado por erros pré-existentes em um arquivo não rastreado da frente de
  catálogo, fora desta correção.

- Em 2026-07-24 foi identificada a origem do uso elevado de Fluid Active CPU:
  três jobs internos chamavam funções da Vercel a cada 10 minutos mesmo sem
  venda, pagamento pendente ou webhook. Eram 432 invocações HTTP por dia em
  estado ocioso. A migration
  `20260724200310_optimize_internal_job_schedules.sql` torna o worker Bling e a
  reconciliação Mercado Pago condicionais à existência de trabalho e reduz a
  sincronização incremental geral do Bling para uma vez por hora. As rotas do
  Bling também passam a revalidar o cache somente quando houve alteração
  processada. A expectativa em repouso é cair de 432 para cerca de 24
  invocações diárias, redução aproximada de 94%. A migration foi aplicada ao
  Supabase de produção `zalen.shop` (`xtwobxfepsdfjrtducqb`); a inspeção
  confirmou os três jobs ativos, os comandos condicionais, o fallback horário e
  os dois índices parciais de fila. No primeiro ciclo após a mudança, às
  20:10 UTC, os jobs de webhook Bling e reconciliação Mercado Pago concluíram
  com `0 rows`; os logs da Vercel no mesmo intervalo confirmaram zero
  invocações HTTP.
- Em 2026-07-24 foi implementada a política nativa de desconto automático para
  contas PJ, sempre isolada por `store_id`. A lista `PJ empresa` agora possui
  ativação, percentual e política promocional. O preço explícito da variante
  prevalece; na ausência dele, a regra percentual compara com a promoção e
  cobra o menor preço sem acumular descontos. O frete permanece separado e não
  recebe o percentual.
- O cadastro público permite escolher PF/PJ. PJ informa responsável, CNPJ,
  razão social e inscrição estadual/isento antes do envio do código; o perfil
  empresarial só é persistido após a confirmação do e-mail. A elegibilidade
  usa CNPJ matematicamente válido e dados fiscais completos, sempre consultados
  no servidor. Contas existentes podem completar ou trocar os dados PJ em
  `/conta`. Conflitos de e-mail/CNPJ retornam mensagens genéricas e não
  permitem assumir cadastro de outro usuário.
- Carrinho, checkout e pedido preservam snapshots de preço público, percentual,
  economia e preço final. A cotação de frete inclui a impressão digital da
  política de preço, invalidando prévias antigas após mudança administrativa.
  Mercado Pago recebe itens no preço final em `additional_info.items` e envio
  separado; Bling recebe preço final por item e nenhum desconto PJ global,
  evitando duplicidade.
- O Admin ganhou `/admin/configuracoes/precos`, com ativação e percentual de
  zero a 100% (maior que zero quando ativo), exemplo de cálculo e política
  “melhor preço”. Catálogo e produto mantêm preço público/SEO e apenas exibem
  aviso do benefício quando a regra estiver ativa.
- A migration `20260724171944_add_automatic_pj_discount.sql` foi aplicada com
  sucesso ao Supabase `zalen.shop` (`xtwobxfepsdfjrtducqb`). A conferência
  posterior confirmou a Brasil Drones com percentual `10.00`, política
  `best_price` e `automatic_discount_enabled = false`. Portanto, a estrutura
  está pronta sem alterar preços reais. O rollback operacional é manter ou
  voltar essa chave para desativada no Admin.
- A implementação passou em `npm run lint`, `npm test` (112 testes em 27
  arquivos), `npm run build` e `git diff --check`. Próximo passo exato após o
  deployment: validar PF com a regra desligada, ativar 10% por uma janela
  controlada, autenticar uma conta PJ de homologação, confirmar carrinho com
  produto de R$ 100/R$ 90 e frete inalterado, concluir uma compra e conferir
  Mercado Pago + Bling antes de manter a regra ativa para a Brasil Drones.
- O commit funcional `76f0a5e` foi enviado ao remoto. O primeiro Quality Gate
  passou em TypeScript, testes e build, mas a auditoria do npm apontou alertas
  recém-publicados nas dependências do Next. A correção compatível atualizou o
  Next para `16.2.11`, Fast URI para `3.1.4` e fixou overrides seguros para
  PostCSS `8.5.23` e Sharp `0.35.3`, sem usar o downgrade incompatível sugerido
  por `npm audit fix --force`. A auditoria de produção passou com zero
  vulnerabilidades; `npm run lint`, os 112 testes, `npm run build`, o scanner
  de segredos e `git diff --check` também passaram novamente. O primeiro
  rerun do CI (`30116966133`) parou no `npm ci` Linux porque o npm do macOS
  havia removido do lockfile as entradas raiz opcionais de `@emnapi/core` e
  `@emnapi/runtime`; as duas entradas multiplataforma foram restauradas com as
  mesmas versões `1.11.2` já declaradas. Uma nova instalação limpa confirmou
  ambas no nível raiz, preservou o lockfile e manteve a auditoria zerada. O
  Quality Gate `30117136356` concluiu integralmente verde no commit `c5d525c`,
  e o deployment produtivo `dpl_Hw26iDQvCqVMc1MSxWMA253g8wDN` ficou `READY`.

- Em 2026-07-21 foi concluída a limpeza controlada dos pedidos históricos de
  teste da Brasil Drones. Antes da exclusão havia 34 pedidos; a transação
  preservou explicitamente `BD-167498` e `BD-647495` e abortaria se qualquer
  outro candidato tivesse pagamento aprovado ou ID externo no ERP. Foram
  removidos 32 pedidos sem pagamento aprovado e sem vínculo externo. A
  verificação posterior confirmou somente os dois pedidos validados, ambos
  `paid`, `synced` e com os IDs Bling `26384566933` e `26386477388`; não ficaram
  órfãos em itens, tentativas/transações de pagamento ou envios.
- Em 2026-07-21 foi concluída a ativação controlada do menu público de modelos
  da Brasil Drones. A ação administrativa em
  `/admin/configuracoes/compatibilidade` habilitou os 38 itens preparados em
  `storefront_navigation_items`: 8 linhas raiz e 30 modelos filhos. A consulta
  de produção confirmou todos os 38 registros ativos, e o domínio comercial
  passou a exibir Linha Lito, Flip, Neo, Mini, Air, Avata, Mavic e Phantom. A
  página pública `/modelos/linha/air` foi validada com 18 produtos compatíveis.
- O navbar também foi corrigido para não cortar os submenus: a navegação
  horizontal completa fica disponível a partir de 1280 px com overflow
  visível; em larguras menores a loja usa o menu móvel, que preserva a
  hierarquia de linhas e modelos sem comprimir ou ocultar opções. A alteração
  passou em TypeScript, 25 arquivos/104 testes, build de produção, scanner de
  segredos e `git diff --check`. O commit `e5802a4` foi publicado; o Quality
  Gate `29841695861` ficou verde e o deployment produtivo
  `dpl_FB6xFE238A5e4HHBvXXtwvNz5tez` ficou `READY`, com os aliases comerciais
  ativos. A validação final no domínio comercial confirmou as oito linhas no
  navbar largo e, em tela menor, o menu móvel com linhas e respectivos modelos.
- Em 2026-07-21 o caminho produtivo multi-store do webhook do Mercado Pago foi
  publicado e salvo no painel como
  `/api/webhooks/mercado-pago/<store_id>/production`. A simulação assinada ainda
  retornou `401` mesmo após sincronizar a assinatura atual no ambiente de
  produção e concluir o redeploy `dpl_A6tToUbihERJdpodEzP3qGpKEsN6`. A causa
  foi isolada na opção de tolerância do SDK Node 3.1.0: a documentação e o
  provedor enviam `ts` Unix em segundos, mas essa opção o interpreta como
  milissegundos. O HMAC continua validado pelo SDK e a janela anti-replay de
  cinco minutos passou a ser aplicada separadamente, normalizando segundos ou
  milissegundos. A correção foi publicada no commit `e9234eb`, passou em 25
  arquivos/104 testes, TypeScript, build, scanner de segredos e
  `git diff --check`; o CI `29838817155` ficou verde e o deployment produtivo
  `dpl_HgotDQDJSN9kbHo7M1siiYwhToau` ficou `READY`. A nova simulação oficial
  assinada do pagamento `168939464233` retornou HTTP 200 no painel, e o mesmo
  POST 200 foi confirmado nos logs da Vercel no endpoint contextualizado.
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

Publicar de forma controlada a nova jornada de carrinho e checkout convidado e
repetir uma compra supervisionada em ambiente seguro. O resultado esperado é
concluir pagamento sem OTP inicial, preservar o checkout expresso autenticado e
recuperar o pedido convidado após validar o mesmo e-mail.

## Em andamento

A nova jornada de carrinho e checkout convidado está validada localmente e
aguarda publicação explícita. A validação não criou pedido, preferência ou
cobrança no Mercado Pago e não usou dados pessoais reais.

A reconciliação automática está publicada e agendada em produção. Ela não foi
disparada manualmente: a primeira execução diária deve registrar
`product_reconciliation` com snapshot completo e zero inativações para o
catálogo atual de 556 itens ativos.

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

0. Publicar o deployment da jornada convidada e executar uma compra supervisionada
   primeiro em sandbox: confirmar criação única do pedido, pagamento Pix/cartão,
   retorno em `/pedido/[id]`, ativação da conta com o mesmo e-mail e associação
   do pedido em `/conta/pedidos/[id]`. Um pagamento real exige confirmação
   operacional explícita antes da cobrança.
1. Após 06:15 UTC do dia seguinte, conferir o último `sync_jobs` de
   `product_reconciliation`: status `success`, snapshot completo e nenhuma
   inativação inesperada. Se houver erro, investigar o código seguro sem repetir
   a baixa manualmente.
2. Acompanhar o próximo pedido novo pago da Brasil Drones e confirmar que o
   webhook produtivo permanece HTTP 200 e que o pedido foi criado uma única vez
   no Bling, com `external_erp_sync_status = synced`.

### Pendências paralelas já registradas

0. Resolver manualmente o pedido histórico que está como enviado sem pagamento
   confirmado; registrar a decisão operacional antes de validar integralmente a
   restrição `orders_fulfillment_requires_payment`.
1. Gerar um único segredo de cron e atualizar, na mesma operação, os valores
   `CRON_SECRET` e `INTERNAL_JOB_SECRET` na Vercel e o segredo
   `zalen_cron_secret` do Vault do Supabase, caso a rotação coordenada ainda não
   tenha sido concluída fora deste handoff.
2. Preservar a `notification_url` contextualizada por loja e ambiente em cada
   pagamento e manter somente os tópicos efetivamente processados pelo conector.
3. Depois do deploy seguro do código de compatibilidade, abrir
   `/admin/configuracoes/compatibilidade`, revisar os modelos sugeridos por
   produto e salvar apenas os vínculos confirmados. Só então usar “Ativar menu
   de modelos”. Não recategorizar produtos já classificados tecnicamente no
   Bling.

## Bloqueios e dúvidas

Não há bloqueio técnico conhecido para domínio, checkout produtivo, webhook de
pagamento ou envio automático ao Bling. O próximo pedido real deve ser
acompanhado como observação pós-lançamento. Nenhum código ou credencial deve ser
compartilhado no handoff.

O acesso ao projeto Supabase correto foi restabelecido. A troca coordenada do
segredo de cron continua condicionada à validação dos ambientes da Vercel e não
deve expor o valor em terminal, código ou documentação.

## Validação

- A otimização dos jobs passou em `npm run lint`, `npm test` (115 testes em 28
  arquivos), `npm run build`, `npm run security:audit` com zero
  vulnerabilidades, scanner de segredos e `git diff --check`. O Advisor de
  segurança não apontou regressão da migration; permaneceu apenas o aviso global
  já conhecido de proteção contra senhas vazadas desativada. O Advisor de
  performance não apontou falha nos índices novos; os avisos exibidos pertencem
  a FKs e políticas preexistentes, fora desta frente.
- O commit funcional `ae61b36` foi enviado ao remoto. O Quality Gate
  `30122794357` concluiu todas as etapas com sucesso e o deployment produtivo
  `dpl_HQBPwXJAi652C1i5i7B7oUb9tjSN` ficou `READY`.
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

### Catálogo Brasil Drones no Bling privado (12/08/2026)

- O catálogo novo continua com 599 produtos derivados de 600 linhas da planilha
  `Catalogo_Bling_por_Modelo_Editavel (1) (4) (1).xlsx`; a duplicidade do código
  `593` foi resolvida anteriormente e o lote foi importado no app privado
  `Brasil Drones Parts GPT`, nunca no conector global da Zalen Shop.
- Os saldos foram relidos no único depósito ativo `Geral` (`14889026859`) e
  conferem exatamente com a planilha: 504 unidades, sem divergência por SKU
  antes ou depois dos lançamentos de custo.
- Dos 596 GTIN/EAN preenchidos na fonte, 591 foram aceitos pelo Bling. Cinco
  permaneceram vazios: SKUs `35435`, `37672`, `3923783`, `3243` e `32324`.
  O painel confirmou que os prefixos `638` e `852` não são válidos no GS1;
  os dois últimos códigos também falham no dígito verificador. Não corrigir nem
  inventar esses GTINs sem uma nova fonte válida.
- A planilha contém preço de custo em 116 produtos. A API de estoque aceitou o
  custo nos balanços, mas esse valor não alimenta o campo de fornecedor padrão.
  Como não havia fornecedor cadastrado e o app privado não tem escopo para criar
  contatos, foi criado pelo painel o contato técnico `Fornecedor não informado
  - estoque inicial Brasil Drones`.
- Foram criados 116 vínculos produto-fornecedor padrão via
  `/produtos/fornecedores`. A auditoria final confirmou 116 de 116 custos
  exatamente iguais à planilha, zero erro de API e zero divergência.
- Scripts adicionados: `scripts/bling/update-brasil-drones-commercial-data.mjs`,
  `scripts/bling/sync-brasil-drones-supplier-costs.mjs` e os respectivos
  capturadores OAuth. Eles recusam a credencial global e usam somente variáveis
  `BLING_CUSTOMER_*`.
- Relatórios locais estão em `saida_bling/`, incluindo
  `novo_catalogo_relatorio_dados_comerciais.md`. Esses artefatos não devem
  conter tokens nem ser tratados como substitutos da planilha original.
- A coleta das imagens do MundoDrone foi concluída em 13/08/2026 conforme o
  registro acima. As 27 pendências de imagem devem ser tratadas apenas após
  revisão manual ou nova fonte confiável.

### Navegação e catálogo público por categorias Bling (13/08/2026)

- A árvore de categorias Bling já está espelhada no Supabase da Brasil Drones,
  incluindo as linhas Lito, Neo, Mini, Air, Avata, Mavic e Phantom e seus
  modelos. O menu público deve manter apenas as raízes editoriais; os filhos são
  gerados em leitura a partir dessa árvore, evitando a manutenção duplicada no
  admin da Zalen.
- A migration `20260810191356_source_storefront_subcategories_from_bling.sql`
  foi aplicada em produção. Ela vinculou as oito raízes de modelo aos slugs do
  Bling, removeu 35 cópias manuais de filhos e cadastrou os modelos ausentes
  Mini SE, Mavic 2 e Mavic Platinum sem IDs fixos.
- O código local gera os submenus a partir das categorias cujo `external_id`
  começa com `bling:`, preserva ordem/visibilidade das raízes e encaminha
  modelos para as páginas de compatibilidade. O admin informa quantas
  subcategorias de cada raiz são gerenciadas pelo Bling.
- A auditoria encontrou 435 produtos no catálogo Supabase: 355 pertencem ao
  lote novo de 599 e 80 são registros antigos. Portanto, o menu pode ser
  publicado, mas o catálogo público ainda não reflete integralmente o Bling.
- O dry-run da reconciliação canônica confirmou 599 produtos, 504 unidades,
  599 categorias principais, 818 vínculos de compatibilidade, 572 produtos com
  imagem e 1.425 imagens. A reconciliação canônica ampla não foi executada; ela
  substitui vínculos e imagens e inativa os 80 registros antigos, portanto
  continua exigindo autorização explícita para essa troca integral.
- O reconciliador versionado usa apenas os artefatos produzidos pelo app privado
  Bling da Brasil Drones e recusa qualquer dependência do app global da Zalen.
  Comandos: `npm run catalogo:brasil-drones:loja:dry` e, após autorização,
  `npm run catalogo:brasil-drones:loja:sync`.
- Em 13/08/2026, a auditoria de produção confirmou 435 produtos no Supabase:
  395 ativos, 40 em rascunho e 355 pertencentes ao lote novo de 599. O botão
  antigo de reprocessamento completo atingiu o timeout de 300 segundos da
  Vercel antes de processar qualquer item; o job órfão foi encerrado com o erro
  operacional `product_sync_request_timeout`.
- O sincronizador completo foi alterado para processar uma página de até 40
  produtos por requisição. O admin coordena as páginas sequencialmente e soma
  as métricas, evitando o timeout sem mudar o fluxo incremental ou o
  reprocessamento unitário. Como a fila de webhooks também usa a trava de
  produtos, o admin aguarda e repete páginas que encontrem um job unitário em
  andamento. O job unitário não relê mais todas as categorias do Bling; isso
  reduz sua duração e libera a trava rapidamente.
- Cada página completa consulta os detalhes individualmente, mas agrupa os
  saldos dos produtos em uma única chamada a `/estoques/saldos`. Isso remove
  dezenas de chamadas redundantes por lote sem alterar os saldos gravados.
- As leituras de detalhes usam no máximo três requisições simultâneas e mantêm
  início espaçado em 400 ms. A taxa continua limitada a 2,5 chamadas por
  segundo, mas a latência de rede deixa de bloquear toda a página.
- O painel Bling aceita um ID numérico para reprocessamento pontual. Isso permite
  corrigir falhas isoladas sem repetir todas as páginas do catálogo.
- O produto de teste já existe no Bling e na loja: SKU `PRO-TP`, preço R$ 5,00,
  estoque 9, ativo e com frete grátis. O Mercado Pago de produção e o envio
  automático ao Bling estão conectados. O pedido pago `BD-647495`, de R$ 5,00,
  já foi sincronizado com sucesso ao Bling, confirmando o fluxo de pedido.
- A sincronização paginada de produção foi concluída em 16 páginas. A comparação
  exata contra os 599 IDs retornados pela importação confirmou 599 presentes e
  599 ativos, sem ID ausente e sem item do lote em rascunho. O catálogo da loja
  agora possui 679 registros vinculados ao Bling: 639 ativos e 40 rascunhos
  antigos, mantidos separados do lote novo.
- O único item inicialmente ausente, Bling `16690733656`, SKU `825`, foi
  reprocessado pontualmente e criado como ativo, com categoria `Mini 3`, imagem
  e saldo sincronizado. O último sync de produto terminou com sucesso em
  `2026-08-13T13:35:34.307Z`.
- O storefront de produção foi validado com o produto `PRO-TP` no carrinho:
  subtotal R$ 5,00, frete grátis e total R$ 5,00. Não foi criada uma nova compra
  em nome do cliente; o próximo teste real deve usar os dados e o pagamento do
  próprio operador. Ao aprovar o pagamento, o serviço chama automaticamente o
  envio do pedido ao Bling.
- As mudanças de sincronização estão publicadas no deployment de produção
  `dpl_CzDiCbwrUSAzV6VoYrxUn2w6t7Fp`, com o commit `a153895`. Antes da publicação,
  lint, build e a suíte completa passaram: 120 testes em 29 arquivos.

### Higienização de descrições Mundrone no Bling privado (21/08/2026)

- Foi criado o fluxo OAuth `catalogo:brasil-drones:descricoes:*`, exclusivo do
  app privado da Brasil Drones. Ele recusa credenciais do conector global da
  Zalen Shop e valida o OpenAPI oficial antes de qualquer alteração.
- A auditoria leu os 534 produtos atualmente retornados pela API do Bling e
  encontrou 178 produtos com referência textual a `Mundrone` em
  `descricaoCurta` e/ou `descricaoComplementar`.
- A correção substituiu somente as referências de marca e domínio por `Brasil
  Drones & Parts` e `brasildroneseparts.com.br`. Os PATCHes não enviam nome,
  SKU, preço, custo, saldo, categoria, marca, GTIN ou imagens.
- A primeira execução atualizou e verificou 146 produtos, mas uma instabilidade
  de rede deixou 32 requisições sem confirmação. A retomada reauditoriou os 534
  produtos, identificou 31 pendências reais e atualizou/verificou todas sem
  erro. O item restante já havia sido persistido pelo Bling antes da queda de
  conexão.
- Resultado final: 178 produtos corrigidos e verificados sem referência
  remanescente à Mundrone nos campos alterados. Os relatórios locais ignorados
  pelo Git estão em `saida_bling/novo_catalogo_descricoes_mundrone_*`.
- Validações locais: teste unitário do sanitizador e `npm run lint` passaram.

### Experiência de pagamento Pix no checkout (22/08/2026)

- Foi corrigida uma transição visual no checkout de convidados: após o Mercado
  Pago criar um Pix pendente, o carrinho é limpo de propósito, mas a tela de
  carrinho vazio era avaliada antes da tela de pagamento.
- O checkout agora prioriza a tela de status do Pix gerado, com QR Code/código
  de pagamento e acompanhamento automático, mesmo depois de limpar o carrinho.
  Durante a criação da cobrança, a interface mostra um estado explícito de
  processamento para evitar a impressão de erro.
- A mesma proteção foi estendida a cartão, boleto, Pix autenticado e ao
  redirecionamento externo do Mercado Pago: depois de uma confirmação válida,
  o cliente vê uma tela de encaminhamento de pagamento em vez do carrinho vazio
  até a navegação terminar.
- Validações locais: `npm run lint`, a suíte completa (`202` testes em `46`
  arquivos), `git diff --check` e o build de produção passaram. Não foi criado
  um Pix real apenas para validar esta alteração.

### Produto duplicado e falso sucesso do webhook Bling (25/08/2026)

- O cadastro antigo Bling `16690733041`, SKU `251`, preço R$ 52,50 e saldo
  zero foi confirmado como a origem do produto incorreto no storefront e
  inativado no próprio Bling. O cadastro canônico é `16690733422`, SKU `3243`,
  preço R$ 46,00 e saldo 6.
- No cadastro canônico, os números `12 x 7 x 16` estavam salvos com unidade
  `Metros`. A unidade foi corrigida para `Centímetros` no Bling sem alterar
  preço, estoque, peso, imagens ou descrição.
- Os dois webhooks `product.updated` chegaram e foram processados, porém os
  syncs unitários falharam internamente e ainda assim terminaram com status de
  sucesso. A base da loja foi reparada com guardas pelos IDs/SKUs: SKU `251`
  inativo e SKU `3243` ativo, R$ 46,00, saldo 6, peso 0,150 kg e dimensões
  `12 x 7 x 16` cm.
- O storefront de produção foi validado: o cadastro canônico aparece por
  R$ 46,00, em estoque, com compra habilitada; a URL antiga não exibe mais o
  produto.
- O sincronizador unitário agora converte qualquer erro interno do item em
  falha real do job. Assim, o webhook entra em retry em vez de ser registrado
  como sucesso sem persistir o produto. O comportamento parcial dos syncs em
  lote foi preservado.
- Validações locais: TypeScript, 205 testes em 47 arquivos e build de produção
  passaram. Esta correção de código ainda precisa de commit/push e deploy.

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
