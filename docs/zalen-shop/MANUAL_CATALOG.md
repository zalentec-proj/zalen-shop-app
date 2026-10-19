# Cadastro manual de produtos no admin

Incremento de 19/10/2026, solicitado ao preparar os livros reais da Editora
Rochedo. O fluxo pertence ao catálogo comum da Zalen Shop.

## Uso

1. No admin geral, abrir o painel da loja desejada.
2. Em **Produtos**, escolher **Novo produto**.
3. Preencher nome, preço e estoque. SKU, descrição em texto, autor, ISBN,
   categoria, link HTTPS da capa e medidas de envio são opcionais.
4. Salvar. O padrão é **Rascunho**, sem exposição na vitrine.
5. Abrir o produto na lista e escolher **Editar cadastro** para corrigir os
   campos. **Publicado** só aparece publicamente quando a loja está ativa.

Para a Rochedo:
`https://editora-rochedo.zalenshop.com.br/admin/produtos/novo`.

Cada cadastro contém uma variante. A categoria é criada ou reutilizada por
slug dentro da mesma loja. SKU preenchido não pode repetir outro produto da
loja, inclusive um produto recebido de ERP. A edição completa recusa produtos
de integração ou com múltiplas variantes; estes mantêm os ajustes operacionais
existentes. A edição manual gerencia uma capa e uma categoria por produto.

Formato digital desativa envio físico e limpa medidas. Este incremento não
inclui upload/entrega de e-books, licenciamento digital, upload de capas ou
configuração de pagamento/frete. A imagem usa URL HTTPS permanente PNG, JPG,
WebP ou AVIF; autor e ISBN ficam nos atributos da variante.

## Acesso e persistência

- Owner/admin global e owner/admin/operator da loja podem escrever. Viewer
  continua somente leitura. A loja vem do host, e o ator vem do Auth verificado.
- Lojas `planned` têm acesso operacional privado pelo subdomínio Zalen para
  preparar catálogo. Resolver público continua aceitando somente `active`.
  Lojas `inactive` continuam sem link/painel operacional.
- Server Action → service com guard e Zod → RPC `save_manual_product`.
  Wrapper público invoker e implementação privada definer com `search_path=''`,
  ambos executáveis apenas por `service_role`. A função reconfere os papéis.
- Produto, variante, capa e categoria salvam na mesma transação. A loja é
  bloqueada durante a escrita para serializar cadastro manual e mudança de
  status. A criação usa UUID estável e ledger privado para retry sem duplicar.
- Não há novos grants de escrita para clientes nem alteração de RLS público.
  Categorias ganham SELECT para os membros/globais que já leem o catálogo.

Migration: `20261019184654_manual_catalog_management.sql`.

## Verificação

`npm run test:ci` e `npm run test:catalog:db`. O teste SQL usa PostgreSQL
descartável e valida atomicidade, retry, SKU duplicado, produto de outra loja,
ERP, viewer, leitura privada e bloqueio de RPC para anon/authenticated.

Para conferir pela UI, usar
`CATALOG_FIXTURE=1 node scripts/dev-platform-stores-fixture.mjs`, seguindo a
URL e os papéis fictícios impressos. Nenhum `.env` ou dado cloud é utilizado.
Ao encerrar, o script remove app temporário e contêiner. A rota de sessão existe
exclusivamente nessa cópia descartável e não deve ser levada ao aplicativo.
