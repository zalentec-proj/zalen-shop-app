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

A navegação evoluiu do MVP enxuto para uma estrutura SaaS operacional em grupos.
Ela deve continuar compacta, mas já preparada para crescimento da plataforma.

Grupos atuais:

- Operação: Visão geral, Pedidos, Produtos, Clientes.
- Canais: Loja online e canais futuros.
- Conectores: Integrações e ERP principal.
- Configuração: Pagamentos, Envios, Domínios e Configurações.

Futuro:

- Usuários.
- Logs.
- Temas.
- Relatórios.

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

Atual:

- listar pedidos com cliente, pagamento, status e total;
- mostrar estado de envio para ERP;
- permitir reprocessamento manual do envio Bling quando houver erro/pendência.

Futuro:

- ver detalhe completo do pedido;
- acompanhar pagamento real;
- acompanhar envio/rastreio;
- receber status por webhook validado.

## 7.1 Clientes

Clientes são um módulo operacional próprio porque pedidos e ERPs exigem comprador
identificável.

Atual:

- listar clientes por loja;
- buscar por nome, e-mail, telefone, documento ou último pedido;
- cadastrar cliente manualmente;
- calcular última compra e total consumido a partir dos pedidos;
- reservar aba Mensagens como placeholder sem chat/newsletter real.

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
