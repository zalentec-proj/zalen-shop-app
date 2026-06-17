# Plano de Implementação — Bling Ready

## Status desta sprint

Implementada a base segura para OAuth Bling da Brasil Drones e a primeira versão
real de sincronização de produtos. O app Zalen Shop está aprovado/publicado no
Bling. Pedidos e webhooks continuam fora do escopo desta etapa.

## O que foi implementado

- Registro inicial Brasil Drones → Bling em `store_integrations`, sem credenciais.
- Configuração server-side por env.
- Construção de URL de autorização OAuth.
- Callback OAuth server-side.
- Validação de `state` anti-CSRF.
- Troca de `authorization_code` por tokens apenas quando envs estiverem configuradas.
- Criptografia AES-256-GCM para credenciais quando `INTEGRATION_TOKEN_ENCRYPTION_KEY` existir.
- Bloqueio de persistência de tokens se criptografia estiver ausente.
- Página `/admin/integracoes/bling`.
- Botão de conexão a partir da seção de integrações do admin.
- Sync server-side de produtos Bling para o catálogo Supabase.
- Preservação de produtos nativos sem vínculo externo.
- Origem do produto exibida no admin: Zalen ou Bling.
- Sync incremental por `dataAlteracaoInicial` após o primeiro sync completo.
- Mapeamento de variações Bling para múltiplas `product_variants`.
- Consulta de saldos via endpoint oficial de estoque quando o escopo permitir.
- Normalização de status do produto Bling para evitar rascunho indevido quando
  o provedor retorna formatos equivalentes a ativo/inativo.
- Reconciliação conservadora de categorias Bling com categorias nativas Zalen
  por slug e aliases canônicos, evitando duplicidade simples.
- Extração robusta de URL de imagem do produto/variação Bling para salvar em
  `product_images`, sem baixar ou expor arquivos externos no frontend de admin.
- Diagnóstico sanitizado por produto no resumo do sync de catálogo.
- Reprocessamento unitário de produto Bling pelo `externalId` exibido no
  diagnóstico do admin.
- Sync dedicado de estoque para variantes já vinculadas ao Bling.

## Rotas

```txt
GET /api/integrations/bling/connect
GET /api/integrations/bling/callback
POST /api/integrations/bling/homologation/run
POST /api/integrations/bling/products/sync
POST /api/integrations/bling/inventory/sync
```

## Domínios oficiais

```txt
Homepage pública: https://www.zalenshop.com.br
Manual público: https://www.zalenshop.com.br/manual/bling
Redirect produção: https://app.zalenshop.com.br/api/integrations/bling/callback
Redirect local: http://localhost:3000/api/integrations/bling/callback
```

## Variáveis de ambiente

```env
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=https://app.zalenshop.com.br/api/integrations/bling/callback
BLING_SCOPES=
BLING_ENV=production
INTEGRATION_TOKEN_ENCRYPTION_KEY=
```

Para desenvolvimento local, usar:

```env
BLING_REDIRECT_URI=http://localhost:3000/api/integrations/bling/callback
```

## Comportamento esperado

### Envs ausentes

- Página mostra aviso discreto.
- Botão de conexão fica indisponível.
- Rotas retornam falha controlada via redirect com `error`.

### Envs presentes, criptografia ausente

- Fluxo OAuth não é iniciado.
- Nenhum token é recebido ou salvo.
- Admin mostra aviso de criptografia pendente.

### Envs presentes e criptografia presente

- `/api/integrations/bling/connect` redireciona para autorização Bling.
- A URL de autorização envia apenas `response_type`, `client_id` e `state`;
  `redirect_uri` e `scope` ficam definidos no cadastro do app Bling.
- Callback valida `state`.
- Callback troca `code` por token server-side.
- Tokens são criptografados e salvos em `store_integrations.credentials_encrypted`.
- Status da loja passa para `connected`.

## Homologação oficial da API Bling

Fonte oficial: https://developer.bling.com.br/homologacao#execu%C3%A7%C3%A3o

A execução de homologação é server-side e só pode ser iniciada por usuário autenticado
com acesso à loja ativa. O frontend chama apenas a rota interna da Zalen Shop:

