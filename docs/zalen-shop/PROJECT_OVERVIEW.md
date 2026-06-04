# Zalen Shop — Project Overview

## Visão

A Zalen Shop é uma plataforma de e-commerce customizável criada para permitir que diferentes empresas tenham lojas online próprias, com identidade visual personalizada, painel administrativo, catálogo, pedidos e integrações com ERPs, pagamentos, envio e canais de venda.

A plataforma nasce a partir da primeira loja real, Brasil Drones, mas não deve ser construída como uma solução exclusiva para esse cliente. A arquitetura deve permitir a criação de novas lojas, como LB London, reaproveitando o mesmo core da Zalen Shop.

## Princípio central

A Zalen Shop não é apenas uma loja virtual.

A Zalen Shop é uma base de e-commerce customizável com conectores por cliente.

## Casos iniciais

### Brasil Drones

Primeiro cliente/caso real da plataforma.

- Loja: Brasil Drones & Parts
- Tipo: loja customizada
- ERP: Bling
- Status: primeiro caso de uso
- Foco: drones, peças, acessórios, catálogo técnico e operação via Bling

### LB London

Segundo cliente/caso futuro.

- Loja: LB London
- Tipo: loja customizada futura
- ERP: Mercos
- Status: planejado
- Foco: nova loja conectada a outro ERP

## Estrutura conceitual

```txt
Zalen Shop Platform
├── Stores
├── Storefronts
├── Admin por loja
├── Autenticação
├── Catálogo
├── Pedidos
├── Clientes
├── Conectores
├── Logs
├── Configurações
└── Futuro Platform Admin
```

## Separação de responsabilidades

### Zalen Shop Core

Responsável por:

- modelo interno de loja;
- catálogo interno;
- pedidos;
- usuários e permissões;
- integrações;
- logs;
- segurança;
- rotas administrativas;
- estrutura multi-store.

### Storefront

Responsável por:

- experiência pública da loja;
- identidade visual do cliente;
- exibição de produtos;
- categorias;
- carrinho;
- checkout/pedido;
- SEO.

### Admin da loja

Responsável por:

- operação da loja;
- produtos;
- pedidos;
- clientes;
- integrações;
- configurações;
- status de sincronização;
- logs operacionais.

### Conectores

Responsáveis por traduzir dados entre o core da Zalen Shop e sistemas externos.

Exemplos:

- Bling;
- Mercos;
- Mercado Pago;
- Melhor Envio;
- Meta/Instagram;
- WhatsApp/IA futuramente.

## Identidade visual

- Login e admin usam identidade Zalen Shop.
- Storefront público usa identidade da loja ativa.
- Brasil Drones usa identidade Brasil Drones no storefront.
- LB London usará identidade própria quando for criada.

## Regra de ouro

Nenhuma loja deve chamar diretamente APIs externas.

Fluxo correto:

```txt
Storefront/Admin
↓
Zalen Shop Core
↓
Connector Service
↓
API externa
```
