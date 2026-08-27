# Guia operacional Bling — Brasil Drones

> Público: operação, cadastro, expedição e gestão da Brasil Drones.
>
> Atualizado em 25/08/2026. Os links abaixo são materiais oficiais do Bling.

## Objetivo

Roteiro de treinamento e operação diária para manter catálogo, saldo, faturamento
e expedição corretos. Complementa a configuração fiscal validada pelo contador e
a documentação técnica da integração Zalen Shop ↔ Bling.

## Como os sistemas se dividem

| Sistema | Responsabilidade |
| --- | --- |
| **Zalen Shop** | Vitrine, carrinho, checkout, pagamento, criação do pedido local e experiência do cliente. |
| **Bling** | ERP operacional: cadastro mestre, estoque, pedido de venda, NF-e, DANFE, logística, etiqueta e expedição. |

Para a Brasil Drones, um pedido pago na Zalen é enviado ao Bling pelo conector
server-side, com idempotência. A equipe **não deve criar novamente o mesmo
pedido nem configurá-lo como uma loja de marketplace na Central de Extensões**.
A Central de Extensões e *Pedidos de Venda Multiloja* são úteis para canais
nativos do Bling, mas não são a entrada do conector próprio da Zalen.

Antes de faturar, separar ou despachar, procure o pedido em **Vendas > Pedidos
de Venda** e confira cliente, itens/SKUs, quantidade, endereço, frete e forma de
pagamento. Se ele não estiver no Bling, anote o número do pedido e acione a
Zalen; não replique a venda manualmente sem confirmar a falha de sincronização.

## Trilha de vídeos e tutoriais oficiais