```txt
POST /api/integrations/bling/homologation/run
```

A rota descriptografa as credenciais salvas em
`store_integrations.credentials_encrypted`, executa a sequência oficial e retorna
somente um resumo por etapa. Access token e refresh token nunca são enviados ao
frontend, nunca são logados e nunca entram em payload público.

### Sequência executada

```txt
GET    https://api.bling.com.br/Api/v3/homologacao/produtos
POST   https://api.bling.com.br/Api/v3/homologacao/produtos
PUT    https://api.bling.com.br/Api/v3/homologacao/produtos/{id}
PATCH  https://api.bling.com.br/Api/v3/homologacao/produtos/{id}/situacoes
DELETE https://api.bling.com.br/Api/v3/homologacao/produtos/{id}
```

Regras implementadas:

- O body do `POST` usa os dados retornados em `data` pelo `GET`, sem wrapper.
- O `PUT` envia os dados atualizados do produto com `nome` alterado para `Copo`,
  conforme exemplo oficial.
- O `PATCH` envia `{ "situacao": "I" }`.
- O produto retornado pelo `POST` é removido no `DELETE`.

### Header `x-bling-homologacao`

A cada request de homologação, o Bling retorna um header
`x-bling-homologacao`. O valor recebido em uma etapa deve ser enviado na etapa
seguinte. Se o header estiver ausente, a execução para com falha controlada.

### Limites

- Tempo total máximo: 10 segundos.
- Limite entre requests: 2 segundos.
- A implementação usa deadline total de 10 segundos, timeout curto por request
  e aguarda 2 segundos entre chamadas para não acionar `429` no fluxo aceito
  pela homologação.

### Refresh token

Se uma chamada de homologação retornar erro compatível com token inválido ou
expirado, a rota tenta renovar o access token uma única vez usando o refresh
token, salva novamente as credenciais criptografadas e repete apenas a chamada
que falhou. Não há loop infinito.

Durante a homologação, o Bling pode invalidar o access token em uma das etapas
e retornar uma falha genérica `400`. A implementação trata `400` como candidato
a refresh apenas nesse fluxo controlado e repete a chamada uma única vez. Se a
falha persistir após o refresh, o erro é retornado sem nova tentativa.

### Resultado no admin

A página `/admin/integracoes/bling` mostra um bloco "Homologação" com:

- status geral;
- resultado de GET, POST, PUT, PATCH e DELETE;
- duração total;
- indicação de token renovado, sem mostrar o token.

O resumo operacional é salvo em `settings_json.homologation`, sem payloads
sensíveis.

## O que não foi implementado

- Sync de estoque por depósito específico.
- Envio de pedidos para Bling.
- Sync real baseado no produto usado na homologação.
- Webhooks reais.
- Reprocessamento unitário por produto.

## Product Sync v1

A Zalen Shop continua sendo a fonte de leitura do storefront e do admin via
Supabase. O Bling é um conector opcional configurado por loja, não uma dependência
global da plataforma.

Endpoints oficiais usados:

```txt
GET https://api.bling.com.br/Api/v3/produtos
GET https://api.bling.com.br/Api/v3/produtos/{idProduto}
GET https://api.bling.com.br/Api/v3/categorias/produtos/{idCategoriaProduto}
GET https://api.bling.com.br/Api/v3/estoques/saldos
```

Regras implementadas:

- A rota interna `POST /api/integrations/bling/products/sync` exige sessão e
  acesso à loja ativa.
- O sync usa `store_id`, `store_integrations.credentials_encrypted` e refresh
  token server-side quando necessário.
- Tokens nunca são enviados ao frontend nem entram em logs ou respostas.
- Produtos Bling são gravados com `external_provider = "bling"` e `external_id`.
- Produto existente só é atualizado por `store_id + external_provider + external_id`.
- Produtos nativos sem vínculo externo não são sobrescritos por nome, slug ou SKU.
- Slug conflitante recebe sufixo seguro para preservar URLs nativas.
- `sync_jobs` registra execução com resumo sanitizado e sem payload bruto.
- `store_integrations.last_sync_at` e `settings_json.productSync` guardam o
  último resumo operacional.
