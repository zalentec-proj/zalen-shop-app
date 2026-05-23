# Supabase Local Setup

Este projeto já possui `supabase/config.toml`, migration inicial e `supabase/seed.sql`.
O Docker precisa estar ativo para rodar a stack local.

## Referências Oficiais

- Supabase CLI: https://supabase.com/docs/guides/cli
- Desenvolvimento local: https://supabase.com/docs/guides/local-development
- Seeding local: https://supabase.com/docs/guides/local-development/seeding-your-database
- Next.js SSR client: https://supabase.com/docs/guides/auth/server-side/creating-a-client

## Instalar CLI

Opção via Homebrew:

```bash
brew install supabase/tap/supabase
```

Opção via npm, sem instalação global:

```bash
npm install supabase --save-dev
npx supabase --version
```

## Subir Supabase Local

Com Docker rodando:

```bash
npx supabase start
```

Se o CLI estiver instalado via Homebrew, também funciona:

```bash
supabase start
```

O comando imprime a `API URL`, `anon key`/`publishable key` e `service_role key`.

### Workaround observado em Mac Apple Silicon

Neste ambiente, a imagem `public.ecr.aws/supabase/realtime:v2.86.3` em `linux/arm64`
foi baixada com um arquivo interno corrompido (`libsudo_util.so.0.0.0` com `0B`).
O workaround usado foi remover apenas esse variant e deixar o Docker executar o
variant `linux/amd64` funcional:

```bash
docker pull --platform linux/amd64 public.ecr.aws/supabase/realtime:v2.86.3
docker image rm --force --platform linux/arm64 public.ecr.aws/supabase/realtime:v2.86.3
```

Também foi necessário subir sem `edge-runtime`, que não é usado nesta sprint:

```bash
npx supabase start --exclude edge-runtime
```

## Aplicar Migrations e Seed

Para recriar o banco local com migrations e executar `supabase/seed.sql`:

```bash
npx supabase db reset
```

Use esse comando apenas em ambiente local, porque ele reseta o banco local.

## Configurar `.env.local`

Copie o exemplo localmente:

```bash
cp .env.example .env.local
```

Preencha apenas no seu ambiente local:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-ou-publishable-key-do-cli>
SUPABASE_SECRET_KEY=<service-role-key-do-cli>
APP_URL=http://localhost:3000
```

Não commitar `.env.local`, tokens reais ou saída de terminal contendo secrets.

## Rodar App

```bash
npm run dev
```

Sem variáveis Supabase, o projeto continua usando fallback mockado para catálogo e pedidos.
Com as variáveis preenchidas, os repositories usam Supabase local.

## Cuidados de Segurança

- RLS permanece ativa nas tabelas.
- `SUPABASE_SECRET_KEY` é server-side apenas.
- Client Components só podem usar variáveis `NEXT_PUBLIC_`.
- Não logar tokens, URLs com credenciais ou payloads sensíveis.
- Não usar service role em browser/client components.
- Bling continua sem integração real nesta sprint.
