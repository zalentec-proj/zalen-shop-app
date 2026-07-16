# Pesquisa técnica — Vercel Domains API

## Escopo

Integração server-side usada pela Zalen Shop para associar domínios já adquiridos
ao projeto Vercel, consultar configuração, verificar propriedade, configurar
redirects e remover somente a associação com o projeto.

Compra, transferência, renovação, nameservers, registros MX e gestão de e-mail
ficam fora deste escopo.

## Fontes oficiais consultadas

- REST API: https://vercel.com/docs/rest-api
- Adicionar domínio ao projeto: https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project
- Consultar domínio do projeto: https://vercel.com/docs/rest-api/projects/get-a-project-domain
- Atualizar domínio/redirect: https://vercel.com/docs/rest-api/projects/update-a-project-domain
- Verificar domínio: https://vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain
- Consultar configuração DNS/TLS: https://vercel.com/docs/rest-api/reference/endpoints/domains/get-a-domains-configuration
- Configurar domínio próprio: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Remover domínio: https://vercel.com/docs/domains/working-with-domains/remove-a-domain
- Erros da API: https://vercel.com/docs/rest-api/errors

Pesquisa revisada em 2026-07-16.

## Autenticação e escopo

- Base URL: `https://api.vercel.com`.
- Header: `Authorization: Bearer <VERCEL_API_TOKEN>`.
- Recursos do time recebem `teamId=<VERCEL_TEAM_ID>` na query.
- O projeto é sempre o `VERCEL_PROJECT_ID` configurado no servidor.
- Token, projeto e time nunca são enviados ao browser, gravados em eventos ou
  registrados em logs.

## Endpoints usados

| Operação | Método e endpoint |
|---|---|
| Adicionar ao projeto | `POST /v10/projects/{projectId}/domains` |
| Consultar no projeto | `GET /v9/projects/{projectId}/domains/{domain}` |
| Verificar propriedade | `POST /v9/projects/{projectId}/domains/{domain}/verify` |
| Configuração DNS/TLS | `GET /v6/domains/{domain}/config` com `projectIdOrName` |
| Configurar/limpar redirect | `PATCH /v9/projects/{projectId}/domains/{domain}` |
| Remover do projeto | `DELETE /v9/projects/{projectId}/domains/{domain}` |

O cadastro envia somente `{ "name": hostname }`. A implementação não envia
`force`: um domínio associado a outro projeto nunca é tomado automaticamente.

Redirect permanente usa `redirectStatusCode = 308`. O target é um hostname
normalizado, nunca uma URL fornecida livremente pelo navegador.

## Respostas relevantes

O domínio de projeto informa:

- `name`;
- `apexName`;
- `projectId`;
- `verified`;
- `verification[]` com desafio TXT quando necessário;
- `redirect` e `redirectStatusCode`.

A configuração informa:

- `configuredBy` (`A`, `CNAME`, `http`, `dns-01` ou `null`);
- `acceptedChallenges`;
- `recommendedIPv4`, ordenado por `rank`;
- `recommendedCNAME`, ordenado por `rank`;
- `misconfigured`.

Os valores recomendados pela resposta são persistidos e exibidos ao lojista.
IP e CNAME não são fixados no código.

## DNS, propriedade e SSL

1. `verified = false` leva a `pending_ownership` e exibe os desafios TXT.
2. `misconfigured = true` leva a `pending_dns` e exibe os registros recomendados.
3. DNS aceito ainda exige uma chamada HTTPS ao endpoint
   `/.well-known/zalen-domain-verification` no hostname cadastrado.
4. Enquanto HTTPS, certificado ou roteamento não chegam ao projeto/configuração
   esperada, o estado permanece `pending_ssl`.
5. Somente a combinação de associação ao projeto, propriedade, DNS e probe HTTPS
   produz `ready`.

Para apex, a resposta da Vercel fornece valores A recomendados. Para subdomínio,
fornece CNAME recomendado. O lojista continua responsável por aplicar esses
registros no registrador.

## Limites, retries e erros

A API expõe `X-RateLimit-Limit`, `X-RateLimit-Remaining` e
`X-RateLimit-Reset`. O cliente usa timeout de 10 segundos, códigos internos
seguros e não persiste a resposta bruta.

Mapeamento operacional:

- `401` → `provider_unauthorized`;
- `403` → `provider_forbidden`;
- `404` → `provider_not_found`;
- `409` → `domain_conflict`;
- `429` → `provider_rate_limited`;
- `402`/upgrade necessário → `provider_quota`;
- `5xx` → `provider_unavailable`;
- timeout → `provider_timeout`.

Falhas recebem backoff exponencial entre cinco minutos e 24 horas. “Verificar
agora” tem rate limit persistente. Cadastro repetido consulta o domínio no
projeto para manter idempotência; conflito com outro projeto permanece falha e
não usa `force`.

## Remoção

`DELETE` remove apenas o hostname do projeto da Zalen. A operação não compra,
transfere ou apaga o domínio da conta do registrador e não modifica outros
registros DNS. `404` durante retry é tratado como remoção já concluída.

## Variáveis server-side

- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`
- `DOMAIN_SELF_SERVICE_ENABLED`
- `DOMAIN_SELF_SERVICE_STORE_ALLOWLIST`

O rollout inicial usa `DOMAIN_SELF_SERVICE_ENABLED=false`. Nenhuma variável
possui prefixo `NEXT_PUBLIC_`.