- Se `last_sync_at` existir, o próximo sync usa `dataAlteracaoInicial`.
- A rota aceita modo incremental ou completo. O admin usa sync incremental no
  botão principal e oferece "Reprocessar tudo" para reparar status/categorias de
  produtos já importados sem depender de alteração recente no Bling.
- A mesma rota aceita `productId` numérico para reprocessar um único produto
  Bling, sem percorrer o catálogo inteiro.
- Produtos com `variacoes` geram variantes separadas no catálogo Zalen.
- Estoque usa `/estoques/saldos` por produto/variação quando disponível; se o
  escopo de estoque falhar, o sync continua com o saldo do payload de produto.
- Imagens são gravadas como URL em `product_images` quando o payload Bling traz
  campos como `imagemURL`, `imageUrl`, `urlImagem`, `imagem`, `imagens` ou
  `midia.imagens`. Quando o produto pai não tem imagem, o sync tenta a primeira
  imagem disponível nas variações.
- Quando o Bling retorna imagem, o sync coloca essa URL como imagem primária
  (`position = 0`) e remove imagens antigas daquele produto sincronizado para
  evitar fallback ou imagem de produto anterior no storefront.
- Status do produto é normalizado antes de gravar no catálogo. Valores ativos
  conhecidos (`A`, `Ativo`, `Active`, `S`, `Sim`, `true`, `1`) publicam o produto;
  valores inativos conhecidos (`I`, `Inativo`, `Inactive`, `N`, `Não`, `false`,
  `0`) deixam o produto inativo. Valores desconhecidos continuam como rascunho.
- Categorias vindas do Bling tentam reutilizar categorias nativas por slug
  normalizado e aliases operacionais da Brasil Drones (`drones`, `pecas`,
  `acessorios`, `baterias`, `kits-e-combos`) antes de criar nova categoria.
- Quando uma categoria nativa sem `external_id` é reutilizada, o sync anexa o
  vínculo externo do Bling sem renomear a categoria Zalen.
- Se uma categoria duplicada antiga com o mesmo `external_id` existir, o próximo
  sync relinka o produto para a categoria nativa e remove a duplicada quando ela
  ficar sem produtos.
- O resumo do sync guarda diagnóstico sanitizado dos últimos produtos processados:
  `externalId`, nome, SKU, ação, status mapeado, categoria, presença de imagem,
  quantidade de variantes/saldos e erro seguro quando houver.
- O admin usa o `externalId` do diagnóstico para acionar "Reprocessar produto".

## Inventory Sync v1

O estoque pode ser sincronizado sem reprocessar catálogo inteiro.

Endpoint oficial usado:

```txt
GET https://api.bling.com.br/Api/v3/estoques/saldos
```

Regras implementadas:

- A rota interna `POST /api/integrations/bling/inventory/sync` exige sessão e
  acesso à loja ativa.
- O sync lista variantes já vinculadas ao Bling por `external_id`.
- O saldo é buscado em lotes usando `/estoques/saldos`.
- Apenas `product_variants.stock` é atualizado.
- Produtos nativos sem vínculo Bling não são alterados.
- `sync_jobs` registra execução como `inventory_sync`.
- `settings_json.inventorySync` guarda o último resumo operacional.
- O resumo guarda diagnóstico sanitizado dos últimos itens processados:
  `externalId`, SKU, estoque anterior, estoque novo, ação e erro seguro.

Limitações da v1:

- Estoque por depósito específico ainda não usa `/estoques/saldos/{idDeposito}`.
- Categorias ambíguas, fora dos aliases definidos, ainda podem gerar categoria
  nova para não perder classificação.
- Upload/cópia da imagem para Supabase Storage ainda não foi implementado; a v1
  usa a URL pública retornada pelo Bling.
- Reprocessamento unitário depende do produto aparecer no diagnóstico recente ou
  de futura busca por `externalId` manual.

## Próximas etapas

1. Implementar estoque por depósito específico via `/estoques/saldos/{idDeposito}`.
2. Implementar envio idempotente de pedidos.
3. Implementar webhooks com validação de assinatura.
4. Preparar Mercado Pago e Melhor Envio como conectores opcionais futuros.
