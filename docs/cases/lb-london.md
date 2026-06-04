# Case — LB London

## Visão

LB London é um segundo case futuro previsto para a Zalen Shop.

Este case deve validar a capacidade da plataforma de atender outra loja, com identidade própria e ERP diferente do Brasil Drones.

## Tipo

- Storefront customizado futuro.
- Admin Zalen Shop.
- ERP: Mercos.
- Status: planejado.

## Objetivo

Provar que o core da Zalen Shop não está acoplado à Brasil Drones ou ao Bling.

## Integração principal

### Mercos

O Mercos será tratado como conector ERP futuro.

Características previstas:

- ApplicationToken;
- CompanyToken;
- sandbox;
- homologação;
- throttling 429;
- sync incremental;
- webhooks com HMAC-SHA256.

## Regras

- LB London terá `store_id` próprio.
- LB London não acessa dados da Brasil Drones.
- Brasil Drones não acessa dados da LB London.
- Zalen pode acessar ambas via platform role.
- O conector Mercos deve implementar a mesma interface conceitual de ERP.
