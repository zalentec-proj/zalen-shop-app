# Evolution API — pesquisa técnica (WhatsApp transacional)

## Objetivo

Conectar uma instância WhatsApp por loja para notificações transacionais
unidirecionais. Não inclui inbox, atendimento, chatbot ou campanhas.

## Ambiente validado em 2026-08-19

- Evolution API instalada na VPS central: `2.3.7`.
- Imagem Docker: `evoapicloud/evolution-api:latest`.
- Persistência de instâncias montada em volume Docker (`/evolution/instances`).
- Instância existente da Brasil Drones: `brasil_drones`, estado `open`.
- A instância será vinculada; não deve ser criada novamente.
- A consulta de webhook existente não retornou configuração ativa, portanto o
  webhook deve ser configurado após a URL pública da Zalen e o deploy.
- A configuração foi concluída depois do deploy. Eventos reais recebidos da
  versão 2.3.7 usam nomes com ponto e minúsculas, por exemplo
  `messages.update`; o serviço normaliza esses nomes antes de processá-los.

## Rotas confirmadas/consultadas

| Ação | Método e rota | Uso na Zalen |
|---|---|---|
| Listar instâncias | `GET /instance/fetchInstances` | localizar e vincular instância já existente |
| Estado de conexão | `GET /instance/connectionState/{instance}` | painel e reconexão |
| Criar instância | `POST /instance/create` | apenas lojas sem instância |
| Gerar QR/reconectar | `GET /instance/connect/{instance}` | QR temporário do admin |
| Enviar texto | `POST /message/sendText/{instance}` | worker server-side |
| Consultar webhook | `GET /webhook/find/{instance}` | auditoria antes de configurar |
| Configurar webhook | `POST /webhook/set/{instance}` | eventos de conexão e entrega |

Os endpoints de criação, estado, envio e webhook foram comparados com a
documentação oficial referenciada em `official-sources.md`. O formato exato de
resposta de QR e de eventos permanece tratado defensivamente no conector para
acompanhar a versão 2.3.7.

## Segurança e operação

- `EVOLUTION_API_BASE_URL` e `EVOLUTION_API_GLOBAL_API_KEY` são variáveis de
  ambiente do servidor, nunca dados de formulário ou frontend.
- O segredo de webhook é gerado por loja e criptografado no cofre existente de
  credenciais de integração.
- O QR só é retornado pela Server Action a `store_owner` e `store_admin`; não
  é armazenado em banco nem em logs.
- O conteúdo pendente da fila é criptografado com o cofre de integrações. Após
  aceite, entrega, falha definitiva, expiração ou descarte, o conteúdo é
  substituído por `[redacted]`; códigos não permanecem legíveis no histórico.
  Logs e webhooks não guardam CPF/CNPJ, endereço, chaves ou payloads completos.
- Workers reivindicam a linha com transição atômica de `queued` para
  `processing`. Somente uma reivindicação pode enviar; `accepted` é terminal
  para retries e o webhook apenas promove o recibo para `delivered` ou
  `failed`.
- O envio direto a um telefone ainda não confirmado é permitido somente no
  desafio autenticado de confirmação desse próprio número. Os demais eventos
  ao cliente exigem telefone confirmado e opt-in ativo.
- Antes da ativação produtiva, configurar URL HTTPS pública, chave global,
  `APP_URL`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, acesso externo ao webhook e
  confirmar a persistência da VPS.

## Estado de homologação em 2026-08-19

1. Migration, variáveis server-side, instância `brasil_drones` e webhook estão
   configurados em produção.
2. O envio real de confirmação foi aceito e recebido; o retry indevido que
   repetia a mensagem a cada cron foi removido.
3. A fila foi endurecida com criptografia de conteúdo, expiração de OTP, trava
   de concorrência, RLS explícita de `service_role` e índices das FKs.
4. Falta somente repetir uma jornada supervisionada após o deploy desta
   revisão: salvar preferência, solicitar novo OTP no checkout, conferir o
   mesmo código nos dois canais e validar uma única vez.