| Prioridade | Assunto | Vídeo / tutorial oficial | Aplicação na Brasil Drones |
| --- | --- | --- | --- |
| 1 | Cadastro de produto | [Vídeo oficial: produto simples e com variação](https://youtu.be/2hjqgL9hljk) · [guia de cadastro](https://ajuda.bling.com.br/hc/pt-br/articles/360036756914-Como-cadastrar-produtos) | Base para drones, peças, acessórios e serviços. |
| 2 | Produtos com variações | [Tutorial oficial com vídeo incorporado](https://ajuda.bling.com.br/hc/pt-br/articles/360035987033-Cadastrar-produtos-com-varia%C3%A7%C3%A3o) | Cor, voltagem ou configuração com SKU e saldo próprios. |
| 3 | Lançamento e importação de estoque | [Como inserir estoque no produto](https://ajuda.bling.com.br/hc/pt-br/articles/360035628694-Como-inserir-estoque-no-produto-do-Bling) | Entrada, saída, balanço e carga por planilha. |
| 4 | Gestão e conferência de estoque | [Tutorial oficial com vídeo incorporado](https://ajuda.bling.com.br/hc/pt-br/articles/360036754894-Como-gerenciar-meu-estoque) · [dashboard de estoque](https://ajuda.bling.com.br/hc/pt-br/articles/30625453942935-Dashboard-Estoque-de-Produtos) | Conferir saldo por SKU e depósito. |
| 5 | Integrações com lojas | [Vídeo oficial: integrar loja virtual](https://www.youtube.com/watch?v=0gkHEB9qVo8) · [tutorial de integração](https://ajuda.bling.com.br/hc/pt-br/articles/360036924933-Como-integrar-minha-loja-virtual) | Contexto geral; para a Zalen, siga a regra específica deste guia. |
| 6 | Pedido de venda | [Tutorial oficial com vídeo incorporado](https://ajuda.bling.com.br/hc/pt-br/articles/360036358474-Inserir-um-pedido-de-venda) | Consultar os dados de pedidos da Zalen; criar manualmente apenas venda fora dela. |
| 7 | NF-e a partir do pedido | [Vídeo oficial: emitir NF-e](https://youtu.be/qiizmKjfVUo) · [gerar NF-e do pedido](https://ajuda.bling.com.br/hc/pt-br/articles/360036450634-Como-gerar-nota-NF-e-a-partir-do-pedido-de-venda) | Faturar individualmente ou em lote após conferência fiscal. |
| 8 | Separação, DANFE e etiqueta | [Checkout de pedidos](https://ajuda.bling.com.br/hc/pt-br/articles/18134856833943-Como-utilizar-o-checkout-de-pedidos-de-vendas-no-Bling) · [imprimir etiqueta e DANFE](https://ajuda.bling.com.br/hc/pt-br/articles/1500000480902-Como-imprimir-a-etiqueta-de-envio-e-o-DANFE-a-partir-do-Checkout-de-pedidos-de-Venda) | Conferir SKU/código de barras, imprimir documentos e expedir. |
| 9 | Automação do checkout | [Configurar automações](https://ajuda.bling.com.br/hc/pt-br/articles/24112035701143-Como-configurar-automa%C3%A7%C3%B5es-do-checkout-de-pedidos-de-venda) · [lançar estoque após checkout](https://ajuda.bling.com.br/hc/pt-br/articles/360037052553-Como-lan%C3%A7ar-estoque-automaticamente-ap%C3%B3s-realizar-o-checkout-de-pedidos-de-vendas) | Configurar somente após teste e aprovação da gestão. |

Os links marcados como “tutorial com vídeo incorporado” abrem a página oficial
que contém o vídeo. Os recursos dependem do plano, das permissões e da logística
contratada.

## Fluxo de um pedido vindo da Zalen Shop

```txt
Cliente conclui pagamento na Zalen
        ↓
Zalen cria o pedido e o envia uma vez ao Bling
        ↓
Equipe confere o pedido no Bling
        ↓
Gera/autoriza NF-e e obtém a etiqueta da logística
        ↓
Separa, confere por SKU, imprime DANFE + etiqueta e despacha
```

1. Em **Vendas > Pedidos de Venda**, localize a venda e confira tudo antes de
   qualquer ação fiscal ou logística.
2. Gere a NF-e a partir do pedido; confira natureza de operação, tributação,
   destinatário, itens, frete e valores. Só então salve e transmita à SEFAZ.
3. Acesse **Vendas > Checkout de pedidos**, localize por número, rastreio ou
   chave da nota e faça a separação lendo SKU/GTIN. Ao finalizar, o Bling deixa
   o pedido como **Verificado**.
4. No ícone de impressão, escolha **Etiqueta de transporte** ou **DANFE
   simplificado + etiqueta**. A etiqueta só existe se a logística estiver ativa
   e selecionada no pedido.
5. Embale, aplique a etiqueta correspondente e despache. Pedido, NF-e e etiqueta
   devem permanecer associados à mesma venda.

## Cadastro de produto: padrão mínimo

Cadastre o produto mestre no Bling antes de esperar que ele apareça na loja.

- Nome claro, marca/modelo e compatibilidade quando relevante.
- SKU único e estável; nunca reutilize SKU de item inativo ou de outra variação.
- Preço de venda e unidade comercial.
- Categoria, descrição curta, fotos e GTIN/EAN quando houver.
- Peso bruto/líquido, largura, altura, profundidade e unidade corretos. Não
  estime sem conferência física: esses dados influenciam frete e expedição.
- Origem, NCM e demais dados fiscais validados pelo contador.
- Estoque mínimo, localização e depósito quando aplicável.

Em produtos com variações, cada variação vendável precisa de SKU próprio e dos
dados fiscais aplicáveis. Não use variação apenas como rótulo visual se preço,
estoque ou expedição forem diferentes.

Depois de alterar produto, categoria, preço, saldo ou mídia no Bling, acompanhe
a sincronização no painel Zalen. O storefront usa a base Zalen; uma alteração
no ERP não está publicada antes de a sincronização terminar sem erro.

## Estoque: escolha correta do lançamento

| Situação | Lançamento no Bling | Exemplo |
| --- | --- | --- |
| Chegada de mercadoria | **Entrada** | Chegaram 5 baterias novas. |
| Perda, avaria, devolução ao fornecedor ou ajuste de saída | **Saída** | Baixar 1 hélice avariada. |
| Inventário físico | **Balanço** | A contagem mostrou saldo real de 12; o balanço define 12, sem somar ao anterior. |
| Muitos itens | **Planilha de estoque** | Inventário inicial ou recebimento amplo, depois da validação da planilha. |

No lançamento manual, selecione o produto e o depósito corretos. Para planilha,
mantenha a primeira linha do modelo e valide o arquivo antes de importar. Nunca
use **Balanço** para uma entrada normal: ele substitui o saldo atual.

## Rotina recomendada

### Todo dia

- Conferir pedidos novos pagos e o status de sincronização com o Bling.
- Conferir, faturar, separar e etiquetar pedidos sem misturar documentos.
- Registrar entrada/saída física excepcional no mesmo dia.
- Investigar imediatamente qualquer diferença entre item separado e SKU do pedido.

### Toda semana

- Conferir o dashboard de estoque por depósito, mínimos e itens de saldo baixo.
- Fazer balanço físico seletivo dos produtos de maior giro e maior valor.
- Revisar produtos sem foto, peso, dimensões, NCM ou SKU válido.
- Conferir falhas de integração no admin Zalen; reprocessar somente pelo fluxo
  autorizado, nunca criando duplicata no Bling.

## Segurança e qualidade

- Não compartilhe credenciais, tokens OAuth ou chaves de API. A operação não
  precisa delas para emitir pedidos.
- Não altere conexão Zalen ↔ Bling, webhook ou automações em produção sem
  responsável técnico e teste aprovado.
- Não emita NF-e, gere postagem ou movimente estoque para um teste como se fosse
  venda real.
- Em erro de NF-e ou pedido já movimentado, pare e siga o procedimento fiscal
  aplicável; não exclua e recrie por tentativa.
- A etiqueta depende de integração logística ativa no pedido; essa configuração
  é separada da integração Zalen ↔ Bling.

## Quando acionar a Zalen

Informe o número visível do pedido e, se houver, o ID do Bling — sem capturas
com segredos — quando:

- pedido pago na Zalen não aparece no Bling;
- pedido está duplicado ou diverge em SKU, quantidade, valor ou endereço;
- produto/estoque do Bling não refletiu na loja após a sincronização;
- status da integração estiver como erro;
- houver dúvida sobre reprocessar pedido, produto ou estoque.

## Fontes oficiais e internas

- [Central de ajuda do Bling](https://ajuda.bling.com.br/hc/pt-br)
- [Vídeos oficiais do Bling](https://ajuda.bling.com.br/hc/pt-br#youtube)
- [Pesquisa técnica do conector](../integrations/bling-research.md)
- [Estratégia de conectores Zalen Shop](../zalen-shop/CONNECTORS_STRATEGY.md)

