# Critérios de Aceite

## 1. Loja pública

- Home carrega corretamente.
- Categoria carrega produtos.
- Produto abre com dados corretos.
- Layout responsivo.
- Performance aceitável.
- Sem erro visual crítico no mobile.

## 2. Catálogo

- Produto pode ser listado.
- Produto pode ter imagem.
- Produto pode ter variante.
- Estoque aparece corretamente.
- Produto inativo não aparece na loja.

## 3. Pedido

- Carrinho adiciona/remove itens.
- Total é calculado no backend quando checkout real for implementado.
- Pedido é criado com número amigável.
- Pedido é salvo no banco quando a camada de dados for implementada.
- Pedido pode ser enviado ao Bling.

## 4. Bling

- OAuth funcionando.
- Token salvo criptografado.
- Produto importado.
- Pedido enviado.
- Erro registrado em log.
- Webhook salvo antes de processar.

## 5. Segurança

- RLS ativo quando Supabase for implementado.
- Usuário sem permissão não acessa dados.
- Tokens não aparecem no frontend.
- Webhook é idempotente.
- Upload limitado.
- Sem HTML/JS livre no MVP.

## 6. Painel

- Login funciona.
- Produtos visíveis.
- Pedidos visíveis.
- Integração mostra status.
- Erros aparecem de forma compreensível.

## 7. Deploy

- Deploy na Vercel.
- Variáveis configuradas.
- Supabase conectado quando necessário.
- Domínio funcionando.
- Ambiente staging separado de produção.
