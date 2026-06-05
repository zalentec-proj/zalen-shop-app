# Domain and Store Resolution — Zalen Shop

## 1. Objetivo

A Zalen Shop deve evoluir para resolver a loja ativa pelo host da requisição, de forma parecida com plataformas SaaS de e-commerce como a Nuvemshop: cada loja possui um endereço dentro do domínio da plataforma e, em uma fase posterior, pode usar um domínio próprio.

No MVP atual, `localhost:3000` continua usando Brasil Drones como fallback por meio da store ativa fixa.

Domínios definidos para esta fase:

- `www.zalenshop.com.br` é a landing pública da Zalen Shop e vive em outro projeto.
- `app.zalenshop.com.br` é este app principal, responsável por login, admin e OAuth.
- `brasil-drones.zalenshop.com.br` será o storefront futuro da Brasil Drones por subdomínio.

## 2. Tipos de experiência

### Storefront

O storefront é a loja pública vista pelo comprador.

Exemplos futuros:

- `brasil-drones.zalenshop.com.br`
- `lb-london.zalenshop.com.br`
- `www.brasildrones.com.br`

O storefront deve usar a identidade visual da loja ativa.

### Admin da loja

O admin da loja é o painel operacional usado pelo cliente para gerenciar produtos, pedidos, integrações e configurações.

Exemplos futuros:

- `brasil-drones.zalenshop.com.br/admin`
- `lb-london.zalenshop.com.br/admin`

O admin deve usar identidade Zalen Shop, com a loja ativa exibida como contexto.

### Platform admin

O platform admin será uma área futura para a equipe Zalen gerenciar múltiplas lojas, suporte, conectores, logs globais e planos.

Exemplo futuro:

- `app.zalenshop.com.br/platform`

Essa área não será implementada no MVP atual.

## 3. Modelo por subdomínio

O padrão principal da plataforma será:

```txt
{storeSlug}.zalenshop.com.br
```

Exemplos:

```txt
brasil-drones.zalenshop.com.br
lb-london.zalenshop.com.br
```

O `storeSlug` deve ser resolvido contra a tabela `stores.slug`. Depois disso, todas as queries de dados da loja devem continuar filtrando por `store_id`.

Fluxo conceitual:

```txt
Host da request
↓
Resolver storeSlug
↓
Buscar stores.slug
↓
Obter store_id
↓
Executar services/repositories com store_id
```

## 4. Domínio próprio do cliente

Em uma fase futura, uma loja poderá apontar um domínio próprio para a Zalen Shop.

Exemplo:

```txt
www.brasildrones.com.br
```

Nesse caso, o host não terá `storeSlug` no subdomínio da Zalen. A resolução deverá consultar uma configuração de domínios vinculados à loja, por exemplo uma futura tabela `store_domains`.

Fluxo conceitual futuro:

```txt
Host da request
↓
Se for *.zalenshop.com.br, resolver por subdomínio
↓
Se for domínio próprio, resolver por domínio cadastrado
↓
Obter store_id
```

O domínio próprio deve servir principalmente o storefront público. O admin da loja deve permanecer no domínio da plataforma.

## 5. Por que o admin fica no domínio da plataforma

O admin deve ficar em domínio/subdomínio controlado pela Zalen para manter:

- autenticação centralizada;
- cookies e sessão sob domínio da plataforma;
- segurança e isolamento entre storefront público e área operacional;
- suporte e auditoria mais simples;
- consistência visual e operacional entre lojas;
- menor risco de problemas com DNS, certificado e domínio do cliente.

Assim, mesmo que a Brasil Drones use `www.brasildrones.com.br` como storefront, o admin deve ser acessado em:

```txt
brasil-drones.zalenshop.com.br/admin
```

## 6. Ambientes locais

Durante o MVP, `localhost:3000` deve continuar funcionando e cair no fallback Brasil Drones.

Exemplo atual:

```txt
localhost:3000
localhost:3000/admin
```

Para testar subdomínios localmente, usar `lvh.me`, que resolve para `127.0.0.1`.

Exemplos futuros de desenvolvimento:

```txt
brasil-drones.lvh.me:3000/admin
lb-london.lvh.me:3000/admin
```

Resolução esperada:

- `localhost:3000` → fallback Brasil Drones no MVP;
- `brasil-drones.lvh.me:3000` → `stores.slug = brasil-drones`;
- `lb-london.lvh.me:3000` → `stores.slug = lb-london`;
- `app.lvh.me:3000/platform` → futuro platform admin local.

## 7. Hosts reservados

Alguns subdomínios devem ser reservados para a própria plataforma e não podem ser usados como `storeSlug`.

Reservados inicialmente:

- `app`;
- `www`;
- `api`;
- `admin`;
- `assets`;
- `static`;
- `support`;

## 8. Comportamento atual do MVP

Hoje o projeto ainda usa uma store ativa fixa para Brasil Drones.

Isso deve continuar até a etapa de implementação da resolução dinâmica.

Regras atuais:

- não alterar `ACTIVE_STORE_ID` nesta fase;
- não alterar comportamento de `localhost`;
- não redirecionar `/` para `/login` ainda, porque hoje `/` renderiza o storefront Brasil Drones via fallback MVP;
- reavaliar redirect de `app.zalenshop.com.br/` para `/login` quando a resolução por host for implementada;
- não criar `/platform`;
- não mudar rotas públicas;
- não alterar Bling, Mercos ou qualquer conector real;
- documentar a estratégia antes da implementação.

## 9. Fase futura de implementação

Quando esta estratégia for implementada, a resolução de store deve ser server-side.

Itens esperados:

- helper `resolveStoreFromHost`;
- normalização segura do host;
- lista de subdomínios reservados;
- lookup por `stores.slug`;
- fallback explícito para Brasil Drones apenas em desenvolvimento/MVP;
- possível tabela futura `store_domains`;
- testes para `localhost`, `lvh.me`, `{storeSlug}.zalenshop.com.br` e domínio próprio;
- repositories e services recebendo `storeId` resolvido fora deles.
