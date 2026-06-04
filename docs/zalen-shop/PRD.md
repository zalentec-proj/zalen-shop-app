# PRD — Zalen Shop Platform

## 1. Contexto

A Zalen Shop será uma plataforma de e-commerce customizável para empresas que precisam de lojas online próprias, com identidade visual personalizada, painel administrativo, catálogo, pedidos e integrações com sistemas externos.

A primeira implementação real é a loja Brasil Drones & Parts, conectada ao Bling. Essa loja é o primeiro caso de uso, não o limite do produto. A arquitetura deve permitir novas lojas, como a futura LB London conectada ao Mercos, usando o mesmo core da plataforma.

## 2. Objetivo do produto

Construir uma plataforma que permita criar, operar e evoluir lojas online personalizadas, mantendo um core comum de:

- stores;
- storefronts;
- admin por loja;
- catálogo;
- carrinho;
- pedidos;
- clientes;
- autenticação;
- permissões;
- conectores;
- logs;
- configurações.

## 3. Posicionamento

A Zalen Shop é uma plataforma de e-commerce customizável com conectores por loja.

Ela não substitui necessariamente ERPs como Bling ou Mercos. Ela atua como camada de vitrine, experiência de compra, operação digital e integração.

## 4. Princípio central

A Zalen Shop não é apenas uma loja virtual.

A Zalen Shop é uma base de e-commerce customizável com conectores por cliente.

## 5. Primeiros casos de uso

### Brasil Drones

Primeira loja/caso real da plataforma.

- Tipo: storefront customizado.
- ERP: Bling.
- Status: primeiro cliente.
- Foco: drones, peças, acessórios, catálogo técnico e operação via Bling.

### LB London

Segunda loja/caso futuro.

- Tipo: storefront customizado.
- ERP: Mercos.
- Status: planejado.
- Foco: nova loja conectada a outro ERP.

## 6. Usuários principais

### Comprador

- acessa a loja pública;
- visualiza produtos;
- navega por categorias;
- adiciona itens ao carrinho;
- realiza pedido/compra;
- acompanha status quando disponível.

### Lojista

- acessa o admin da própria loja;
- visualiza produtos;
- acompanha pedidos;
- configura integrações liberadas;
- gerencia dados operacionais;
- acessa apenas a própria store.

### Zalen Platform Owner/Admin

- gerencia a plataforma;
- pode acessar todas as lojas;
- configura lojas;
- habilita conectores;
- acompanha integrações;
- dá suporte;
- futuramente acessará uma área `/platform`.

## 7. Escopo MVP

### Storefront

- home da loja ativa;
- página de produto;
- página de categoria;
- carrinho;
- checkout/pedido;
- pedido confirmado;
- layout responsivo;
- SEO básico.

### Admin da loja

- login com identidade Zalen Shop;
- dashboard operacional;
- produtos;
- pedidos;
- integrações;
- configurações;
- status da loja;
- logs básicos.

### Core da plataforma

- stores;
- usuários;
- platform_users;
- store_memberships;
- catálogo;
- pedidos;
- integration_providers;
- store_integrations;
- logs;
- Supabase Cloud;
- Supabase Auth.

### Conectores MVP e planejados

Primeiro conector real:

- Bling para Brasil Drones.

Conectores planejados:

- Mercos para LB London;
- Mercado Pago;
- Melhor Envio;
- Asaas/Pagar.me futuramente;
- Meta/Instagram futuramente;
- WhatsApp/IA futuramente.

## 8. Fora do escopo inicial

- `/platform` completo;
- billing/planos;
- marketplace de apps;
- editor visual avançado;
- IA operacional;
- WhatsApp automático;
- multi-idioma;
- split de pagamento;
- relatórios avançados;
- app mobile.

## 9. Premissas

- A Zalen Shop deve ser multi-store ready desde o início.
- Cada loja deve ser isolada por `store_id`.
- Conectores pertencem ao core da plataforma.
- Cada loja ativa/configura seus conectores via `store_integrations`.
- Tokens e credenciais são sempre por loja.
- APIs externas nunca são chamadas diretamente do frontend.
- O MVP deve permanecer leve.
- Brasil Drones continua sendo o primeiro case com Bling.
- LB London/Mercos fica documentado como segundo case futuro.

## 10. Métricas iniciais de sucesso

- Storefront Brasil Drones funcionando.
- Admin protegido por Auth.
- Supabase Cloud como fonte de dados.
- Catálogo e pedidos por `store_id`.
- Brasil Drones operando com admin Zalen Shop.
- Bling documentado, pesquisado e integrado apenas após pesquisa oficial.
- Estrutura preparada para LB London/Mercos sem reescrever o core.
