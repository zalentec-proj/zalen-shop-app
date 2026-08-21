# Critérios de Aceite — Zalen Shop

## 1. Plataforma

- Projeto usa Next.js App Router.
- Supabase Cloud está documentado e configurável por env.
- Dados de loja usam `store_id`.
- A arquitetura permite mais de uma store sem reescrever o core.
- Brasil Drones é a primeira store.
- LB London está documentada como store futura.

## 2. Auth e acesso

- Login usa identidade Zalen Shop.
- Storefront público continua sem login.
- `/admin` exige sessão.
- Usuário `platform_owner` ou `platform_admin` pode acessar a store ativa.
- Usuário com `store_membership` acessa apenas sua store.
- Usuário sem permissão não acessa dados de loja.

## 3. Storefront

- Home carrega corretamente.
- Categoria carrega produtos da store ativa.
- Produto abre com dados corretos.
- Carrinho funciona.
- Carrinho persiste itens reais adicionados pelo comprador.
- Adicionar produto abre o carrinho lateral em qualquer página que exiba essa ação.
- “Comprar agora” adiciona o item e abre diretamente o checkout.
- Checkout permite compra convidada com e-mail, entrega e CPF/CNPJ.
- Checkout convidado começa nos dados do comprador e não exige conta, senha ou
  OTP antes do pagamento.
- CPF/CNPJ é validado no servidor antes de criar pedido.
- Checkout identifica PF por CPF e PJ por CNPJ.
- Checkout aplica tabela de preço PF/PJ server-side.
- Frontend não define preço cobrado, frete ou total final.
- Checkout calcula frete por cotação server-side.
- Checkout finaliza enviando apenas `shippingQuoteId`.
- Cotação expirada, alterada ou de outro carrinho bloqueia criação do pedido.
- Compra PJ coleta razão social e inscrição estadual ou isenção.
- Layout responsivo.
- Performance aceitável.
- Storefront Brasil Drones mantém identidade Brasil Drones.

## 4. Admin

- Admin usa identidade Zalen Shop.
- Admin mostra contexto da loja ativa.
- Produtos são visíveis.
- Pedidos são visíveis.
- Clientes são visíveis quando autorizado.
- Integrações mostram status.
- Erros aparecem de forma compreensível.
- Admin não expõe segredos.

## 5. Catálogo

- Produto pode ser listado.
- Produto pode ter imagem.
- Produto pode ter variante.
- Estoque aparece corretamente.
- Produto inativo não aparece no storefront público.
- Admin pode visualizar produtos ativos/inativos quando autorizado.
- Produto sincronizado do Bling persiste `freteGratis` como regra server-side.

## 6. Pedidos

- Carrinho adiciona/remove itens.
- Total é calculado no backend quando checkout real for implementado.
- E-mails com erro comum de domínio, como `gmail.coim`, bloqueiam criação de
  pagamento com sugestão segura de correção.
- Pedido é criado com número amigável.
- Pedido é salvo no banco.
- Pedido salva snapshot do comprador quando informado.
- Pedido salva snapshot fiscal PF/PJ e tabela de preço aplicada.
- CEP válido no checkout preenche cidade, UF, bairro e logradouro quando a base
  ViaCEP retornar esses dados.
- Endereço preenchido por CEP continua editável para casos de CEP genérico ou
  base incompleta.
- Pedido salva `shipping_total` calculado no servidor.
- Pedido salva método, cotação e metadados normalizados do frete escolhido.
- `order_items` salva preço unitário final calculado no servidor.
- Pedido autenticado salva/atualiza o cliente e o snapshot do comprador.
- Pedido convidado salva snapshot do comprador sem criar, sobrescrever ou
  vincular `customers` e endereços antes da verificação do e-mail.
- O navegador que criou o pedido convidado pode pagar e acompanhar somente esse
  pedido por capacidade HttpOnly temporária, validada contra a tentativa
  idempotente persistida e o `store_id`.
- Depois da validação do mesmo e-mail, pedidos convidados sem `customer_id` são
  associados à conta autenticada da mesma loja.
- Pedido não pago/cancelado mostra opção de retomar pagamento sem duplicar o
  pedido.
- Nova tentativa com mesmo carrinho, comprador e loja reutiliza pedido pendente
  pagável em vez de criar outro pedido.
- Pedido dispara envio ERP server-side e registra erro seguro quando integração
  estiver pendente/incompleta.

## 6.1 Clientes

