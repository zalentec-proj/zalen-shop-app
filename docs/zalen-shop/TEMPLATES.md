# Templates e Modo Desenvolvedor

## 1. Objetivo

Permitir dois formatos de criação de loja:

1. Modo Template.
2. Modo Custom/Desenvolvedor.

## 2. Modo Template

O lojista escolhe um modelo pronto e personaliza elementos controlados:

- logo;
- cores;
- banners;
- categorias;
- produtos em destaque;
- textos;
- seções da home;
- rodapé.

Não há HTML/JS livre no MVP.

## 3. Modo Custom

A Zalen cria uma loja sob medida para o cliente, usando o mesmo motor:

- produtos;
- pedidos;
- carrinho;
- integrações;
- domínio;
- checkout/pedido.

Customização fica na camada visual, não no núcleo.

## 4. Regra crítica

Nenhum template deve implementar lógica própria de pedido, pagamento ou integração. Todos usam os serviços centrais.

## 5. Primeiros templates futuros

- Técnico/Premium: drones, peças, eletrônicos.
- Minimalista: loja clean.
- Catálogo/WhatsApp: vitrine simples.

## 6. Estrutura sugerida

```txt
components/
  storefront/
    templates/
      technical/
      minimal/
      catalog/
    custom/
      brasil-drones/
    shared/
```

## 7. Primeira loja

A Brasil Drones será tratada como uma loja custom, mas os componentes devem ser separados com cuidado para reaproveitamento futuro.
