# Supabase Setup

Este projeto já possui `supabase/config.toml`, migration inicial e `supabase/seed.sql`.
O Docker precisa estar ativo apenas para rodar a stack local.

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
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-do-cli>
SUPABASE_SECRET_KEY=<service-role-key-do-cli>
APP_URL=http://localhost:3000
```

Não commitar `.env.local`, tokens reais ou saída de terminal contendo secrets.

## Rodar App

```bash
npm run dev
```

Sem variáveis Supabase, o projeto continua usando fallback mockado para catálogo e pedidos.
Com as variáveis preenchidas, os repositories usam Supabase local ou cloud, conforme a URL.

## Supabase Cloud

O projeto cloud atual está linkado via Supabase CLI:

```bash
npx supabase projects list
npx supabase migration list --linked
```

Para aplicar migrations pendentes no projeto cloud linkado:

```bash
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
```

Para aplicar o seed idempotente no cloud:

```bash
npx supabase db query --linked --file supabase/seed.sql
```

Para validar contagens principais:

```bash
npx supabase db query --linked "select 'products' as table_name, count(*) from products union all select 'categories', count(*) from categories;"
```

### `.env.local` para Cloud

Use a URL do projeto cloud e as keys da tela de API do Supabase. No setup atual,
as keys compatíveis validadas foram `anon` para o client e `service_role` para o server:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_SECRET_KEY=<service-role-key>
APP_URL=https://app.zalenshop.com.br
```

`SUPABASE_SERVICE_ROLE_KEY` é o nome preferido. `SUPABASE_SECRET_KEY` continua aceito
por compatibilidade com setups anteriores.

### Redirect URLs de Auth

Para recuperação de senha no admin, configure em Supabase Dashboard →
Authentication → URL Configuration:

- Site URL: `https://app.zalenshop.com.br`
- Redirect URLs:

```text
http://localhost:3000/auth/callback
https://app.zalenshop.com.br/auth/callback
```

Em produção, `Site URL` e `APP_URL` não podem ficar como `http://localhost:3000`;
caso contrário os e-mails de recuperação podem redirecionar para o ambiente local.

O fluxo usado pelo app é:

1. `/login/forgot` chama `resetPasswordForEmail`.
2. O e-mail redireciona para `/auth/callback?next=/login/update-password`.
3. `/auth/callback` troca o `code` por sessão segura.
4. `/login/update-password` chama `updateUser({ password })`.

Se houver variáveis Supabase já exportadas no terminal, elas podem sobrescrever o
`.env.local`. Para validar usando apenas o arquivo local:

```bash
env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_SECRET_KEY npm run dev
env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_SECRET_KEY npm run build
```

Não commitar `.env.local`, access tokens, `service_role`, `secret key` ou saídas de terminal
que contenham credenciais.

## Cuidados de Segurança

- RLS permanece ativa nas tabelas.
- `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_SECRET_KEY` são server-side apenas.
- Client Components só podem usar variáveis `NEXT_PUBLIC_`.
- Não logar tokens, URLs com credenciais ou payloads sensíveis.
- Não usar service role em browser/client components.
- Bling continua sem integração real nesta sprint.
