# Storefront e Templates — Zalen Shop

## 1. Princípio

Storefront é a experiência pública da loja. Cada loja pode ter identidade visual própria, mas deve consumir o mesmo core da Zalen Shop.

## 2. Separação de identidade

- Storefront usa identidade da loja ativa.
- Login/admin usam identidade Zalen Shop.

Exemplos:

- Brasil Drones storefront usa identidade Brasil Drones.
- LB London storefront usará identidade LB London.

## 3. Tipos de storefront

### Custom Storefront

Loja com visual sob medida para o cliente.

Brasil Drones é o primeiro exemplo.

### Template Storefront

Loja baseada em template editável.

Futuro.

## 4. Core compartilhado

Mesmo com visual diferente, todas as lojas devem usar o mesmo core para:

- produtos;
- categorias;
- carrinho;
- pedidos;
- clientes;
- checkout;
- integrações;
- logs.

## 5. Regra crítica

Nenhum storefront deve implementar lógica própria de pagamento, ERP ou envio.

Storefront chama services internos da Zalen Shop.

## 6. Páginas públicas do MVP

- `/`
- `/produto/[slug]`
- `/categoria/[slug]`
- `/carrinho`
- `/conta/entrar`
- `/conta/cadastro`
- `/checkout`
- `/pedido-confirmado`

O catálogo continua público. Para finalizar uma compra, o comprador informa
e-mail, endereço de entrega e CPF/CNPJ para nota fiscal. Antes do pagamento, o
e-mail precisa ser validado por código enviado pela loja. Não há senha
obrigatória no checkout, mas o cliente é criado ou vinculado a Supabase Auth para
garantir rastreio, área do comprador e pedidos associados ao cadastro correto.
O carrinho é persistido no navegador e o pedido é criado server-side no core da
Zalen Shop.

O fluxo de checkout operacional é:

1. Identificação por e-mail, CPF ou CNPJ.
2. Cadastro rápido PF ou PJ, sem exigir senha.
3. Endereço de entrega e dados fiscais.
4. Envio operacional inicial.
5. Validação do e-mail por código.
6. Pagamento via Mercado Pago Checkout Pro.

No endereço de entrega, o CEP é consultado server-side e pode preencher
logradouro, bairro, cidade e UF automaticamente. Campos continuam editáveis para
endereços incompletos, CEPs genéricos ou falha temporária do provedor.

CPF aplica `customer_type = pf`; CNPJ aplica `customer_type = pj`. O preço
mostrado no storefront é público/default PF, mas o total cobrado é sempre
recalculado no servidor conforme a tabela de preço aplicável. O frontend nunca
define preço, frete ou total.

## 7. Páginas futuras

- `/busca`
- `/minha-conta`
- `/meus-pedidos`
- `/rastreio`
- `/favoritos`
- `/politica-de-privacidade`
- `/trocas-e-devolucoes`
- `/termos-de-uso`
- `/contato`

## 8. Modo template

No futuro, templates editáveis poderão permitir ajustes controlados:

- logo;
- cores;
- banners;
- categorias em destaque;
- produtos em destaque;
- textos da home;
- rodapé;
- SEO básico.

Não permitir HTML/JS livre no MVP.

## 9. Modo custom

A Zalen cria uma loja sob medida usando o mesmo motor central.

Customização fica na camada visual, não no core.

## 10. Regra de dados

Storefront não deve depender de ERP em tempo real para renderizar páginas.

Fluxo correto:

```txt
ERP Connector
↓
Supabase/Zalen Core
↓
Storefront
```

Isso melhora performance, resiliência e SEO.
