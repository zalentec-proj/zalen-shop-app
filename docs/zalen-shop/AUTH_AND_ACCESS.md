# Auth e Acesso — Zalen Shop

## 1. Princípio

A autenticação identifica o usuário. A autorização decide o que ele pode acessar.

A Zalen Shop deve separar:

- acesso global da Zalen;
- acesso operacional de cada loja.

## 2. Identidade visual

- `/login` usa identidade Zalen Shop.
- `/admin` usa shell visual da Zalen Shop.
- A loja ativa aparece como contexto dentro do admin.
- Storefront público usa a identidade da loja ativa.

## 3. Rotas públicas

Rotas públicas do storefront:

- `/`
- `/produto/[slug]`
- `/categoria/[slug]`
- `/carrinho`
- `/conta/entrar`
- `/conta/cadastro`
- futuras páginas públicas da loja

Navegação, catálogo e carrinho são públicos. Para iniciar pagamento, o comprador
não precisa criar senha, mas precisa validar o e-mail com código enviado pela
loja. Essa validação cria ou reutiliza a identidade Supabase Auth do comprador e
vincula `customers.auth_user_id` ao cadastro privado da store antes da criação da
preferência de pagamento.

O comprador informa e-mail, entrega e CPF/CNPJ no checkout. CPF/CNPJ continuam
sendo validados server-side para definir `customer_type` e a tabela de preço
aplicável. Mensagens de validação de e-mail devem ser genéricas o suficiente para
evitar enumeração de contas.

## 4. Rotas protegidas

Rotas protegidas:

- `/admin`
- `/admin/*`
- futuras rotas operacionais

Futuro:

- `/platform`
- `/platform/*`

## 5. Platform roles

Usuários da Zalen com acesso global:

- `platform_owner`
- `platform_admin`

Permissão:

- podem acessar qualquer store;
- podem dar suporte;
- podem configurar conectores;
- futuramente acessarão `/platform`.

## 6. Store roles

Usuários de loja:

- `store_owner`
- `store_admin`
- `store_operator`
- `store_viewer`

Permissão:

- acessam apenas a própria `store_id`;
- não podem ver outras lojas;
- não podem acessar área global da Zalen.

## 7. Fluxo de autorização para /admin

```txt
Usuário acessa /admin
↓
Supabase Auth verifica sessão
↓
Servidor obtém user_id
↓
Verifica platform_users
↓
Se não houver, verifica store_memberships da store ativa
↓
Permite ou nega acesso
```

## 8. Regra canAccessStore

Um usuário pode acessar uma store se:

- é `platform_owner`; ou
- é `platform_admin`; ou
- tem `store_membership` naquela store.

## 9. Store atual no MVP

Enquanto houver apenas Brasil Drones, a store atual pode ser centralizada em uma constante:

```txt
BRASIL_DRONES_STORE_ID = 00000000-0000-0000-0000-000000000001
```

Essa abordagem é temporária e deve evoluir para resolução por domínio/subdomínio quando houver múltiplas lojas.

## 10. Criação de primeiro admin

O primeiro usuário Zalen deve ser criado como `platform_owner` em staging.

Regras:

- usar script server-side;
- exigir `APP_ENV=staging`;
- exigir confirmação explícita;
- não logar senha;
- não logar tokens;
- nunca rodar em produção sem processo específico.

## 11. O que não implementar agora

- login social;
- `/platform` completo;
- permissões granulares por recurso;
- times/equipes avançadas;
- billing.

## 12. Segurança

- Nunca usar service role em Client Components.
- Nunca usar frontend como barreira de segurança.
- Toda proteção deve acontecer server-side.
- RLS deve reforçar isolamento por `store_id`.
- Tokens de sessão não devem ser logados.
