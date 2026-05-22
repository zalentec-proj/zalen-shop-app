# Design System — Zalen Shop / Brasil Drones

## 1. Direção visual

A primeira loja deve seguir a estética premium já apresentada no protótipo da Brasil Drones:

- visual tecnológico;
- alto contraste;
- fundo escuro;
- uso controlado de azul/ciano;
- cards com profundidade;
- foco em produtos;
- experiência mobile limpa.

## 2. Componentes base

- Button
- Input
- Select
- Card
- Badge
- Modal
- Drawer
- Table
- Tabs
- Breadcrumb
- Alert
- Toast
- ProductCard
- CategoryCard
- PriceTag
- StatusBadge
- IntegrationStatus
- EmptyState
- LoadingSkeleton

## 3. Bibliotecas visuais

Recomendado:

- Tailwind CSS.
- Radix UI ou shadcn/ui para acessibilidade e componentes.
- Lucide React para ícones.
- Motion/Framer Motion apenas em interações pontuais, sem exagero.

## 4. Regras de UI

- Mobile-first.
- Contraste adequado.
- Fontes com hierarquia clara.
- Evitar excesso de animação.
- Cards devem ter estados claros: normal, hover, loading e erro.
- Botões principais com ação evidente.
- Checkout sem distrações.

## 5. Modo template e modo custom

### Template

Seções editáveis:

- Hero
- Categorias
- Produtos em destaque
- Banner promocional
- Sobre a loja
- Rodapé

### Custom

A Zalen pode criar uma experiência sob medida usando o mesmo motor:

- catálogo;
- carrinho;
- checkout/pedido;
- integração;
- produtos;
- pedidos.

## 6. Não fazer

- Não criar cada página com padrão visual diferente.
- Não misturar lógica de integração dentro de componente visual.
- Não deixar layout depender de dados vindos em tempo real do Bling.
- Não permitir que o cliente quebre o layout com HTML livre.
