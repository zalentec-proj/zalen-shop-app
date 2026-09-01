import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const SOURCE_SHEETS_TO_SKIP = new Set(['Visão geral', 'Catálogo', 'Índice por modelo']);
const SOURCE_HEADERS = [
  'Código',
  'Descrição',
  'Tipo',
  'Situação',
  'Unidade',
  'Preço',
  'Preço de custo',
  'Estoque',
  'GTIN/EAN',
  'Marca',
  'Categoria',
  'Linha de Produto',
  'Descrição Complementar',
  'Descrição Curta',
  'Imagem Principal (arquivo)',
  'Imagens adicionais (arquivos)',
];

const MODEL_DEFINITIONS = [
  ['lito', 'Lito', ['lito', 'dji lito']],
  ['lito-x1', 'Lito X1', ['lito x1', 'dji lito x1']],
  ['flip', 'Flip', ['flip', 'dji flip']],
  ['neo', 'Neo', ['neo', 'dji neo']],
  ['neo-2', 'Neo 2', ['neo 2', 'dji neo 2']],
  ['mini', 'Mini', ['mini', 'dji mini']],
  ['mini-se', 'Mini SE', ['mini se', 'dji mini se']],
  ['mini-2', 'Mini 2', ['mini 2', 'dji mini 2']],
  ['mini-2-se', 'Mini 2 SE', ['mini 2 se', 'mini 2se', 'dji mini 2 se']],
  ['mini-4k', 'Mini 4K', ['mini 4k', 'dji mini 4k']],
  ['mini-3', 'Mini 3', ['mini 3', 'dji mini 3']],
  ['mini-3-pro', 'Mini 3 Pro', ['mini 3 pro', 'dji mini 3 pro']],
  ['mini-4-pro', 'Mini 4 Pro', ['mini 4 pro', 'dji mini 4 pro']],
  ['mini-5-pro', 'Mini 5 Pro', ['mini 5 pro', 'dji mini 5 pro']],
  ['air', 'Air', ['air', 'dji air']],
  ['air-2s', 'Air 2S', ['air 2s', 'dji air 2s']],
  ['air-2', 'Air 2', ['air 2', 'dji air 2']],
  ['air-3', 'Air 3', ['air 3', 'dji air 3']],
  ['air-3s', 'Air 3S', ['air 3s', 'dji air 3s']],
  ['avata', 'Avata', ['avata', 'dji avata']],
  ['avata-2', 'Avata 2', ['avata 2', 'avata 02', 'dji avata 2']],
  ['avata-360', 'Avata 360', ['avata 360', 'dji avata 360']],
  ['mavic-pro', 'Mavic Pro', ['mavic pro', 'dji mavic pro']],
  ['mavic-platinum', 'Mavic Platinum', ['mavic platinum', 'dji mavic platinum']],
  ['mavic-2', 'Mavic 2', ['mavic 2', 'dji mavic 2']],
  ['mavic-2-pro', 'Mavic 2 Pro', ['mavic 2 pro', 'dji mavic 2 pro']],
  ['mavic-2-zoom', 'Mavic 2 Zoom', ['mavic 2 zoom', 'dji mavic 2 zoom']],
  ['mavic-3', 'Mavic 3', ['mavic 3', 'dji mavic 3']],
  ['mavic-3-classic', 'Mavic 3 Classic', ['mavic 3 classic', 'dji mavic 3 classic']],
  ['mavic-3-pro', 'Mavic 3 Pro', ['mavic 3 pro', 'dji mavic 3 pro']],
  ['mavic-3-cine', 'Mavic 3 Cine', ['mavic 3 cine', 'dji mavic 3 cine']],
  ['mavic-4-pro', 'Mavic 4 Pro', ['mavic 4 pro', 'dji mavic 4 pro']],
  ['phantom-4', 'Phantom 4', ['phantom 4', 'dji phantom 4']],
  ['phantom-4-pro', 'Phantom 4 Pro', ['phantom 4 pro', 'dji phantom 4 pro']],
].map(([slug, name, aliases]) => ({ slug, name, aliases }));

