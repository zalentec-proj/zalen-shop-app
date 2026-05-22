# PRD — Zalen Shop / Brasil Drones

## 1. Contexto

A Brasil Drones & Parts precisa de uma loja online com aparência profissional, experiência visual premium e integração com sua operação no Bling. A primeira versão será criada para um único cliente, mas com fundação preparada para futura evolução multi-tenant.

## 2. Objetivo do produto

Criar uma loja online personalizada, conectada ao Bling, onde o cliente consiga expor produtos, organizar categorias, receber pedidos e manter o Bling como centro operacional.

## 3. Posicionamento

A Zalen Shop não nasce como substituta do Bling.

> Zalen Shop é a vitrine e experiência de venda. Bling é o ERP e operação.

## 4. Usuários principais

### Comprador

- Navega pelos produtos.
- Pesquisa e acessa categorias.
- Visualiza detalhes do produto.
- Adiciona ao carrinho ou solicita compra/orçamento.
- Acompanha status do pedido, quando disponível.

### Lojista

- Acessa painel administrativo.
- Visualiza produtos importados/sincronizados.
- Visualiza pedidos.
- Acompanha status da integração.
- Conecta Bling e, futuramente, Mercado Pago/Melhor Envio.

### Admin Zalen

- Configura loja.
- Acompanha logs.
- Ajusta integrações.
- Dá suporte.

## 5. Escopo MVP

### Loja pública

- Home personalizada da Brasil Drones.
- Página de categoria.
- Página de produto.
- Carrinho.
- Página de pedido concluído.
- Layout responsivo.
- SEO básico.
- Domínio configurado.

### Painel administrativo básico

- Login.
- Dashboard simples.
- Produtos.
- Categorias.
- Pedidos.
- Integrações.
- Configurações da loja.

### Integração Bling

- Conectar conta Bling via OAuth.
- Utilizar JWT do Bling desde o início.
- Importar produtos.
- Importar categorias, quando aplicável.
- Sincronizar estoque básico.
- Criar/enviar pedido para o Bling.
- Receber webhooks principais.
- Registrar logs e erros.

### Envio

- Retirada na loja.
- Frete fixo.
- Frete grátis por valor mínimo.
- Código de rastreio manual.
- Futuro: Melhor Envio.

### Pagamento

- Fase inicial pode usar fluxo operacional via Bling ou pedido.
- Futuro: Mercado Pago conectado por OAuth.
- Futuro: checkout próprio com Pix/cartão.

## 6. Fora do escopo do MVP

- SaaS multi-tenant completo.
- Billing de planos.
- Painel master.
- Marketplace de apps.
- Múltiplos ERPs.
- Split de pagamento.
- WhatsApp com IA.
- Editor visual estilo Webflow.
- App mobile.
- Frente de caixa.
- Financeiro próprio.
- Nota fiscal própria dentro da Zalen.
- Logística própria completa.

## 7. Premissas

- O Bling é o ERP principal.
- O cliente manterá produtos/estoque preferencialmente no Bling.
- A Zalen manterá cache/local copy para performance e vitrine.
- A Zalen não deve depender do Bling em tempo real para renderizar páginas.
- Tokens externos nunca serão expostos no frontend.
