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
- `/pedido/[id]` com capacidade temporária emitida pelo servidor
- futuras páginas públicas da loja

Navegação, catálogo, carrinho e checkout convidado são públicos. O comprador não
precisa criar conta, senha ou validar um código antes do pagamento. Uma sessão
autenticada continua oferecendo checkout expresso com dados salvos, mas é
opcional.

O comprador informa e-mail, entrega e CPF/CNPJ no checkout. CPF/CNPJ continuam
sendo validados server-side para definir `customer_type` e a tabela de preço
aplicável. No checkout convidado, esses dados ficam no snapshot imutável do
pedido e não atualizam `customers` ou endereços existentes.

Depois que o pedido é criado, o servidor emite um cookie HttpOnly temporário que
contém uma capacidade aleatória vinculada à tentativa idempotente, `store_id` e
pedido. O cookie não contém PII e só permite pagar, consultar status e abrir
aquele pedido durante a janela definida. Um e-mail verificado pelo Supabase Auth
pode posteriormente criar/vincular o cliente e reivindicar pedidos convidados
da mesma loja e do mesmo e-mail. As mensagens de login continuam genéricas para
evitar enumeração de contas.

## 4. Rotas protegidas

Rotas protegidas:

- `/admin`
- `/admin/*`
- futuras rotas operacionais

- `/platform`
- `/platform/*`
- `/lojas` (seletor dos vínculos do usuário)

## 5. Platform roles

Usuários da Zalen com acesso global:

- `platform_owner`
- `platform_admin`

Permissão:

- podem acessar qualquer store;
- podem dar suporte;
- podem configurar conectores;
- acessam `/platform` e a listagem `/platform/lojas` na etapa mínima.

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

## 9. Destino após login e loja atual

Com `next` válido, o servidor confere o acesso ao destino solicitado. Sem loja
específica no login central, papel global segue para `/platform`; um vínculo
ativo segue para o admin daquela loja; múltiplos vínculos seguem para `/lojas`.
Conta sem vínculo recebe estado de acesso indisponível, sem fallback de loja.
A listagem global exige papel global na camada de dados e mostra também lojas
em preparação ou inativas. Estas não recebem link para admin operacional.

O subdomínio/domínio próprio já resolve a store server-side. A constante abaixo
permanece como fallback local legado, não como destino do login central.

O fallback local legado usa a constante da Brasil Drones:

```txt
BRASIL_DRONES_STORE_ID = 00000000-0000-0000-0000-000000000001
```

O contexto da loja em requisições públicas e administrativas vem do host.

## 10. Criação de primeiro admin

O primeiro usuário Zalen deve ser criado como `platform_owner` em staging.

Regras:

- usar script server-side;
- exigir `APP_ENV=staging`;
- exigir confirmação explícita;
- não logar senha;
- não logar tokens;
- nunca rodar em produção sem processo específico.

Para atribuir o primeiro papel global a uma conta já existente em produção:

1. O responsável identifica explicitamente a conta que deve ser dona.
2. A operação administrativa server-side confere o projeto correto, a existência
   de exatamente uma conta correspondente e seu e-mail já verificado.
3. Atribuir `platform_owner` em `platform_users` com operação idempotente,
   preservando senha, sessão e vínculos de loja. Não criar endpoint público de promoção.
4. Ler o papel persistido e registrar a autorização e o resultado no handoff,
   sem dados de autenticação ou credenciais.

Esse procedimento não cria uma conta Auth nem substitui o bootstrap de staging.

Se o responsável autorizar criar uma conta nova para ser dona, usar a API
administrativa oficial do Supabase com senha aleatória descartada e
`email_confirm: false`, sem inserir manualmente em `auth.users` nem registrar
credenciais. O papel global fica associado ao novo ID Auth; a conta permanece
pendente de ativação pelo próprio usuário, que solicita “Esqueci minha senha”
para comprovar o e-mail e definir sua senha. A criação não envia mensagem
automaticamente. Não marcar o e-mail como confirmado para pular essa etapa.

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
