import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();
const OUT = path.join(ROOT, 'saida_bling');
const REVIEW_XLSX = path.join(OUT, '01_produtos_bling_revisao.xlsx');
const REVIEW_JSON = path.join(OUT, 'produtos_bling_revisao.json');
const PAYLOADS_FILE = path.join(OUT, '06_payloads_dry_run.json');
const RESULT_FILE = path.join(OUT, '07_resultado_importacao.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const OPENAPI_URL = 'https://developer.bling.com.br/build/assets/openapi-Bv1-CYM5.json';
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const IMPORT_APPROVED = String(process.env.IMPORT_APPROVED ?? 'false').toLowerCase() === 'true';

await main();

async function main() {
  const startedAt = new Date().toISOString();
  await assertFile(REVIEW_XLSX);
  const workbookRows = readXlsxSheet(REVIEW_XLSX, 'Produtos_Bling');
  const products = await loadProducts();
  if (workbookRows.length !== products.length) {
    throw new Error(`Leitura XLSX divergiu do JSON de apoio: ${workbookRows.length} vs ${products.length}`);
  }

  const spec = await fetchJson(OPENAPI_URL);
  const schemaInfo = resolveProductPostSchema(spec);
  validatePayloadSchema(schemaInfo.properties);

  const token = await loadAccessToken();
  const existingCheck = token ? 'executed' : 'skipped_no_bling_access_token';
  const existingBySku = new Map();
  const apiErrors = [];

  if (token) {
    for (const product of products) {
      if (product.status_cadastro === 'BLOQUEADO_REVISAR') continue;
      try {
        const existing = await findProductBySku(token, product.sku);
        if (existing) existingBySku.set(product.sku, existing);
      } catch (error) {
        apiErrors.push({ sku: product.sku, error: safeError(error) });
      }
    }
  }

  const payloads = [];
  const blocked = [];
  const existing = [];
  const validationErrors = [];

  for (const product of products) {
    if (product.status_cadastro === 'BLOQUEADO_REVISAR') {
      blocked.push(toResult(product, 'BLOQUEADO_REVISAR', 'status_cadastro bloqueado'));
      continue;
    }
    const found = existingBySku.get(product.sku);
    if (found) {
      existing.push(toResult(product, 'EXISTENTE', `Bling ID ${found.id ?? ''}`.trim()));
      continue;
    }
    const payload = buildPayload(product, schemaInfo.properties);
    const missingRequired = (schemaInfo.required ?? []).filter(
      (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
    );
    if (missingRequired.length) {
      validationErrors.push(
        toResult(product, 'ERRO_SCHEMA', `Campos obrigatórios ausentes: ${missingRequired.join(', ')}`)
      );
      continue;
    }
    payloads.push({ linha_ods: product.linha_ods, sku: product.sku, payload });
  }

  const dryRunDocument = {
    dryRun: DRY_RUN,
    importApproved: IMPORT_APPROVED,
    generatedAt: new Date().toISOString(),
    sourceWorkbook: REVIEW_XLSX,
    openapiUrl: OPENAPI_URL,
    schema: {
      requestSchema: schemaInfo.name,
      required: schemaInfo.required,
      propertiesUsed: Object.keys(schemaInfo.properties).filter((key) =>
        ['codigo', 'nome', 'tipo', 'situacao', 'unidade', 'preco', 'precoCusto', 'marca', 'ncm', 'categoria', 'descricaoCurta', 'formato'].includes(key)
      ),
    },
    summary: buildSummary(products, payloads, existing, blocked, validationErrors, apiErrors, existingCheck),
    payloads,
    existing,
    blocked,
    validationErrors,
    apiErrors,
  };

  await fs.writeFile(PAYLOADS_FILE, `${JSON.stringify(dryRunDocument, null, 2)}\n`, 'utf8');

  if (DRY_RUN || !IMPORT_APPROVED) {
    const result = {
      status: 'dry_run_only',
      startedAt,
      finishedAt: new Date().toISOString(),
      reason: DRY_RUN ? 'DRY_RUN=true' : 'IMPORT_APPROVED=false',
      ...dryRunDocument.summary,
    };
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await appendImportReport(result, dryRunDocument);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!token) {
    throw new Error('BLING_ACCESS_TOKEN obrigatório para importação real.');
  }

  const imported = [];
  for (const item of payloads) {
    try {
      const response = await bling(token, 'POST', '/produtos', item.payload);
      imported.push({ ...item, status: 'CRIADO', bling_id: response.data?.id ?? response.id ?? null });
    } catch (error) {
      imported.push({ ...item, status: 'ERRO_API', erro: safeError(error) });
    }
  }

  const result = {
    status: 'completed',
    startedAt,
    finishedAt: new Date().toISOString(),
    imported,
    existing,
    blocked,
    validationErrors,
    apiErrors,
  };
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendImportReport(result, dryRunDocument);
  console.log(JSON.stringify(result, null, 2));
}

async function loadProducts() {
  const parsed = JSON.parse(await fs.readFile(REVIEW_JSON, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length !== 78) {
    throw new Error(`Arquivo de produtos inválido: esperado 78, recebido ${Array.isArray(parsed) ? parsed.length : 'n/a'}`);
  }
  return parsed;
}

async function loadAccessToken() {
  if (process.env.BLING_ACCESS_TOKEN) {
    return process.env.BLING_ACCESS_TOKEN;
  }
  if (!process.env.BLING_AUTH_CODE) {
    return undefined;
  }
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
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: process.env.BLING_AUTH_CODE,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.access_token) {
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }
  return parsed.access_token;
}

function buildPayload(product, properties) {
  const payload = {
    codigo: product.sku,
    nome: product.nome_bling,
    tipo: 'P',
    situacao: product.situacao_sugerida || 'A',
    preco: product.preco_venda,
    marca: 'DJI',
    formato: 'S',
    categoria: { id: Number(product.categoria_bling_id) },
    descricaoCurta: product.descricao_curta,
  };
  if (properties.precoCusto && product.custo_unitario !== null && product.custo_unitario !== '') {
    payload.precoCusto = product.custo_unitario;
  }
  if (properties.ncm && product.ncm) payload.ncm = product.ncm;
  if (properties.unidade && product.unidade) payload.unidade = product.unidade;
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''));
}

