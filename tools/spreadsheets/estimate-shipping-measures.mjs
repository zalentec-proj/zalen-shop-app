import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../..');
const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const XLSX_FILE = path.join(OUT, '20_pesos_medidas_estimados.xlsx');
const JSON_FILE = path.join(OUT, '20_pesos_medidas_estimados.json');
const CSV_FILE = path.join(OUT, '20_pesos_medidas_estimados.csv');
const DRY_RUN_FILE = path.join(OUT, '21_pesos_medidas_dry_run.json');
const PREVIEW_FILE = path.join(OUT, '20_pesos_medidas_estimados_preview.png');
const REQUESTED_SOURCE =
  'Estimativa logística por tipo de peça/modelo para cotação de frete; não é medição real do fabricante.';

const BLING_DIMENSION_UNIT = 'cm';
const WEIGHT_UNIT = 'kg';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const MEASURES_APPROVED = String(process.env.MEASURES_APPROVED ?? 'false').toLowerCase() === 'true';

const profiles = {
  board: profile(0.025, 0.1, 12, 4, 8, 'Peça eletrônica pequena em caixa rígida com proteção.'),
  cable: profile(0.02, 0.06, 12, 3, 8, 'Cabo/flex em envelope rígido ou caixa pequena.'),
  hinge: profile(0.025, 0.08, 12, 4, 8, 'Dobradiça/eixo em caixa pequena com proteção.'),
  smallPart: profile(0.025, 0.08, 12, 4, 8, 'Componente pequeno em caixa mínima com proteção.'),
  cmos: profile(0.02, 0.08, 12, 4, 8, 'Sensor/câmera pequena em caixa rígida com proteção.'),
  gimbalMini: profile(0.08, 0.22, 14, 8, 10, 'Gimbal/PTZ pequeno em caixa reforçada.'),
  gimbalAir: profile(0.12, 0.32, 18, 10, 12, 'Gimbal/PTZ médio em caixa reforçada.'),
  armMini: profile(0.055, 0.14, 18, 6, 8, 'Braço Mini em caixa estreita com proteção.'),
  armAir: profile(0.09, 0.22, 24, 8, 9, 'Braço Air em caixa estreita com proteção.'),
  shellMini: profile(0.08, 0.22, 18, 8, 14, 'Carcaça/frame Mini em caixa média.'),
  shellAir: profile(0.14, 0.35, 24, 10, 18, 'Carcaça/frame Air em caixa média.'),
  propellerMini: profile(0.02, 0.08, 18, 4, 6, 'Hélices em envelope/caixa rígida.'),
  propellerAir: profile(0.035, 0.12, 24, 4, 7, 'Hélices maiores em envelope/caixa rígida.'),
  hub: profile(0.16, 0.4, 16, 8, 12, 'Hub/carregador em caixa média.'),
  remote: profile(0.38, 0.75, 20, 8, 16, 'Controle remoto em caixa média reforçada.'),
  drone: profile(0.25, 1.2, 24, 12, 20, 'Drone completo em caixa de expedição.'),
  film: profile(0.015, 0.05, 16, 2, 10, 'Película/proteção em envelope rígido.'),
};

const rows = await buildRows();
await writeArtifacts(rows);

async function buildRows() {
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  if (!Array.isArray(products) || products.length !== 78) {
    throw new Error(`Arquivo de produtos inválido: esperado 78 linhas, recebido ${Array.isArray(products) ? products.length : 'n/a'}`);
  }

  return products.map((product) => {
    const selected = selectProfile(product);
    const alertas = [
      'PESO_MEDIDA_ESTIMADO_REVISAR',
      'USAR_COMO_MEDIDA_LOGISTICA_PROVISORIA',
      ...(product.bling_id ? [] : ['SEM_BLING_ID_NAO_ATUALIZAR']),
    ];

    return {
      linha_ods: Number(product.linha_ods),
      sku: product.sku,
      bling_id: product.bling_id || '',
      nome_bling: product.nome_bling,
      modelo_detectado: product.modelo_detectado || '',
      tipo_peca: product.tipo_peca || '',
      categoria_path: product.categoria_path || '',
      quantidade: toNumberOrBlank(product.quantidade),
      unidade: product.unidade || 'UN',
      peso_liquido_kg: selected.pesoLiquido,
      peso_bruto_kg: selected.pesoBruto,
      largura_cm: selected.largura,
      altura_cm: selected.altura,
      profundidade_cm: selected.profundidade,
      perfil_logistico: selected.key,
      confianca_estimativa: selected.confidence,
      fonte_estimativa: REQUESTED_SOURCE,
      justificativa: selected.reason,
      status_medida: 'ESTIMADO_LOGISTICO_REVISAR',
      alertas: alertas.join('; '),
    };
  });
}