const CATEGORY_PATH_BY_LABEL = new Map([
  ['drones', 'DJI > Drones Completos'],
  ['drones geral', 'DJI > Drones Completos'],
  ['flip', 'DJI > Flip'],
  ['lito', 'DJI > Linha Lito > Lito'],
  ['lito 1', 'DJI > Linha Lito > Lito'],
  ['lito x1', 'DJI > Linha Lito > Lito X1'],
  ['neo', 'DJI > Linha Neo > Neo'],
  ['neo 2', 'DJI > Linha Neo > Neo 2'],
  ['mini', 'DJI > Linha Mini > Mini'],
  ['mini se', 'DJI > Linha Mini > Mini SE'],
  ['mini 2', 'DJI > Linha Mini > Mini 2'],
  ['mini 2 se', 'DJI > Linha Mini > Mini 2 SE'],
  ['mini 4k', 'DJI > Linha Mini > Mini 4K'],
  ['mini 3', 'DJI > Linha Mini > Mini 3'],
  ['mini 3 pro', 'DJI > Linha Mini > Mini 3 Pro'],
  ['mini 4 pro', 'DJI > Linha Mini > Mini 4 Pro'],
  ['mini 5 pro', 'DJI > Linha Mini > Mini 5 Pro'],
  ['air', 'DJI > Linha Air > Air'],
  ['air 2', 'DJI > Linha Air > Air 2'],
  ['air 2s', 'DJI > Linha Air > Air 2S'],
  ['air 3', 'DJI > Linha Air > Air 3'],
  ['air 3s', 'DJI > Linha Air > Air 3S'],
  ['avata', 'DJI > Linha Avata > Avata'],
  ['avata 2', 'DJI > Linha Avata > Avata 2'],
  ['avata 360', 'DJI > Linha Avata > Avata 360'],
  ['mavic pro', 'DJI > Linha Mavic > Mavic Pro'],
  ['mavic platinum', 'DJI > Linha Mavic > Mavic Platinum'],
  ['mavic 2', 'DJI > Linha Mavic > Mavic 2'],
  ['mavic 2 pro', 'DJI > Linha Mavic > Mavic 2 Pro'],
  ['mavic 2 zoom', 'DJI > Linha Mavic > Mavic 2 Zoom'],
  ['mavic 3', 'DJI > Linha Mavic > Mavic 3'],
  ['mavic 3 classic', 'DJI > Linha Mavic > Mavic 3 Classic'],
  ['mavic 3 pro', 'DJI > Linha Mavic > Mavic 3 Pro'],
  ['mavic 3 cine', 'DJI > Linha Mavic > Mavic 3 Cine'],
  ['mavic 4 pro', 'DJI > Linha Mavic > Mavic 4 Pro'],
  ['phantom 4', 'DJI > Linha Phantom > Phantom 4'],
  ['phantom 4 pro', 'DJI > Linha Phantom > Phantom 4 Pro'],
]);

const inputPath = getArg('--input') ?? process.env.BRASIL_DRONES_CATALOG_XLSX;
const outputPath =
  getArg('--output') ??
  path.join(process.cwd(), 'outputs', 'brasil-drones-novo-catalogo', 'Catalogo_Bling_Consolidado_Importacao.xlsx');
const jsonPath =
  getArg('--json') ?? path.join(process.cwd(), 'saida_bling', 'novo_catalogo_produtos.json');
const auditPath =
  getArg('--audit') ?? path.join(process.cwd(), 'saida_bling', 'novo_catalogo_preparacao.json');
const categoryMapPath =
  getArg('--category-map') ?? path.join(process.cwd(), 'saida_bling', 'category-map.json');
const renderDir = getArg('--render-dir') ?? '/private/tmp/brasil-drones-new-catalog-render';

if (!inputPath) {
  throw new Error('Informe --input ou BRASIL_DRONES_CATALOG_XLSX.');
}

const source = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const categoryMap = JSON.parse(await fs.readFile(categoryMapPath, 'utf8'));
const baseline = readSheetRecords(source, 'Catálogo');
const baselineByCode = new Map(baseline.map((row) => [text(row['Código']), row]));
const sourceSheetNames = listSheetNames(source).filter((name) => !SOURCE_SHEETS_TO_SKIP.has(name));
const sourceProducts = [];

