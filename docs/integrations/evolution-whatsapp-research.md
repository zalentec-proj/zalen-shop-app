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
- A fila salva somente o texto transacional necessário para entrega, telefone
  normalizado e IDs técnicos. Logs e webhooks não guardam CPF/CNPJ, endereço,
  chaves ou payloads completos.
- Antes da ativação produtiva, configurar URL HTTPS pública, chave global,
  `APP_URL`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, acesso externo ao webhook e
  confirmar a persistência da VPS.

## Homologação pendente

1. Aplicar a migration no Supabase de produção.
2. Configurar as duas variáveis da Evolution no ambiente de produção da Zalen.
3. Vincular `brasil_drones` em Admin → Integrações → WhatsApp.
4. Salvar telefone operacional e habilitar somente o evento de teste.
5. Configurar webhook e disparar uma mensagem de teste para o telefone
   operacional.
6. Confirmar recebimento e então habilitar os eventos ao cliente conforme
   consentimento e telefone confirmado.