async function writeArtifacts(rows) {
  await fs.mkdir(OUT, { recursive: true });
  const summary = summarize(rows);
  const dryRun = {
    status: DRY_RUN || !MEASURES_APPROVED ? 'dry_run_only' : 'ready_for_update',
    dryRun: DRY_RUN,
    measuresApproved: MEASURES_APPROVED,
    generatedAt: new Date().toISOString(),
    units: {
      weight: WEIGHT_UNIT,
      dimensions: BLING_DIMENSION_UNIT,
    },
    safety: {
      realBlingUpdateExecuted: false,
      rule: 'Nenhuma atualização no Bling é feita por este script. Use apenas após revisão explícita.',
    },
    summary,
    payloads: rows
      .filter((row) => row.bling_id)
      .map((row) => ({
        linha_ods: row.linha_ods,
        sku: row.sku,
        bling_id: row.bling_id,
        nome_bling: row.nome_bling,
        status_medida: row.status_medida,
        payload_patch_sugerido: {
          pesoLiquido: row.peso_liquido_kg,
          pesoBruto: row.peso_bruto_kg,
          dimensoes: {
            largura: row.largura_cm,
            altura: row.altura_cm,
            profundidade: row.profundidade_cm,
            unidadeMedida: 1,
          },
        },
      })),
  };

  await fs.writeFile(JSON_FILE, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8');
  await fs.writeFile(DRY_RUN_FILE, `${JSON.stringify(dryRun, null, 2)}\n`, 'utf8');
  await fs.writeFile(CSV_FILE, toCsv(rows), 'utf8');
  await writeWorkbook(rows, summary);
  console.log(JSON.stringify(summary, null, 2));
}

async function writeWorkbook(rows, summary) {
  const workbook = Workbook.create();
  const produtos = workbook.worksheets.add('Produtos');
  const perfis = workbook.worksheets.add('Perfis_Logisticos');
  const resumo = workbook.worksheets.add('Resumo');

  const headers = Object.keys(rows[0]);
  produtos.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  produtos.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows.map((row) => headers.map((header) => row[header]));
  produtos.freezePanes.freezeRows(1);
  produtos.showGridLines = false;
  styleTable(produtos, headers.length, rows.length + 1);

  const profileRows = Object.entries(profiles).map(([key, value]) => ({
    perfil_logistico: key,
    peso_liquido_kg: value.pesoLiquido,
    peso_bruto_kg: value.pesoBruto,
    largura_cm: value.largura,
    altura_cm: value.altura,
    profundidade_cm: value.profundidade,
    fonte: REQUESTED_SOURCE,
    justificativa: value.reason,
  }));
  const profileHeaders = Object.keys(profileRows[0]);
  perfis.getRangeByIndexes(0, 0, 1, profileHeaders.length).values = [profileHeaders];
  perfis.getRangeByIndexes(1, 0, profileRows.length, profileHeaders.length).values = profileRows.map((row) =>
    profileHeaders.map((header) => row[header])
  );
  perfis.freezePanes.freezeRows(1);
  perfis.showGridLines = false;
  styleTable(perfis, profileHeaders.length, profileRows.length + 1);

  const summaryRows = [
    ['Métrica', 'Valor'],
    ['Gerado em', humanDate(summary.generatedAt)],
    ['Produtos analisados', summary.totalProdutos],
    ['Produtos com bling_id', summary.produtosComBlingId],
    ['Produtos sem bling_id', summary.produtosSemBlingId],
    ['Unidade de peso', WEIGHT_UNIT],
    ['Unidade de dimensão', BLING_DIMENSION_UNIT],
    ['Atualização real no Bling', 'não executada'],
    ['Natureza dos dados', REQUESTED_SOURCE],
    ['Produtos por confiança ALTA', summary.porConfianca.ALTA ?? 0],
    ['Produtos por confiança MEDIA', summary.porConfianca.MEDIA ?? 0],
    ['Produtos por confiança BAIXA', summary.porConfianca.BAIXA ?? 0],
  ];
  resumo.getRangeByIndexes(0, 0, summaryRows.length, 2).values = summaryRows;
  resumo.showGridLines = false;
  resumo.getRange('A1:B1').format.fill.color = '#10233F';
  resumo.getRange('A1:B1').format.font.color = '#FFFFFF';
  resumo.getRange('A1:B1').format.font.bold = true;
  resumo.getRange('A1:B12').format.borders = { preset: 'all', style: 'thin', color: '#D9E2EC' };
  resumo.getRange('A:A').format.columnWidth = 32;
  resumo.getRange('B:B').format.columnWidth = 110;
  resumo.getRange('B9').format.wrapText = true;

  produtos.getRange('I:N').format.numberFormat = '0.000';
  produtos.getRange('A:A').format.numberFormat = '0';
  produtos.getRange('H:H').format.numberFormat = '0';
  perfis.getRange('B:F').format.numberFormat = '0.000';

  const inspect = await workbook.inspect({
    kind: 'table',
    sheetId: 'Produtos',
    range: 'A1:U12',
    include: 'values',
    tableMaxRows: 12,
    tableMaxCols: 21,
    maxChars: 3000,
  });
  console.log(inspect.ndjson);

  const errors = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
    options: { useRegex: true, maxResults: 50 },
    maxChars: 1000,
  });
  console.log(errors.ndjson);

  const preview = await workbook.render({ sheetName: 'Resumo', range: 'A1:B12', scale: 2, format: 'png' });
  await fs.writeFile(PREVIEW_FILE, new Uint8Array(await preview.arrayBuffer()));

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(XLSX_FILE);
}