for (const sheetName of sourceSheetNames) {
  const records = readSheetRecords(source, sheetName);
  records.forEach((row, index) => {
    if (!text(row['Código']) && !text(row['Descrição'])) return;
    sourceProducts.push(buildProduct(row, baselineByCode, sheetName, index + 2, categoryMap));
  });
}

const products = mergeExactDuplicateProducts(sourceProducts);
markPotentialDuplicates(products);
validatePreparedProducts(products);

const categoryPlan = buildCategoryPlan(products, categoryMap);
const compatibilityRows = products.flatMap((product) =>
  product.compatibility.map((model) => ({
    code: product.code,
    name: product.name,
    primaryCategory: product.categoryPath,
    model: model.name,
    modelSlug: model.slug,
    sourceSheet: product.sourceSheet,
  }))
);
const pendingRows = buildPendingRows(products, categoryPlan);
const metadata = buildMetadata(products, categoryPlan, pendingRows);

await fs.mkdir(path.dirname(jsonPath), { recursive: true });
await fs.mkdir(path.dirname(auditPath), { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify({ metadata, categoryPlan, products }, null, 2)}\n`, 'utf8');
await fs.writeFile(
  auditPath,
  `${JSON.stringify({ metadata, changedCode: { from: '593', to: '593-MINI3-DE', product: 'Braço Completo Mini 3 Dianteiro Esquerdo' }, categoryPlan, pendingRows }, null, 2)}\n`,
  'utf8'
);

const workbook = buildWorkbook(products, compatibilityRows, pendingRows, categoryPlan, metadata);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(renderDir, { recursive: true });

const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
});
if (formulaErrors.ndjson.includes('"kind":"match"')) {
  throw new Error(`Erros de fórmula encontrados: ${formulaErrors.ndjson}`);
}

const previewRanges = new Map([
  ['Resumo', 'A1:F14'],
  ['Produtos', 'A1:Z20'],
  ['Compatibilidade', 'A1:F24'],
  ['Pendências', 'A1:E28'],
  ['Categorias', 'A1:E40'],
]);
for (const [sheetName, range] of previewRanges) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(
    path.join(renderDir, `${normalizeText(sheetName).replaceAll(' ', '-')}.png`),
    new Uint8Array(await preview.arrayBuffer())
  );
}

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

const inspection = await workbook.inspect({
  kind: 'table',
  range: 'Resumo!A1:F24',
  include: 'values,formulas',
  tableMaxRows: 24,
  tableMaxCols: 6,
});
await fs.writeFile(`${outputPath}.inspect.ndjson`, inspection.ndjson, 'utf8');

console.log(
  JSON.stringify(
    {
      inputPath,
      outputPath,
      jsonPath,
      auditPath,
      renderDir,
      ...metadata,
    },
    null,
    2
  )
);

function buildProduct(row, baselineByCode, sourceSheet, sourceRow, categoryMap) {
  const originalCode = text(row['Código']);
  const isCorrectedDuplicate =
    originalCode === '593' &&
    normalizeText(sourceSheet) === 'mini 3' &&
    normalizeText(row['Descrição']).includes('braco completo mini 3');
  const old = isCorrectedDuplicate ? {} : baselineByCode.get(originalCode) ?? {};
  const code = isCorrectedDuplicate ? '593-MINI3-DE' : originalCode;
  const alerts = [];

  const backfill = (field, fallback) => {
    if (!isBlank(row[field]) && !isInvalidEditedValue(field, row[field], old[field])) return row[field];
    if (!isBlank(old[field])) {
      alerts.push(`${field} recuperado da aba Catálogo pelo código ${originalCode}`);
      return old[field];
    }
    return fallback;
  };

  const name = text(backfill('Descrição', null));
  const type = text(backfill('Tipo', 'Produto')) || 'Produto';
  const situation = text(backfill('Situação', 'Ativo')) || 'Ativo';
  const unit = text(backfill('Unidade', null)).toUpperCase();
  const price = numberOrNull(backfill('Preço', null));
  const cost = numberOrNull(backfill('Preço de custo', null));
  const stockCell = backfill('Estoque', 0);
  const stockSource = numberOrNull(stockCell) ?? 0;
  const gtin = text(backfill('GTIN/EAN', null));
  const brand = text(backfill('Marca', 'DJI')) || 'DJI';
  const categoryOrigin = text(backfill('Categoria', sourceSheet)) || sourceSheet;
  const productLine = text(backfill('Linha de Produto', null));
  const complementaryDescription = text(backfill('Descrição Complementar', null));
  const shortDescription = text(backfill('Descrição Curta', null));
  const mainImage = text(backfill('Imagem Principal (arquivo)', null));
  const additionalImages = text(backfill('Imagens adicionais (arquivos)', null));
  const categoryPath = resolveCategoryPath(categoryOrigin, sourceSheet, name, isBlank(row['Categoria']) && isBlank(old['Categoria']));
  const categoryId = categoryMap[categoryPath] ?? null;
  const isCompleteDrone = normalizeText(name).startsWith('drone ');
  const compatibility = detectCompatibility(
    (isCompleteDrone
      ? [name, sourceSheet]
      : [name, shortDescription, complementaryDescription, sourceSheet]
    ).filter(Boolean).join(' '),
    sourceSheet
  );

  if (isCorrectedDuplicate) alerts.push('Código duplicado 593 corrigido para 593-MINI3-DE');
  if (isBlank(row['Estoque'])) alerts.push('Estoque vazio tratado como zero');
  if (isBlank(row['Marca']) && isBlank(old['Marca'])) alerts.push('Marca vazia preenchida como DJI');
  if (isBlank(row['Categoria']) && isBlank(old['Categoria'])) alerts.push(`Categoria inferida pela aba ${sourceSheet}`);
  if (!categoryId) alerts.push(`Categoria precisa ser criada no Bling: ${categoryPath}`);
  if (name.length > 120) alerts.push('Nome excede 120 caracteres e será truncado somente no payload do Bling');

  const critical = [];
  if (!code) critical.push('sem código');
  if (!name) critical.push('sem descrição');
  if (!unit) critical.push('sem unidade');
  if (price === null) critical.push('sem preço');
  if (!categoryPath) critical.push('sem categoria');

  return {
    originalCode,
    code,
    name,
    type,
    situation,
    unit,
    price,
    cost,
    stockSource,
    stockToImport: stockSource,
    gtin,
    brand,
    categoryOrigin,
    productLine,
    categoryPath,
    categoryId,
    compatibility,
    complementaryDescription,
    shortDescription,
    mainImage,
    additionalImages,
    mergedSourceCodes: [],
    sourceSheet,
    sourceRow,
    status: critical.length ? 'BLOQUEADO' : categoryId ? 'PRONTO' : 'AGUARDA_CATEGORIA',
    alerts: [...alerts, ...critical],
  };
}

function buildWorkbook(products, compatibilityRows, pendingRows, categoryPlan, metadata) {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add('Resumo');
  const productSheet = workbook.worksheets.add('Produtos');
  const compatibilitySheet = workbook.worksheets.add('Compatibilidade');
  const pendingSheet = workbook.worksheets.add('Pendências');
  const categorySheet = workbook.worksheets.add('Categorias');

  writeSummary(summary, products.length, metadata);
  writeProducts(productSheet, products);
  writeCompatibility(compatibilitySheet, compatibilityRows);
  writePending(pendingSheet, pendingRows);
  writeCategories(categorySheet, categoryPlan);
  return workbook;
}

function writeSummary(sheet, productCount, metadata) {
  sheet.showGridLines = false;
  sheet.getRange('A1:F1').merge();
  sheet.getRange('A1').values = [['Brasil Drones - novo catálogo Bling']];
  sheet.getRange('A2:F2').merge();
  sheet.getRange('A2').values = [['Consolidado das abas por modelo. O estoque enviado ao Bling será exatamente o saldo informado nessas abas.']];
  sheet.getRange('A4:B12').values = [
    ['Indicador', 'Valor'],
    ['Produtos preparados', null],
    ['Códigos únicos', null],
    ['Estoque informado nas abas', null],
    ['Estoque enviado agora', null],
    ['Produtos com estoque positivo na planilha', null],
    ['Produtos aguardando criação de categoria', null],
    ['Produtos bloqueados', null],
    ['Categorias a criar', null],
  ];
  sheet.getRange('B5').formulas = [[`=COUNTA('Produtos'!$B$2:$B$${productCount + 1})`]];
  sheet.getRange('B6').values = [[metadata.uniqueCodes]];
  sheet.getRange('B7').formulas = [[`=SUM('Produtos'!$I$2:$I$${productCount + 1})`]];
  sheet.getRange('B8').formulas = [[`=SUM('Produtos'!$J$2:$J$${productCount + 1})`]];
  sheet.getRange('B9').formulas = [[`=COUNTIF('Produtos'!$I$2:$I$${productCount + 1},">0")`]];
  sheet.getRange('B10').formulas = [[`=COUNTIF('Produtos'!$X$2:$X$${productCount + 1},"AGUARDA_CATEGORIA")`]];
  sheet.getRange('B11').formulas = [[`=COUNTIF('Produtos'!$X$2:$X$${productCount + 1},"BLOQUEADO")`]];
  sheet.getRange('B12').values = [[metadata.categoriesToCreate]];

  sheet.getRange('D4:F10').values = [
    ['Decisão', 'Aplicação', 'Observação'],
    ['Código 593', '593-MINI3-DE', 'Aplicado apenas ao braço dianteiro esquerdo Mini 3'],
    ['Estoque', 'Saldo das abas', '504 unidades; 111 produtos positivos e os demais mantidos em zero'],
    ['GTIN/EAN', 'Não enviado', 'Mantido somente para auditoria por haver códigos repetidos'],
    ['Imagens', 'Não enviadas', 'Os caminhos do arquivo não estão presentes localmente'],
    ['Categoria', 'Uma primária', 'Compatibilidade com outros modelos está em aba separada'],
    ['Credencial', 'App privado', 'A importação rejeita as variáveis globais da Zalen Shop'],
  ];

  sheet.getRange('A1:F1').format = { fill: '#123C35', font: { bold: true, color: '#FFFFFF', size: 18 }, rowHeight: 30 };
  sheet.getRange('A2:F2').format = { fill: '#E8F3EF', font: { color: '#244C45' }, wrapText: true, rowHeight: 34 };
  sheet.getRange('A4:B4').format = headerFormat('#176B5B');
  sheet.getRange('D4:F4').format = headerFormat('#176B5B');
  sheet.getRange('A4:B12').format.borders = subtleBorders();
  sheet.getRange('D4:F10').format.borders = subtleBorders();
  sheet.getRange('B5:B12').format.numberFormat = '#,##0';
  sheet.getRange('A:A').format.columnWidth = 38;
  sheet.getRange('B:B').format.columnWidth = 18;
  sheet.getRange('C:C').format.columnWidth = 3;
  sheet.getRange('D:D').format.columnWidth = 24;
  sheet.getRange('E:E').format.columnWidth = 24;
  sheet.getRange('F:F').format.columnWidth = 48;
}

function writeProducts(sheet, products) {
  const headers = [
    'Código original', 'Código Bling', 'Descrição', 'Tipo', 'Situação', 'Unidade', 'Preço', 'Preço de custo',
    'Estoque na planilha', 'Estoque enviado agora', 'GTIN/EAN', 'Marca', 'Categoria origem', 'Linha de Produto',
    'Categoria Bling', 'Categoria Bling ID', 'Modelos compatíveis', 'Descrição complementar', 'Descrição curta',
    'Imagem principal (arquivo)', 'Imagens adicionais (arquivos)', 'Aba origem', 'Linha origem', 'Status', 'Alertas',
    'Códigos de origem mesclados',
  ];
  const values = products.map((product) => [
    product.originalCode, product.code, product.name, product.type, product.situation, product.unit, product.price,
    product.cost, product.stockSource, product.stockToImport, product.gtin, product.brand, product.categoryOrigin,
    product.productLine, product.categoryPath, product.categoryId, product.compatibility.map((item) => item.name).join(' | '),
    product.complementaryDescription, product.shortDescription, product.mainImage, product.additionalImages,
    product.sourceSheet, product.sourceRow, product.status, product.alerts.join(' | '), product.mergedSourceCodes.join(' | '),
  ]);
  const endRow = values.length + 1;
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(1, 0, values.length, headers.length).values = values;
  sheet.getRange(`A1:Z${endRow}`).format.borders = { insideHorizontal: { style: 'thin', color: '#DCE5E2' } };
  sheet.getRange('A1:Z1').format = headerFormat('#123C35');
  sheet.getRange(`G2:J${endRow}`).format.numberFormat = '#,##0.00';
  sheet.getRange(`A2:B${endRow}`).format.numberFormat = '@';
  sheet.getRange(`K2:K${endRow}`).format.numberFormat = '@';
  sheet.getRange(`C2:C${endRow}`).format.wrapText = true;
  sheet.getRange(`Q2:Y${endRow}`).format.wrapText = true;
  setColumnWidths(sheet, [16, 18, 58, 12, 12, 10, 14, 16, 18, 18, 18, 20, 22, 20, 42, 18, 44, 58, 50, 42, 42, 20, 12, 22, 60, 24]);
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(2);
  const table = sheet.tables.add(`A1:Z${endRow}`, true, 'ProdutosPreparados');
  table.style = 'TableStyleMedium4';
}

function writeCompatibility(sheet, rows) {
  const headers = ['Código Bling', 'Descrição', 'Categoria primária', 'Modelo compatível', 'Slug do modelo', 'Aba origem'];
  const values = rows.map((row) => [row.code, row.name, row.primaryCategory, row.model, row.modelSlug, row.sourceSheet]);
  const endRow = values.length + 1;
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (values.length) sheet.getRangeByIndexes(1, 0, values.length, headers.length).values = values;
  sheet.getRange('A1:F1').format = headerFormat('#123C35');
  setColumnWidths(sheet, [18, 58, 42, 24, 24, 20]);
  sheet.freezePanes.freezeRows(1);
  if (values.length) {
    const table = sheet.tables.add(`A1:F${endRow}`, true, 'CompatibilidadeModelos');
    table.style = 'TableStyleMedium4';
  }
}

function writePending(sheet, rows) {
  const headers = ['Código Bling', 'Descrição', 'Tipo', 'Detalhe', 'Ação'];
  const values = rows.map((row) => [row.code, row.name, row.type, row.detail, row.action]);
  const endRow = values.length + 1;
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (values.length) sheet.getRangeByIndexes(1, 0, values.length, headers.length).values = values;
  sheet.getRange('A1:E1').format = headerFormat('#8A4B17');
  setColumnWidths(sheet, [18, 58, 24, 58, 44]);
  sheet.getRange(`B2:E${Math.max(2, endRow)}`).format.wrapText = true;
  sheet.freezePanes.freezeRows(1);
  if (values.length) {
    const table = sheet.tables.add(`A1:E${endRow}`, true, 'PendenciasCatalogo');
    table.style = 'TableStyleMedium9';
  }
}

function writeCategories(sheet, rows) {
  const headers = ['Categoria Bling', 'ID atual', 'Produtos', 'Situação', 'Ação'];
  const values = rows.map((row) => [row.path, row.id, row.productCount, row.status, row.action]);
  const endRow = values.length + 1;
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(1, 0, values.length, headers.length).values = values;
  sheet.getRange('A1:E1').format = headerFormat('#123C35');
  setColumnWidths(sheet, [48, 18, 14, 22, 42]);
  sheet.freezePanes.freezeRows(1);
  const table = sheet.tables.add(`A1:E${endRow}`, true, 'CategoriasCatalogo');
  table.style = 'TableStyleMedium4';
}

function buildCategoryPlan(products, categoryMap) {
  const counts = new Map();
  for (const product of products) counts.set(product.categoryPath, (counts.get(product.categoryPath) ?? 0) + 1);
  return [...counts.entries()]
    .map(([categoryPath, productCount]) => {
      const id = categoryMap[categoryPath] ?? null;
      return {
        path: categoryPath,
        id,
        productCount,
        status: id ? 'EXISTENTE' : 'CRIAR_ANTES_DA_IMPORTACAO',
        action: id ? 'Nenhuma' : 'Criar pelo app privado Brasil Drones e atualizar o mapa',
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'pt-BR'));
}

function buildPendingRows(products, categoryPlan) {
  const rows = [];
  for (const product of products) {
    for (const alert of product.alerts) {
      if (alert.startsWith('Estoque vazio tratado')) continue;
      rows.push({
        code: product.code,
        name: product.name,
        type: alert.includes('duplicado') ? 'CORREÇÃO' : 'AUDITORIA',
        detail: alert,
        action: alert.includes('Categoria precisa') ? 'Criar categoria antes do produto' : 'Conferir após a carga',
      });
    }
  }
  for (const category of categoryPlan.filter((item) => !item.id)) {
    rows.push({
      code: '',
      name: category.path,
      type: 'CATEGORIA',
      detail: `${category.productCount} produto(s) dependem desta categoria`,
      action: category.action,
    });
  }
  return rows;
}

function buildMetadata(products, categoryPlan, pendingRows) {
  return {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: inputPath,
    sourceRows: sourceProducts.length,
    totalProducts: products.length,
    uniqueCodes: new Set(products.map((item) => item.code)).size,
    stockSourceTotal: round2(products.reduce((total, item) => total + item.stockSource, 0)),
    stockImportTotal: round2(products.reduce((total, item) => total + item.stockToImport, 0)),
    productsWithPositiveSourceStock: products.filter((item) => item.stockSource > 0).length,
    productsWithZeroImportStock: products.filter((item) => item.stockToImport === 0).length,
    blockedProducts: products.filter((item) => item.status === 'BLOQUEADO').length,
    categoriesToCreate: categoryPlan.filter((item) => !item.id).length,
    pendingRows: pendingRows.length,
    correctedCode: '593-MINI3-DE',
    mergedDuplicateProducts: sourceProducts.length - products.length,
    credentialsPolicy: 'BLING_CUSTOMER_* only',
  };
}

function validatePreparedProducts(products) {
  if (sourceProducts.length !== 600) throw new Error(`Esperadas 600 linhas de origem, encontradas ${sourceProducts.length}.`);
  if (products.length !== 599) throw new Error(`Esperados 599 produtos únicos após mesclar duplicata exata, encontrados ${products.length}.`);
  const seen = new Map();
  for (const product of products) {
    const existing = seen.get(product.code);
    if (existing) throw new Error(`Código duplicado após correção: ${product.code} (${existing.name} / ${product.name}).`);
    seen.set(product.code, product);
  }
  const blocked = products.filter((product) => product.status === 'BLOQUEADO');
  if (blocked.length) {
    throw new Error(`Há ${blocked.length} produto(s) sem campos críticos: ${blocked.map((item) => item.code).join(', ')}.`);
  }
  if (products.some((product) => product.stockSource < 0 || product.stockToImport < 0)) {
    throw new Error('A preparação encontrou estoque negativo.');
  }
  if (products.some((product) => product.stockToImport !== product.stockSource)) {
    throw new Error('O estoque preparado diverge do estoque das abas por modelo.');
  }
  const stockTotal = round2(products.reduce((total, product) => total + product.stockToImport, 0));
  if (stockTotal !== 504) throw new Error(`O estoque preparado deveria totalizar 504 unidades; recebeu ${stockTotal}.`);
}

function mergeExactDuplicateProducts(products) {
  const canonicalByKey = new Map();
  const merged = [];
  for (const product of products) {
    const key = `${normalizeText(product.name)}::${product.gtin}`;
    const canonical = product.gtin ? canonicalByKey.get(key) : null;
    if (!canonical) {
      canonicalByKey.set(key, product);
      merged.push(product);
      continue;
    }
    canonical.mergedSourceCodes.push(product.code);
    canonical.alerts.push(`Produto idêntico do código ${product.code} mesclado neste SKU`);
    canonical.compatibility = [
      ...new Map([...canonical.compatibility, ...product.compatibility].map((item) => [item.slug, item])).values(),
    ].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }
  return merged;
}

function markPotentialDuplicates(products) {
  const groups = new Map();
  for (const product of products) {
    const key = `${normalizeText(product.name)}::${product.gtin}`;
    if (!normalizeText(product.name) || !product.gtin) continue;
    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const codes = group.map((item) => item.code).join(', ');
    group.forEach((product) => product.alerts.push(`Mesmo nome e GTIN aparecem nos códigos: ${codes}`));
  }
}

function detectCompatibility(value, sourceSheet) {
  const normalized = normalizeText(value);
  const candidates = [];
  for (const model of MODEL_DEFINITIONS) {
    const matched = model.aliases
      .map(normalizeText)
      .filter((alias) => containsPhrase(normalized, alias))
      .sort((left, right) => right.length - left.length)[0];
    if (matched) candidates.push({ model, specificity: matched.split(' ').length });
  }
  const bestByFamily = new Map();
  for (const candidate of candidates) {
    const family = candidate.model.slug.split('-')[0];
    bestByFamily.set(family, Math.max(bestByFamily.get(family) ?? 0, candidate.specificity));
  }
  const detected = candidates
    .filter((candidate) => candidate.specificity === bestByFamily.get(candidate.model.slug.split('-')[0]))
    .map((candidate) => ({ slug: candidate.model.slug, name: candidate.model.name }));

  const sourceModel = MODEL_DEFINITIONS.find((model) => normalizeText(model.name) === normalizeText(sourceSheet));
  if (sourceModel && !detected.some((item) => item.slug === sourceModel.slug)) {
    detected.push({ slug: sourceModel.slug, name: sourceModel.name });
  }
  return [...new Map(detected.map((item) => [item.slug, item])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function resolveCategoryPath(category, sourceSheet, productName, categoryWasEmpty) {
  const normalizedName = normalizeText(productName);
  if (categoryWasEmpty && /\b(controle|remote|radio)\b/.test(normalizedName)) {
    return 'DJI > Peças Originais DJI > Controles Remotos';
  }
  const candidates = [category, sourceSheet.replace(' - Geral', '')];
  for (const candidate of candidates) {
    const pathValue = CATEGORY_PATH_BY_LABEL.get(normalizeText(candidate));
    if (pathValue) return pathValue;
  }
  return 'DJI > Outros a Classificar';
}

function readSheetRecords(workbook, sheetName) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getUsedRange(true)?.values ?? [];
  if (!values.length) return [];
  const headers = values[0].map((value) => text(value));
  return values.slice(1).map((row) =>
    Object.fromEntries(SOURCE_HEADERS.map((header) => [header, row[headers.indexOf(header)] ?? null]))
  );
}

function listSheetNames(workbook) {
  return workbook.worksheets.items.map((sheet) => sheet.name);
}

function headerFormat(fill) {
  return {
    fill,
    font: { bold: true, color: '#FFFFFF' },
    wrapText: true,
    verticalAlignment: 'center',
    rowHeight: 30,
  };
}

function subtleBorders() {
  return {
    outside: { style: 'thin', color: '#CAD8D4' },
    insideHorizontal: { style: 'thin', color: '#DFE8E5' },
  };
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width;
  });
}

function containsPhrase(textValue, phrase) {
  return (` ${textValue} `).includes(` ${phrase} `);
}

function normalizeText(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isBlank(value) {
  return value === null || value === undefined || text(value) === '';
}

function isInvalidEditedValue(field, value, baselineValue) {
  if (isBlank(baselineValue)) return false;
  if (field === 'Descrição' && (value === 0 || text(value) === '0')) return true;
  if (field === 'Preço' && Number(value) === 0 && Number(baselineValue) > 0) return true;
  return false;
}

function numberOrNull(value) {
  if (isBlank(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