- Clientes usam `store_id`.
- Clientes podem ser vinculados a Supabase Auth por `auth_user_id`.
- Área do comprador autenticada mostra ação visível de sair da sessão.
- Clientes não são públicos para `anon`.
- Admin autorizado pode listar e cadastrar clientes.
- Lista mostra última compra e total consumido quando houver pedidos vinculados.
- Lista mostra tipo PF/PJ e documento quando disponível.

## 7. Conectores

- `integration_providers` representa conectores globais.
- `store_integrations` representa conectores por loja.
- Brasil Drones usa Bling como conector ERP planejado.
- LB London usa Mercos como conector futuro planejado.
- Nenhuma API externa é chamada pelo frontend.
- Credenciais não aparecem no frontend.

## 7.1 Envios

- `store_shipping_origins` representa uma origem de envio por loja no MVP.
- `shipping_methods` representa retirada, frete fixo, entrega manual e futuro provider externo.
- `shipping_quotes` persiste cotações por 30 minutos.
- SuperFrete V1 chama apenas `POST /api/v0/calculator` no servidor.
- Métodos nativos não chamam APIs externas.
- Frete grátis por subtotal é calculado no servidor.
- A Brasil Drones mantém `free_over_subtotal` vazio e não concede gratuidade
  apenas pelo valor do carrinho.
- Frete grátis por produto só zera a cobrança quando todos os itens físicos do
  carrinho forem elegíveis.
- Frete grátis por produto preserva modalidade, transportadora, prazo e preço
  original nos metadados da cotação.
- Alterar a elegibilidade de frete grátis não reutiliza uma cotação incompatível
  do cache, e o servidor revalida a regra antes de criar o pedido.
- `/admin/configuracoes/envios` permite configurar origem e métodos nativos.
- SuperFrete não gera etiqueta, pagamento de etiqueta, impressão, webhook ou rastreio direto na V1.
- Melhor Envio permanece bloqueado até pesquisa técnica oficial preenchida.

## 7.2 Mercado Pago

- Cada loja pode conectar Mercado Pago por OAuth em teste e produção.
- Cada loja escolhe manualmente o ambiente ativo: teste ou produção.
- O ambiente inicial seguro é teste; produção só ativa com credenciais,
  `Public Key` e segredo de webhook configurados.
- Tokens OAuth ficam criptografados em `store_integrations`.
- Brasil Drones pode usar fallback ENV apenas enquanto não houver OAuth conectado.
- Admin não exibe token, refresh token ou segredo de webhook.
- Checkout valida configuração server-side antes de criar pedido.
- Checkout usa o ambiente ativo e a credencial da loja que criou o pedido.
- Preferência Mercado Pago é criada apenas server-side.
- Payment Brick renderiza apenas quando `Public Key` da loja/ambiente está
  disponível.
- Payment Brick envia `formData` para backend próprio; backend chama Mercado
  Pago com `Access Token` privado.
- Checkout Pro fica disponível somente como fallback temporário.
- Pagamento direto usa `X-Idempotency-Key`.
- Cada submissão de pagamento fica registrada em `payment_attempts`; reenvio do
  mesmo formulário não cria cobrança duplicada e uma nova tentativa legítima
  preserva o mesmo pedido.
- Pix não envia token ou parcelas de cartão e exibe QR Code/copia-e-cola quando
  retornados pelo gateway.
- Boleto não envia campos de cartão e exibe link/linha/vencimento quando
  retornados pelo gateway.
- Cartão usa token, emissor, parcelas, e-mail e identificação do Brick.
- Backend força o total do pagamento a partir de `orders.total`.
- `notification_url` inclui `store_id` e `environment`.
- Webhook valida assinatura antes de salvar/processar.
- Webhook é idempotente.
- Webhook processa o evento na loja indicada e rejeita divergência de metadata.
- Pagamento aprovado marca pedido como pago/confirmado.
- Envio ao Bling só dispara após transição real para pago.

## 7.3 Growth, SEO e tráfego pago

- `integration_providers` inclui GTM, GA4, Google Ads, Google Merchant Center,
  Meta Pixel e Meta CAPI.
- Configurações por loja ficam em `store_integrations.settings_json`.
- Token Meta CAPI fica criptografado em `store_integrations.credentials_encrypted`.
- Admin `/admin/integracoes/marketing` não aceita HTML, scripts livres ou tags
  arbitrárias.
