import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const RESULT_FILE = path.join(OUT, '09_resultado_atualizacao_pos_importacao.json');
const DRY_RESULT_FILE = path.join(OUT, '10_resultado_atualizacao_dry_run.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const UPDATE_APPROVED =
  String(process.env.UPDATE_APPROVED ?? process.env.IMPORT_APPROVED ?? 'false').toLowerCase() ===
  'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_UPDATE_DELAY_MS ?? 700);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  const candidates = products.filter((product) => product.bling_id);
  const blocked = products.filter((product) => !product.bling_id);

  const descriptions = candidates.map((product) => ({
    sku: product.sku,
    bling_id: product.bling_id,
    linha_ods: product.linha_ods,
    unidade: 'UN',
    descricaoCurta: buildShortDescription(product),
    descricaoComplementar: buildFullDescription(product),
    tributacao: product.ncm ? { ncm: String(product.ncm).replace(/\D/g, '') } : undefined,
  }));

  const stockCandidates = candidates.filter((product) => product.quantidade !== null && product.quantidade !== undefined && product.quantidade !== '');

  const result = {
    status: DRY_RUN || !UPDATE_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    updateApproved: UPDATE_APPROVED,
    startedAt,
    finishedAt: null,
    totalComBlingId: candidates.length,
    bloqueadosSemBlingId: blocked.length,
    descricoesPlanejadas: descriptions.length,
    estoquesPlanejados: stockCandidates.length,
    unidadeAplicada: 'UN',
    deposito: null,
    descriptions: [],
    stock: [],
    errors: [],
    sources: [
      'https://www.dji.com/neo-2',
      'https://developer.bling.com.br/referencia',
    ],
  };

  await fs.writeFile(
    path.join(OUT, '10_descricoes_enriquecidas_dry_run.json'),
    `${JSON.stringify({ dryRun: true, descriptions }, null, 2)}\n`,
    'utf8'
  );

  if (DRY_RUN || !UPDATE_APPROVED) {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(DRY_RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const token = await loadAccessToken();
  if (!token) {
    throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para atualização real.');
  }

  try {
    const deposito = await chooseDeposit(token);
    result.deposito = deposito;
  } catch (error) {
    result.deposito = {
      id: null,
      reason: `deposito_nao_resolvido:${safeError(error)}`,
    };
    result.errors.push({ scope: 'deposito', error: safeError(error) });
  }

  for (const item of descriptions) {
    await sleep(REQUEST_DELAY_MS);
    try {
      const body = {
        descricaoCurta: item.descricaoCurta,
        descricaoComplementar: item.descricaoComplementar,
        marca: 'DJI',
        unidade: item.unidade,
      };
      if (item.tributacao) body.tributacao = item.tributacao;
      await bling(token, 'PATCH', `/produtos/${item.bling_id}`, body);
      result.descriptions.push({ sku: item.sku, bling_id: item.bling_id, status: 'ATUALIZADO' });
    } catch (error) {
      result.descriptions.push({ sku: item.sku, bling_id: item.bling_id, status: 'ERRO_API', error: safeError(error) });
      result.errors.push({ scope: 'descricao', sku: item.sku, error: safeError(error) });
    }
  }

  if (result.deposito?.id) {
    for (const product of stockCandidates) {
      await sleep(REQUEST_DELAY_MS);
      try {
        const body = {
          produto: { id: Number(product.bling_id) },
          deposito: { id: Number(result.deposito.id) },
          operacao: 'B',
          quantidade: Number(product.quantidade),
          custo: product.custo_unitario !== null && product.custo_unitario !== undefined ? Number(product.custo_unitario) : undefined,
          preco: product.preco_venda !== null && product.preco_venda !== undefined ? Number(product.preco_venda) : undefined,
          observacoes: 'Balanço inicial importado da planilha CADASTPRODUTOS.ods',
        };
        await bling(token, 'POST', '/estoques', removeUndefined(body));
        result.stock.push({ sku: product.sku, bling_id: product.bling_id, quantidade: product.quantidade, status: 'BALANCO_CRIADO' });
      } catch (error) {
        result.stock.push({ sku: product.sku, bling_id: product.bling_id, quantidade: product.quantidade, status: 'ERRO_API', error: safeError(error) });
        result.errors.push({ scope: 'estoque', sku: product.sku, error: safeError(error) });
      }
    }
  } else {
    result.stock = stockCandidates.map((product) => ({
      sku: product.sku,
      bling_id: product.bling_id,
      quantidade: product.quantidade,
      status: 'PULADO_SEM_DEPOSITO_SEGURO',
    }));
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
}

function buildShortDescription(product) {
  if (String(product.sku).includes('NEO2-DRONE')) {
    return 'Drone DJI Neo 2 compacto para criadores, com gravação 4K, rastreamento inteligente e recursos de voo assistido.';
  }
  const model = product.modelo_detectado ? ` compatível com ${product.modelo_detectado}` : '';
  return `${product.tipo_peca} DJI${model} para reposição, manutenção e reparo técnico. Confira compatibilidade antes da compra.`;
}

function buildFullDescription(product) {
  if (String(product.sku).includes('NEO2-DRONE')) {
    return [
      'Drone DJI Neo 2 compacto e portátil, indicado para captura criativa de imagens em movimento, vlogs e registros do dia a dia.',
      'Segundo a página oficial da DJI, o Neo 2 traz recursos como detecção omnidirecional de obstáculos, controle por gestos, SelfieShot, ActiveTrack e captação em 4K.',
      'Produto cadastrado a partir da planilha de estoque da Brasil Drones. Antes da compra, confirme versão, acessórios inclusos, disponibilidade e regras locais de uso.',
    ].join('\n\n');
  }

  const modelText = product.modelo_detectado
    ? `Compatível com DJI ${product.modelo_detectado}.`
    : 'Compatibilidade deve ser confirmada pelo modelo do equipamento.';
  const positionText = product.nome_bling.includes('Direito') || product.nome_bling.includes('Esquerdo') || product.nome_bling.includes('Inferior') || product.nome_bling.includes('Superior')
    ? 'Verifique lado/posição da peça antes da instalação.'
    : 'Confira aplicação e código visual da peça antes da instalação.';
  const usageText = buildUsageText(product);
  return [
    `${product.nome_bling}. Peça/componente DJI para reposição, manutenção ou reparo técnico.`,
    usageText,
    `${modelText} ${positionText}`,
    'Não acompanha itens não descritos no anúncio. Recomendamos instalação por técnico especializado e conferência da compatibilidade antes da compra.',
  ].join('\n\n');
}

function buildUsageText(product) {
  const type = normalize(product.tipo_peca);
  const name = normalize(product.nome_bling);
  if (type.includes('shell')) {
    return 'Componente de carcaça/frame utilizado na estrutura externa do drone, indicado para substituição em reparos de acabamento ou estrutura.';
  }
  if (type.includes('braco')) {
    return 'Braço estrutural de reposição para manutenção do conjunto de sustentação do drone. A posição indicada no nome deve ser conferida antes da compra.';
  }
  if (type.includes('dobradica') || type.includes('acabamento')) {
    return 'Peça de acabamento, eixo ou dobradiça destinada a reparos mecânicos e fechamento correto da estrutura do equipamento.';
  }
  if (type.includes('gimbal') || type.includes('ptz') || type.includes('cabo ptz')) {
    return 'Componente ligado ao conjunto de estabilização/câmera do drone. A instalação exige conferência visual da peça e compatibilidade com o modelo.';
  }
  if (type.includes('placa') || type.includes('core') || type.includes('esc')) {
    return 'Placa ou módulo eletrônico de reposição para manutenção técnica. Requer diagnóstico prévio e instalação por profissional qualificado.';
  }
  if (type.includes('cmos')) {
    return 'Componente de câmera/sensor de imagem para reparo do conjunto óptico. Confirme versão e encaixe antes da compra.';
  }
  if (type.includes('gps') || type.includes('imu')) {
    return 'Módulo/sensor de navegação para manutenção técnica do drone. Requer calibração e validação após a instalação.';
  }
  if (type.includes('helice')) {
    return 'Hélice/rotor de reposição DJI. Verifique modelo, lado e tipo de encaixe antes da instalação e substitua pares quando indicado pelo fabricante.';
  }
  if (type.includes('controle')) {
    return 'Controle remoto DJI para operação do equipamento compatível. Confirme pareamento, modelo e região antes da compra.';
  }
  if (type.includes('hub') || name.includes('carregador')) {
    return 'Carregador ou hub DJI para uso com baterias compatíveis. Confira modelo das baterias e padrão de conexão antes da compra.';
  }
  if (type.includes('pelicula') || type.includes('protecao')) {
    return 'Item de proteção/acabamento para auxiliar na conservação do equipamento. Confirme aplicação exata antes da instalação.';
  }
  if (type.includes('tampa') || name.includes('bateria')) {
    return 'Tampa ou componente relacionado ao compartimento de bateria, destinado à reposição de acabamento e fechamento do equipamento.';
  }
  return 'Componente DJI de reposição para manutenção técnica. A aplicação deve ser validada pelo modelo, posição e inspeção visual da peça.';
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function chooseDeposit(token) {
  if (process.env.BLING_DEPOSITO_ID) {
    return {
      id: Number(process.env.BLING_DEPOSITO_ID),
      descricao: process.env.BLING_DEPOSITO_DESCRICAO ?? 'Depósito informado manualmente',
      manual: true,
    };
  }
  const response = await bling(token, 'GET', '/depositos', undefined, { limite: 100, situacao: 1 });
  const deposits = response.data ?? [];
  const usable = deposits.filter((deposit) => deposit?.id && deposit?.desconsiderarSaldo !== true);
  const defaults = usable.filter((deposit) => deposit.padrao === true);
  if (defaults.length === 1) return defaults[0];
  if (usable.length === 1) return usable[0];
  return {
    id: null,
    reason: `deposito_ambiguo_ou_indisponivel:${usable.length}`,
    deposits: usable.map((deposit) => ({
      id: deposit.id,
      descricao: deposit.descricao,
      padrao: deposit.padrao,
      desconsiderarSaldo: deposit.desconsiderarSaldo,
    })),
  };
}

async function loadAccessToken() {
  if (process.env.BLING_ACCESS_TOKEN) return process.env.BLING_ACCESS_TOKEN;
  if (!process.env.BLING_AUTH_CODE) return undefined;
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('BLING_CLIENT_ID e BLING_CLIENT_SECRET obrigatórios para trocar BLING_AUTH_CODE.');
  }
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: process.env.BLING_AUTH_CODE }),
    signal: AbortSignal.timeout(20000),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.access_token) {
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }
  return parsed.access_token;
}