function styleTable(sheet, columnCount, rowCount) {
  const header = sheet.getRangeByIndexes(0, 0, 1, columnCount);
  header.format.fill.color = '#10233F';
  header.format.font.color = '#FFFFFF';
  header.format.font.bold = true;
  header.format.wrapText = true;
  header.format.rowHeight = 34;
  const tableRange = sheet.getRangeByIndexes(0, 0, rowCount, columnCount);
  tableRange.format.borders = {
    insideHorizontal: { style: 'thin', color: '#E6EDF5' },
    top: { style: 'thin', color: '#C8D5E4' },
    bottom: { style: 'thin', color: '#C8D5E4' },
  };
  tableRange.format.autofitColumns();
  tableRange.format.autofitRows();
  sheet.getRangeByIndexes(0, 0, rowCount, columnCount).format.wrapText = true;
}

function selectProfile(product) {
  const type = normalize(product.tipo_peca);
  const name = normalize(`${product.nome_bling} ${product.nome_original}`);
  const model = normalize(product.modelo_detectado);
  const isAir = /\bair\b|air2|air3|air3s|air2s/.test(model) || /\bair\b|air 3|air 3s|air 2s/.test(name);
  const isDrone = type.includes('drone') || name.includes('drone completo');

  if (isDrone) return withMeta('drone', 'BAIXA');
  if (type.includes('controle')) return withMeta('remote', 'MEDIA');
  if (type.includes('hub') || type.includes('carregador')) return withMeta('hub', 'MEDIA');
  if (type.includes('helice')) return withMeta(isAir ? 'propellerAir' : 'propellerMini', 'MEDIA');
  if (type.includes('braco')) return withMeta(isAir ? 'armAir' : 'armMini', 'MEDIA');
  if (type.includes('shell') || name.includes('carcaca') || name.includes('frame')) return withMeta(isAir ? 'shellAir' : 'shellMini', 'MEDIA');
  if (type.includes('gimbal')) return withMeta(isAir ? 'gimbalAir' : 'gimbalMini', 'MEDIA');
  if (type.includes('cabo')) return withMeta('cable', 'MEDIA');
  if (type.includes('cmos')) return withMeta('cmos', 'BAIXA');
  if (type.includes('placa') || type.includes('gps') || type.includes('imu') || type.includes('kit core')) return withMeta('board', 'BAIXA');
  if (type.includes('dobradica') || type.includes('acabamento')) return withMeta('hinge', 'MEDIA');
  if (type.includes('tampa')) return withMeta('smallPart', 'MEDIA');
  if (type.includes('pelicula') || type.includes('protecao')) return withMeta('film', 'MEDIA');
  return withMeta('smallPart', 'BAIXA');
}

function profile(pesoLiquido, pesoBruto, largura, altura, profundidade, reason) {
  return { pesoLiquido, pesoBruto, largura, altura, profundidade, reason };
}

function withMeta(key, confidence) {
  return { key, confidence, ...profiles[key] };
}

function summarize(rows) {
  return {
    generatedAt: new Date().toISOString(),
    totalProdutos: rows.length,
    produtosComBlingId: rows.filter((row) => row.bling_id).length,
    produtosSemBlingId: rows.filter((row) => !row.bling_id).length,
    porPerfil: countBy(rows, (row) => row.perfil_logistico),
    porConfianca: countBy(rows, (row) => row.confianca_estimativa),
    pesoBrutoTotalUnitarioKg: round3(rows.reduce((sum, row) => sum + Number(row.peso_bruto_kg || 0), 0)),
  };
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || 'sem_valor';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toNumberOrBlank(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function humanDate(value) {
  return String(value).replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}