- `robots.txt` bloqueia `/admin`, `/api`, `/login`, `/conta`, `/carrinho`, `/pedido` e
  `/pagamento`.
- `sitemap.xml` lista home, categorias e produtos ativos da loja.
- Feed `/feeds/google-merchant.xml` gera itens por variante com preço, imagem,
  URL, disponibilidade e preço BRL.
- Home, categoria e produto possuem canonical, Open Graph/Twitter e JSON-LD
  sanitizado quando aplicável.
- Admin, login, conta, carrinho, pedido convidado e retorno de pagamento possuem `noindex`.
- Cookies de marketing, Pixel, CAPI e enhanced conversions dependem de aceite.
- Eventos client-side cobrem `view_item_list`, `view_item`, `add_to_cart`,
  `view_cart`, `begin_checkout` e `purchase`.
- Venda aprovada Mercado Pago dispara `Purchase` server-side somente quando a
  transição para pago acontece pela primeira vez.
- `marketing_events` deduplica por `store_id + provider_key + event_name + event_id`.
- Retorno e webhook Mercado Pago não duplicam compra server-side.
- CPF/CNPJ nunca é enviado para Google ou Meta.
- E-mail/telefone só são normalizados e hash SHA-256 quando houver consentimento.
- Integrações desativadas não carregam scripts nem enviam eventos.

## 8. Bling

Antes de implementação real:

- pesquisa técnica oficial preenchida;
- OAuth documentado;
- JWT com `enable-jwt: 1` documentado;
- endpoints documentados;
- webhooks documentados;
- plano de idempotência definido.

Após implementação:

- conexão OAuth funcionando;
- tokens criptografados;
- produto importado;
- estoque sincronizado;
- pedido enviado;
- erro registrado em log;
- webhook salvo antes de processar;
- webhook de produto/estoque processado fora da request pública;
- sync incremental agendado mantém produto/estoque consistentes;
- eventos duplicados não geram sync duplicado.

## 9. Mercos

Antes de implementação real:

- pesquisa técnica oficial preenchida;
- ApplicationToken e CompanyToken documentados;
- sandbox documentado;
- homologação documentada;
- throttling 429 documentado;
- webhooks HMAC documentados.

## 10. Segurança

- RLS ativo em tabelas sensíveis.
- Service role não é importado em Client Components.
- Tokens não aparecem no frontend.
- Webhook é idempotente.
- Upload é limitado.
- Sem HTML/JS livre no MVP.
- `.env.local` e segredos não são commitados.
- Headers globais bloqueiam framing, sniffing e APIs de navegador não usadas.
- Rate limit persistente protege OTP, CEP, frete, criação de pedido e pagamento.
- OTP e identificação não confirmam se uma conta, CPF/CNPJ ou e-mail existe.
- Logout do comprador encerra a sessão global do Supabase.
- `email_messages` não é visível a viewer; documentos legais aceitam somente
  texto simples e só ficam públicos após publicação.

## 11. Deploy

- Build passa.
- Variáveis configuradas.
- Supabase Cloud conectado quando necessário.
- Vercel preparado.
- Ambiente staging separado de production.
- CI aprova typecheck, build, cobertura crítica, auditoria de dependências e
  varredura de segredos; baseline OWASP roda apenas contra preview de homologação.

## 12. Domínios próprios

- Owner/admin e papéis globais cadastram domínio; operator/viewer apenas consultam.
- `store_id` não vem do formulário e toda escrita é autorizada no servidor.
- Hostname é IDN/ASCII normalizado, único globalmente e rejeita IP, localhost,
  wildcard, hosts reservados e `*.zalenshop.com.br`.
- Apex/`www` formam um par; `www` é o principal padrão e pode ser invertido.
- DNS e TXT exibidos vêm da resposta da Vercel, sem A/CNAME fixo no código.
- O estado só chega a `ready` com projeto, propriedade, DNS e probe HTTPS válidos.
- Ativação exige confirmação e mantém no máximo um principal ativo por loja.
- Variante secundária e domínios antigos usam redirect 308.
- Host externo desconhecido ou pendente retorna 404, nunca Brasil Drones.
- `/admin` no domínio próprio termina no subdomínio administrativo da loja.
- Remoção exige digitar o hostname e não apaga domínio/registro no registrador.
- Job protegido verifica pendências a cada cinco minutos com backoff; verificação
  manual tem rate limit.
- O recurso inicia com `DOMAIN_SELF_SERVICE_ENABLED=false` e piloto por allowlist.
