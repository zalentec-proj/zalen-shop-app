# Piloto Brasil Drones

Status: **bloqueado até a homologação desta lista ser aprovada**.

## Ambientes

| Ambiente | Banco | Mercado Pago | Resend | Regra |
|---|---|---|---|---|
| Local | Supabase local ou projeto de desenvolvimento | teste | remetente de teste | nenhum dado de cliente real |
| Homologação | projeto Supabase isolado | teste | domínio/remetente de teste | dados sintéticos somente |
| Produção | projeto Brasil Drones | produção após aprovação | domínio verificado da loja | piloto de convidados |

Nunca apontar preview ou homologação para o banco de produção. Mantenha OAuth,
webhook secrets e chaves de criptografia separados por ambiente.

## Configuração obrigatória

1. Configurar as variáveis sem imprimir valores: Supabase, `APP_URL`,
   `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `RATE_LIMIT_HASH_SECRET`, Mercado Pago,
   Resend, Bling, SuperFrete, `CRON_SECRET` e Sentry.
2. No Supabase Auth, definir expiração do JWT em 60 minutos e manter a rotação
   de refresh token habilitada.
3. No Resend, verificar o domínio/remetente da Brasil Drones, registrar
   `POST /api/webhooks/resend` e selecionar eventos de envio, entrega, bounce,
   complaint e suppression.
4. No Mercado Pago, manter o callback OAuth da Zalen, conectar a conta da Brasil
   Drones em teste e produção, preencher Public Key de cada ambiente e salvar
   o segredo de webhook correspondente. Produção fica desativada até a conexão
   OAuth estar `connected` no admin.
5. No Supabase, confirmar que `pg_cron` e `pg_net` estão ativos, que o segredo
   `zalen_cron_secret` existe no Vault e que as três rotinas aparecem em
   `cron.job` antes de abrir o piloto.
6. Ativar Sentry server-side com `SENTRY_DSN` e confirmar uma exceção sintética
   sem PII antes da homologação.

## Firewall Vercel

O rate limit da aplicação é a proteção precisa por conta e pedido. A borda deve
somar uma regra conservadora por IP, sem substituir o controle interno:

```text
Nome: Protect checkout form posts
Condições: path equals /carrinho AND method equals POST
Ação: rate limit, fixed window, 120 requests por 60 segundos, key IP
Excedente: challenge
```

Criar a regra como rascunho, revisar `vercel firewall diff`, validar no preview
e só então publicar. Não limitar os endpoints de webhook pela regra de checkout:
eles já possuem assinatura e idempotência.

## Homologação obrigatória

- Cartão sandbox aprovado usando titular `APRO` e cartão oficial de teste.
- Cartão recusado e expirado: pedido continua acessível, sem duplicar pedido.
- Pix: QR Code/copia-e-cola visível, pendente antes do webhook e aprovado após
  webhook assinado.
- Boleto: link/linha ou vencimento exibidos quando retornados; permanece
  pendente até webhook e expira corretamente.
- Clique duplo, refresh da página, retorno do checkout e nova tentativa no mesmo
  pedido: cada tentativa é rastreável e nenhum pedido é duplicado.
- Comprador novo, recorrente, logout global, pedido de outro comprador e admin
  sem permissão.
- Frete: CEP válido inicia cotação, repetição em até cinco minutos reutiliza a
  cotação e o pagamento revalida preço, estoque, endereço e frete no servidor.
- E-mail: login, pedido, pagamento e rastreio com remetente correto; bounce e
  complaint atualizam o histórico.

## Piloto de produção

Depois de todos os itens de homologação, executar uma venda manual de baixo
valor por Pix e outra por cartão. Ambas precisam ser confirmadas por webhook e
chegar ao Bling uma única vez. Criar um boleto, sem necessidade de quitá-lo no
primeiro piloto.

Abrir somente para convidados por sete dias. Acompanhar diariamente pagamentos,
pedidos, webhooks e exceções no Sentry. Interromper imediatamente se houver
pagamento perdido, pedido duplicado, vazamento, erro de webhook ou falha crítica
de checkout.

## Rollback

1. Desativar Payment Brick para a loja no admin ou selecionar Checkout Pro como
   contingência manual.
2. Pausar pagamentos da loja no admin se a inconsistência afetar conciliação.
3. Preservar pedidos e `payment_attempts`; nunca apagar histórico para esconder
   o incidente.
4. Corrigir em homologação, repetir a matriz e só então reabrir o piloto.
