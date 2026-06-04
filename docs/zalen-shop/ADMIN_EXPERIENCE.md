# Admin Experience — Zalen Shop

## 1. Função do admin

O admin é o painel operacional da loja dentro da plataforma Zalen Shop.

Ele não é o storefront da loja e não deve copiar a estética de venda da loja pública.

## 2. Identidade visual

- Admin usa identidade Zalen Shop.
- Loja ativa aparece como contexto.
- Brasil Drones não deve ser a marca principal do admin.
- LB London usará o mesmo admin quando for criada.

## 3. Direção visual

O admin deve ser:

- minimalista;
- denso;
- operacional;
- dark mode;
- tipografia menor;
- cards compactos;
- tabelas legíveis;
- estrutura SaaS profissional.

Evitar:

- visual de landing page;
- textos grandes demais;
- cards gigantes;
- excesso de glow;
- excesso de ilustração;
- identidade da loja dominando o sistema.

## 4. Estrutura de navegação

MVP:

- Visão geral
- Produtos
- Pedidos
- Integrações
- Configurações

Futuro:

- Clientes
- Usuários
- Logs
- Temas
- Domínios
- Relatórios

## 5. Dashboard

Deve mostrar:

- status da loja;
- fonte dos dados;
- produtos;
- pedidos;
- integrações;
- alertas operacionais.

Não deve tentar ser um BI completo no MVP.

## 6. Produtos

O admin pode listar e editar campos operacionais do catálogo.

No MVP:

- listar produtos;
- editar status;
- editar estoque quando a fonte permitir;
- mostrar fonte de dados;
- impedir edição quando fonte for mock.

Com ERP conectado, definir cuidadosamente quais campos são editáveis no Zalen e quais vêm do ERP.

## 7. Pedidos

O admin deve listar pedidos e seus status.

Futuro:

- ver detalhe do pedido;
- enviar para ERP;
- reprocessar envio;
- acompanhar pagamento;
- acompanhar envio/rastreio.

## 8. Integrações

A tela de integrações deve mostrar:

- conectores disponíveis para a loja;
- conectores conectados;
- conectores planejados;
- último sync;
- erros;
- ações de teste/conexão.

Brasil Drones deve ver Bling como conector principal.

Mercos não deve aparecer como conector ativo da Brasil Drones, mas pode existir no catálogo global da plataforma.

## 9. Configurações

Configurações iniciais:

- dados da loja;
- logo/contexto da loja;
- contatos;
- domínio;
- integrações;
- preferências operacionais.

## 10. Regras de implementação

- Admin deve usar componentes próprios de sistema.
- Não usar componentes promocionais do storefront dentro do admin.
- Não chamar APIs externas diretamente no client.
- Ações sensíveis devem ser Server Actions ou Route Handlers.
- Validar permissões no servidor.
- Não expor tokens.