function buildSummary(products, payloads, existing, blocked, validationErrors, apiErrors, existingCheck) {
  return {
    existingCheck,
    totalProdutos: products.length,
    criar: payloads.length,
    existentes: existing.length,
    bloqueados: blocked.length,
    errosValidacao: validationErrors.length,
    errosApi: apiErrors.length,
    comNcmPendente: products.filter((p) => !p.ncm || p.ncm_status === 'REVISAR').length,
    semGtin: products.filter((p) => !p.gtin).length,
    semImagem: products.filter((p) => !p.url_imagem).length,
    valorTotalEstoque: round2(products.reduce((sum, p) => sum + Number(p.valor_estoque_venda ?? 0), 0)),
    estoqueTotalUnidades: round2(products.reduce((sum, p) => sum + Number(p.quantidade ?? 0), 0)),
  };
}

async function findProductBySku(token, sku) {
  const response = await bling(token, 'GET', '/produtos', undefined, { codigo: sku, limite: 100 });
  const data = response.data ?? [];
  return data.find((item) => String(item.codigo ?? '') === sku) ?? null;
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
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`HTTP ${response.status} ${extractBlingError(parsed)}`);
  return parsed;
}

function resolveProductPostSchema(spec) {
  const schema = spec.paths?.['/produtos']?.post?.requestBody?.content?.['application/json']?.schema;
  if (!schema?.$ref) throw new Error('OpenAPI Bling sem schema POST /produtos.');
  const name = schema.$ref.split('/').at(-1);
  const resolved = resolveSchema(spec, schema);
  return {
    name,
    properties: resolved.properties ?? {},
    required: resolved.required ?? [],
  };
}

function resolveSchema(spec, schema, seen = new Set()) {
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (seen.has(name)) return {};
    seen.add(name);
    return resolveSchema(spec, spec.components.schemas[name], seen);
  }
  const output = { properties: { ...(schema.properties ?? {}) }, required: [...(schema.required ?? [])] };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const child of schema[key] ?? []) {
      const resolved = resolveSchema(spec, child, seen);
      Object.assign(output.properties, resolved.properties ?? {});
      output.required.push(...(resolved.required ?? []));
    }
  }
  return output;
}

