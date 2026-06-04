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
- `/checkout`
- `/pedido-confirmado`

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
