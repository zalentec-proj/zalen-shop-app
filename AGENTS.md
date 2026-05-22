# AGENTS.md — Instruções para IA, Codex e IDE

Este projeto começou como uma apresentação visual da loja Brasil Drones, mas será evoluído para uma loja real single-tenant, preparada para virar uma plataforma Zalen Shop no futuro.

## Objetivo técnico

Construir uma loja online para um cliente único, com base visual já existente, integração com Bling e arquitetura modular preparada para evolução multi-tenant.

## Stack alvo

- React
- TypeScript
- Vite inicialmente, podendo migrar para Next.js quando o backend crescer
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- React Hook Form
- TanStack Query quando houver painel/admin mais robusto
- Lucide React
- Motion/Framer Motion com moderação

## Regras de arquitetura

- Não misturar regra de negócio dentro de componentes visuais.
- Não chamar Bling, Mercado Pago ou Melhor Envio direto do frontend.
- Toda integração externa deve passar por um service/connector no backend.
- Mesmo sendo single-tenant, tabelas principais devem nascer com `store_id`.
- Todo input externo deve ser validado com schema.
- O frontend não deve ser fonte de verdade para preço, estoque, permissão, frete ou total de pedido.

## Segurança obrigatória

Nunca:

- Expor tokens no frontend.
- Salvar tokens em logs.
- Colocar tokens em localStorage.
- Concatenar SQL com input do usuário.
- Desabilitar RLS para resolver problema rápido.
- Aceitar webhook sem validação quando o provedor oferecer assinatura.
- Processar webhook sem idempotência.
- Permitir HTML ou JavaScript livre no editor da loja no MVP.

## Módulos prioritários

1. Storefront Brasil Drones.
2. Catálogo.
3. Carrinho/pedido.
4. Painel administrativo básico.
5. Integração Bling.
6. Segurança e logs.
7. Temas/template preparado para evolução.

## Regra central

A Zalen é a vitrine e experiência de venda. O Bling é o ERP operacional.