async function bling(token, method, endpoint, body, query = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`HTTP ${response.status} ${extractBlingError(parsed)}`);
  return parsed;
}

async function appendReport(result) {
  const text = await fs.readFile(REPORT_FILE, 'utf8').catch(() => '');
  const summary = summarize(result);
  const section = [
    '',
    '## Pós-importação: descrições e estoque',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZAÇÃO REAL'}`,
    `- Produtos com Bling ID: ${summary.totalComBlingId}`,
    `- Unidade aplicada: ${result.unidadeAplicada ?? 'não aplicada'}`,
    `- Descrições atualizadas: ${summary.descricoesAtualizadas}`,
    `- Descrições com erro: ${summary.descricoesErro}`,
    `- Balanços de estoque criados: ${summary.estoquesCriados}`,
    `- Estoques pulados: ${summary.estoquesPulados}`,
    `- Erros totais: ${summary.errors}`,
    `- Depósito usado: ${summary.deposito}`,
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    totalComBlingId: result.totalComBlingId,
    descricoesAtualizadas: result.descriptions.filter((item) => item.status === 'ATUALIZADO').length,
    descricoesErro: result.descriptions.filter((item) => item.status === 'ERRO_API').length,
    estoquesCriados: result.stock.filter((item) => item.status === 'BALANCO_CRIADO').length,
    estoquesPulados: result.stock.filter((item) => item.status === 'PULADO_SEM_DEPOSITO_SEGURO').length,
    errors: result.errors.length,
    deposito: result.deposito?.id ? `${result.deposito.id} - ${result.deposito.descricao ?? ''}` : result.deposito?.reason ?? 'não avaliado',
  };
}

function removeUndefined(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(removeUndefined);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefined(item)])
  );
}

function safeError(error) {
  if (error instanceof Error) return error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  return 'unknown_error';
}

function extractBlingError(body) {
  return body?.error?.type ?? body?.error?.message ?? body?.error ?? 'bling_request_failed';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
