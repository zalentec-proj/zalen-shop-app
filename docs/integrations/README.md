# Integrações — Zalen Shop / Brasil Drones

## Visão geral

Este diretório concentra toda a documentação técnica das integrações externas do projeto.

A regra central é simples:

> **Documentação oficial primeiro. Código depois.**

Nenhuma integração pode ser implementada com endpoints, payloads, headers, escopos ou fluxos OAuth inventados ou assumidos. Toda implementação deve ser precedida de pesquisa na documentação oficial do provedor e registro no arquivo de pesquisa técnica correspondente.

---

## Integrações previstas

| Provedor | Finalidade | Status |
|---|---|---|
| **Bling** | ERP operacional — produtos, estoque, pedidos, notas | Beta operacional |
| **Mercado Pago** | Pagamentos — Pix, cartão, boleto via Checkout Pro | Beta Checkout Pro |
| **Melhor Envio** | Cotação e geração de etiquetas de frete | Planejado |
| **Asaas** | Pagamentos alternativos (futuro) | Futuro |
| **Pagar.me** | Pagamentos alternativos (futuro) | Futuro |

---

## Regra de ouro

```
Documentação oficial → Pesquisa técnica → Revisão de segurança → Implementação
```

Nunca pule etapas. Se a documentação oficial não estiver clara, registre a dúvida em "Dúvidas pendentes" no arquivo de pesquisa e aguarde validação.

---

## Alertas de segurança obrigatórios

### ❌ Nunca expor token no frontend
Tokens de acesso (Bling, Mercado Pago, Melhor Envio) são segredos de servidor. Nunca devem aparecer em código client-side, variáveis `NEXT_PUBLIC_*`, respostas de API ou HTML renderizado.

### ❌ Nunca salvar token em log
Logs de erro, console.log, Sentry, Datadog ou qualquer sistema de observabilidade não devem conter tokens, refresh tokens ou credenciais.

### ❌ Nunca implementar webhook sem validação
Todo webhook deve ter sua assinatura/HMAC validada antes de qualquer processamento. Webhooks sem validação são vetores de ataque.

### ❌ Nunca implementar integração real sem idempotência
Pagamentos, pedidos e sincronizações devem ser idempotentes. Processar o mesmo evento duas vezes não pode gerar duplicidade de cobrança, pedido ou estoque.

### ❌ Nunca inventar endpoints
Se o endpoint não está na documentação oficial, ele não existe. Não assuma URLs, parâmetros ou comportamentos.

---

## Arquivos deste diretório

| Arquivo | Descrição |
|---|---|
| `official-sources.md` | Links oficiais de cada provedor |
| `research-checklist.md` | Checklist padrão antes de implementar |
| `bling-research-template.md` | Template de pesquisa técnica — Bling |
| `mercado-pago-research-template.md` | Template de pesquisa técnica — Mercado Pago |
| `melhor-envio-research-template.md` | Template de pesquisa técnica — Melhor Envio |

---

## Fluxo de implementação

```
1. Consultar official-sources.md
2. Ler a documentação oficial do provedor
3. Preencher o arquivo de pesquisa técnica
4. Revisar segurança com SECURITY.md
5. Criar tipos em src/modules/integrations/{provedor}/{provedor}.types.ts
6. Implementar conector em src/modules/integrations/{provedor}/{provedor}.connector.ts
7. Criar Route Handler em src/app/api/ (server-side only)
8. Testar em sandbox antes de produção
```
