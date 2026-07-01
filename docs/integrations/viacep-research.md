# Pesquisa Técnica — ViaCEP

Fonte oficial consultada: https://viacep.com.br/

## Escopo

Uso no checkout para preencher endereço a partir do CEP brasileiro informado pelo
comprador.

## Autenticação

- Não há autenticação.
- Não há token, OAuth, API key ou escopo.
- Nenhuma variável de ambiente é necessária.

## Endpoint

- Produção: `https://viacep.com.br/ws/{cep}/json/`
- Sandbox: não documentado.
- Método: `GET`
- Parâmetro obrigatório: `cep` com 8 dígitos.
- Formato de retorno usado: `json`.

## Resposta JSON

Campos relevantes confirmados na documentação oficial:

- `cep`
- `logradouro`
- `complemento`
- `bairro`
- `localidade`
- `uf`
- `estado`
- `ibge`
- `ddd`

## Erros

- CEP com formato inválido retorna HTTP 400.
- CEP com 8 dígitos, mas inexistente, retorna JSON com `erro: true`.
- O checkout deve validar o formato antes da consulta e permitir preenchimento
  manual quando o serviço falhar ou retornar endereço incompleto.

## Segurança e Limites

- A chamada deve ser feita no servidor.
- Não há segredo para armazenar.
- Não logar dados pessoais do comprador.
- A documentação alerta que uso massivo para validação de bases locais pode ser
  bloqueado; o checkout deve consultar apenas o CEP digitado pelo comprador.

## Critérios de Aceite

- CEP inválido não chama o provedor e retorna erro amigável.
- CEP inexistente retorna erro amigável.
- CEP válido preenche cidade, UF, bairro e logradouro quando disponíveis.
- Campos permanecem editáveis para casos de CEP genérico ou base incompleta.
