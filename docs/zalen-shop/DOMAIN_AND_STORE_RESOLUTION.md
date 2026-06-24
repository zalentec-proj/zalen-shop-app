# Domain and Store Resolution — Zalen Shop

## 1. Objetivo

A Zalen Shop deve evoluir para resolver a loja ativa pelo host da requisição, de forma parecida com plataformas SaaS de e-commerce como a Nuvemshop: cada loja possui um endereço dentro do domínio da plataforma e, em uma fase posterior, pode usar um domínio próprio.

No MVP atual, `localhost`/`127.0.0.1` continuam usando Brasil Drones como fallback, mas o app já possui resolução server-side por subdomínio para o padrão `{storeSlug}.zalenshop.com.br` e para desenvolvimento com `{storeSlug}.lvh.me`.

Domínios definidos para esta fase:

- `www.zalenshop.com.br` é a landing pública da Zalen Shop e vive em outro projeto.
- `app.zalenshop.com.br` é o host central da aplicação, usado para login e fluxos compartilhados.
- `brasil-drones.zalenshop.com.br` é o subdomínio padrão da Brasil Drones para storefront e `/admin`.

## 2. Tipos de experiência

### Storefront

O storefront é a loja pública vista pelo comprador.

Exemplos:

- `brasil-drones.zalenshop.com.br`
- `lb-london.zalenshop.com.br`
- `www.brasildrones.com.br`

O storefront deve usar a identidade visual da loja ativa.

### Admin da loja

O admin da loja é o painel operacional usado pelo cliente para gerenciar produtos, pedidos, integrações e configurações.

Exemplos:

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

Exemplos de desenvolvimento:

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

O projeto agora resolve a loja por host nos pontos principais server-side:

- storefront `/`;
- produto e categoria;
- `/admin`;
- configurações da loja;
- ações de catálogo/clientes;
- checkout e identificação de cliente;
- rotas internas do conector Bling acionadas pelo painel.

Regras atuais:

- `localhost` e `127.0.0.1` continuam caindo no fallback Brasil Drones;
- `brasil-drones.lvh.me:3001` resolve `stores.slug = brasil-drones` em desenvolvimento;
- `brasil-drones.zalenshop.com.br` resolve `stores.slug = brasil-drones` em produção/staging;
- subdomínios reservados, como `app`, `www` e `api`, não são tratados como loja;
- `ACTIVE_STORE_ID` permanece apenas como fallback/static build e em webhooks externos que ainda não carregam contexto de loja no payload;
- não criar `/platform`;
- não alterar comportamento real de Bling, Mercos ou qualquer conector externo sem pesquisa técnica aprovada.

## 9. Próximas fases

Itens futuros:

- criar tabela `store_domains` para domínios próprios;
- associar domínio próprio validado a uma loja;
- decidir redirect de `app.zalenshop.com.br/` para login ou seletor de loja;
- implementar seletor de loja para contas com mais de uma `store_membership`;
- migrar webhooks externos para descobrir loja por metadados seguros do provedor quando disponível;
- adicionar testes automatizados específicos para `localhost`, `lvh.me`, `{storeSlug}.zalenshop.com.br` e domínio próprio.