function validatePayloadSchema(properties) {
  const requiredFields = ['codigo', 'nome', 'tipo', 'situacao', 'preco', 'categoria'];
  const missing = requiredFields.filter((field) => !properties[field]);
  if (missing.length) {
    throw new Error(`Schema POST /produtos não contém campos esperados: ${missing.join(', ')}`);
  }
}

function readXlsxSheet(file, sheetName) {
  const workbookXml = unzipText(file, 'xl/workbook.xml');
  const relsXml = unzipText(file, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = readSharedStrings(file);
  const sheetMatch = [...workbookXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)].find(
    (match) => decodeXml(match[1]) === sheetName
  );
  if (!sheetMatch) throw new Error(`Aba não encontrada no XLSX: ${sheetName}`);
  const relId = sheetMatch[2];
  const relMatch = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)]
    .map((match) => match[1])
    .map((attrs) => ({
      id: /Id="([^"]+)"/.exec(attrs)?.[1],
      target: /Target="([^"]+)"/.exec(attrs)?.[1],
    }))
    .find((rel) => rel.id === relId);
  if (!relMatch) throw new Error(`Relação não encontrada para aba ${sheetName}`);
  const targetValue = relMatch.target.replace(/^\/+/, '');
  const target = targetValue.startsWith('xl/')
    ? targetValue
    : targetValue.startsWith('worksheets/')
      ? `xl/${targetValue}`
      : `xl/worksheets/${path.basename(targetValue)}`;
  const sheetXml = unzipText(file, target);
  const rows = [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => parseRow(rowMatch[1], sharedStrings));
  const headers = rows.shift() ?? [];
  return rows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
    .filter((row) => Object.values(row).some((value) => String(value).trim()));
}

function parseRow(xml, sharedStrings) {
  const cells = [];
  for (const match of xml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = match[1];
    const body = match[2];
    const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
    const colIndex = ref ? columnIndex(ref[1]) : cells.length;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    let value = '';
    if (type === 'inlineStr') {
      value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
    } else {
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
      value = type === 's' ? sharedStrings[Number(raw)] ?? '' : decodeXml(raw);
    }
    cells[colIndex] = value;
  }
  return cells;
}

function readSharedStrings(file) {
  try {
    const xml = unzipText(file, 'xl/sharedStrings.xml');
    return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('')
    );
  } catch {
    return [];
  }
}

function unzipText(file, innerPath) {
  return execFileSync('unzip', ['-p', file, innerPath], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function columnIndex(col) {
  let value = 0;
  for (const char of col) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ZalenShopBrasilDrones/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  return response.json();
}

async function assertFile(file) {
  try {
    await fs.access(file);
  } catch {
    throw new Error(`Arquivo obrigatório não encontrado: ${file}`);
  }
}

async function appendImportReport(result, dryRunDocument) {
  const text = await fs.readFile(REPORT_FILE, 'utf8').catch(() => '');
  const section = [
    '',
    '## Dry-run de produtos',
    `- Gerado em: ${new Date().toISOString()}`,
    `- Modo: ${DRY_RUN ? 'DRY_RUN' : 'IMPORTAÇÃO REAL'}`,
    `- Produtos a criar: ${dryRunDocument.summary.criar}`,
    `- Produtos existentes: ${dryRunDocument.summary.existentes}`,
    `- Checagem de existentes: ${dryRunDocument.summary.existingCheck}`,
    `- Produtos bloqueados: ${dryRunDocument.summary.bloqueados}`,
    `- Produtos com NCM pendente: ${dryRunDocument.summary.comNcmPendente}`,
    `- Produtos sem GTIN: ${dryRunDocument.summary.semGtin}`,
    `- Produtos sem imagem: ${dryRunDocument.summary.semImagem}`,
    `- Valor total de estoque: R$ ${dryRunDocument.summary.valorTotalEstoque}`,
    `- Estoque total em unidades: ${dryRunDocument.summary.estoqueTotalUnidades}`,
    `- Resultado: ${result.status}`,
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function extractBlingError(body) {
  return body?.error?.type ?? body?.error?.message ?? body?.error ?? 'bling_request_failed';
}

function toResult(product, status, message) {
  return {
    linha_ods: product.linha_ods,
    sku: product.sku,
    nome_bling: product.nome_bling,
    status,
    message,
  };
}

function safeError(error) {
  if (error instanceof Error) return error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  return 'unknown_error';
}

function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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
