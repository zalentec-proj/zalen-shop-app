import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const RESULT_FILE = path.join(OUT, '23_auditoria_marketplaces_bling.json');
const CSV_ANUNCIOS_FILE = path.join(OUT, '23_auditoria_marketplaces_anuncios.csv');
const CSV_VINCULOS_FILE = path.join(OUT, '23_auditoria_marketplaces_vinculos.csv');
const REPORT_FILE = path.join(OUT, '23_auditoria_marketplaces_bling.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const REQUEST_DELAY_MS = Number(process.env.BLING_AUDIT_DELAY_MS ?? 350);
const PAGE_LIMIT = Number(process.env.BLING_AUDIT_LIMIT ?? 100);
const MAX_PAGES = Number(process.env.BLING_AUDIT_MAX_PAGES ?? 20);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const token = await loadAccessToken();
  if (!token) throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para auditoria.');

  const localProducts = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  const localProductsBySku = new Map(localProducts.filter((item) => item.sku).map((item) => [String(item.sku), item]));

  const endpoints = {};
  const errors = [];

  endpoints.canaisVendaTipos = await safeGet(() => bling(token, 'GET', '/canais-venda/tipos'), errors, 'canais-venda/tipos');
  endpoints.canaisVenda = await safeList(token, '/canais-venda', {}, errors, 'canais-venda');
  const canaisRows = endpoints.canaisVenda.map(normalizeCanal);
  endpoints.canaisVendaDetalhes = {};
  for (const canal of canaisRows) {
    if (!canal.id) continue;
    endpoints.canaisVendaDetalhes[canal.id] = await safeGet(
      () => bling(token, 'GET', `/canais-venda/${canal.id}`),
      errors,
      `canais-venda/${canal.id}`
    );
  }
  const marketplaceCanais = canaisRows.filter((row) => isMercadoLivreLike(row) || isShopeeLike(row));
  endpoints.produtosLojas = [];
  endpoints.produtosLojasPorCanal = {};
  for (const canal of marketplaceCanais) {
    const rows = await safeList(token, '/produtos/lojas', { idLoja: canal.id }, errors, `produtos/lojas_${canal.id}`);
    endpoints.produtosLojasPorCanal[canal.id] = rows;
    endpoints.produtosLojas.push(...rows);
  }
  endpoints.anuncios = {};
  for (const canal of marketplaceCanais) {
    endpoints.anuncios[canal.id] = {};
    for (const situacao of [1, 2, 3, 4]) {
      endpoints.anuncios[canal.id][situacao] = await safeList(
        token,
        '/anuncios',
        { situacao, idLoja: canal.id, tipoIntegracao: canal.tipo },
        errors,
        `anuncios_${canal.id}_${canal.tipo}_situacao_${situacao}`
      );
    }
  }

  const anunciosRows = Object.entries(endpoints.anuncios)
    .flatMap(([idCanalVenda, byStatus]) =>
      Object.entries(byStatus).flatMap(([situacao, rows]) =>
        rows.map((row) => normalizeAnuncio(row, Number(situacao), Number(idCanalVenda)))
      )
    )
    .filter((row, index, list) => list.findIndex((candidate) => candidate.id === row.id && candidate.id) === index);
  const vinculosRows = endpoints.produtosLojas.map(normalizeVinculo);

  const skusAnuncios = new Set(anunciosRows.flatMap((row) => extractSkuCandidates(row.raw)).filter(Boolean));
  const skusVinculos = new Set(vinculosRows.flatMap((row) => [row.sku, row.codigo]).filter(Boolean));
  const knownSkus = new Set([...localProductsBySku.keys()]);

  const matchedAnuncioSkus = [...skusAnuncios].filter((sku) => knownSkus.has(sku));
  const matchedVinculoSkus = [...skusVinculos].filter((sku) => knownSkus.has(sku));
  const localWithoutMarketplaceMatch = [...knownSkus].filter((sku) => !skusAnuncios.has(sku) && !skusVinculos.has(sku));

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    readOnly: true,
    methodsUsed: ['GET'],
    canaisVenda: canaisRows.length,
    canaisMercadoLivreProvaveis: canaisRows.filter(isMercadoLivreLike).length,
    canaisShopeeProvaveis: canaisRows.filter(isShopeeLike).length,
    anunciosTotal: anunciosRows.length,
    anunciosPorSituacao: countBy(anunciosRows, (row) => statusLabel(row.situacao)),
    vinculosProdutosLojas: vinculosRows.length,
    skusLocais: knownSkus.size,
    skusAnunciosDetectados: skusAnuncios.size,
    skusVinculosDetectados: skusVinculos.size,
    skusAnunciosBatendoComBlingLocal: matchedAnuncioSkus.length,
    skusVinculosBatendoComBlingLocal: matchedVinculoSkus.length,
    skusLocaisSemMatchDetectado: localWithoutMarketplaceMatch.length,
    errors: errors.length,
  };

  const result = {
    summary,
    canais: canaisRows.map((canal) => ({
      ...canal,
      detalhes: endpoints.canaisVendaDetalhes[canal.id]?.[0] ?? null,
    })),
    anuncios: anunciosRows.map(({ raw, ...row }) => row),
    vinculos: vinculosRows.map(({ raw, ...row }) => row),
    matches: {
      matchedAnuncioSkus,
      matchedVinculoSkus,
      localWithoutMarketplaceMatch,
    },
    raw: endpoints,
    errors,
    sources: [
      'https://developer.bling.com.br/bling-api',
      'https://developer.bling.com.br/referencia',
    ],
  };

  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await fs.writeFile(CSV_ANUNCIOS_FILE, toCsv(anunciosRows.map(({ raw, ...row }) => row)), 'utf8');
  await fs.writeFile(CSV_VINCULOS_FILE, toCsv(vinculosRows.map(({ raw, ...row }) => row)), 'utf8');
  await fs.writeFile(REPORT_FILE, toMarkdown(result), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

async function safeGet(fn, errors, scope) {
  await sleep(REQUEST_DELAY_MS);
  try {
    const response = await fn();
    return unwrapRows(response);
  } catch (error) {
    errors.push({ scope, error: safeError(error) });
    return [];
  }
}

async function safeList(token, endpoint, query, errors, scope) {
  const rows = [];
  for (let pagina = 1; pagina <= MAX_PAGES; pagina += 1) {
    await sleep(REQUEST_DELAY_MS);
    try {
      const response = await bling(token, 'GET', endpoint, undefined, { ...query, pagina, limite: PAGE_LIMIT });
      const pageRows = unwrapRows(response);
      rows.push(...pageRows);
      if (pageRows.length < PAGE_LIMIT) break;
    } catch (error) {
      errors.push({ scope, pagina, error: safeError(error) });
      break;
    }
  }
  return rows;
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
  if (method !== 'GET') throw new Error(`Auditoria bloqueou método não leitura: ${method}`);
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

function unwrapRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (response?.data && typeof response.data === 'object') return [response.data];
  return [];
}

function normalizeCanal(row) {
  const flat = flatten(row);
  return {
    id: firstValue(flat, ['id', 'idCanalVenda']),
    nome: firstValue(flat, ['nome', 'descricao', 'canal', 'loja']),
    tipo: firstValue(flat, ['tipo', 'tipo.descricao', 'tipo.nome', 'idTipo']),
    situacao: firstValue(flat, ['situacao', 'status']),
    raw: row,
  };
}

function normalizeAnuncio(row, situacao, fallbackIdCanalVenda = '') {
  const flat = flatten(row);
  const id = firstValue(flat, ['id', 'idAnuncio', 'codigo', 'codigoAnuncio']);
  return {
    id,
    situacao,
    situacao_label: statusLabel(situacao),
    titulo: firstValue(flat, ['titulo', 'descricao', 'nome']),
    idProduto: firstValue(flat, ['produto.id', 'idProduto']),
    idCanalVenda: firstValue(flat, ['canalVenda.id', 'idCanalVenda', 'loja.id', 'idLoja']) || fallbackIdCanalVenda,
    sku_detectado: extractSkuCandidates(row)[0] ?? '',
    codigo: firstValue(flat, ['codigo', 'sku', 'produto.codigo', 'variacao.codigo']),
    preco: firstValue(flat, ['preco', 'valor', 'produto.preco']),
    estoque: firstValue(flat, ['estoque', 'saldo', 'quantidade']),
    raw: row,
  };
}

function normalizeVinculo(row) {
  const flat = flatten(row);
  return {
    id: firstValue(flat, ['id', 'idProdutoLoja']),
    idProduto: firstValue(flat, ['produto.id', 'idProduto']),
    idLoja: firstValue(flat, ['loja.id', 'idLoja', 'canalVenda.id', 'idCanalVenda']),
    codigo: firstValue(flat, ['codigo', 'produto.codigo']),
    sku: firstValue(flat, ['sku', 'produto.sku', 'produto.codigo']),
    descricao: firstValue(flat, ['descricao', 'produto.descricao', 'produto.nome', 'nome']),
    preco: firstValue(flat, ['preco', 'produto.preco']),
    raw: row,
  };
}

function extractSkuCandidates(value) {
  const candidates = new Set();
  const flat = flatten(value);
  for (const [key, val] of Object.entries(flat)) {
    if (/sku|codigo|seller|custom|referencia/i.test(key)) {
      for (const candidate of String(val ?? '').match(/BDP-[A-Z0-9-]+-L\d{3}(?:-[A-Z])?/g) ?? []) {
        candidates.add(candidate);
      }
      if (/^BDP-/i.test(String(val ?? ''))) candidates.add(String(val).trim());
    }
  }
  return [...candidates];
}

function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (prefix) out[prefix] = value;
  return out;
}

function firstValue(flat, keys) {
  for (const key of keys) {
    if (flat[key] !== undefined && flat[key] !== null && flat[key] !== '') return flat[key];
  }
  const lowerKeys = new Map(Object.entries(flat).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lowerKeys.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function statusLabel(situacao) {
  return {
    1: 'Publicado',
    2: 'Rascunho',
    3: 'Com problema',
    4: 'Pausado',
  }[situacao] ?? String(situacao);
}

function isMercadoLivreLike(row) {
  return /mercado\s*livre|mercadolivre|meli|\bml\b/i.test(`${row.nome} ${row.tipo}`);
}

function isShopeeLike(row) {
  return /shopee/i.test(`${row.nome} ${row.tipo}`);
}

function toMarkdown(result) {
  const s = result.summary;
  return [
    '# Auditoria read-only Bling Marketplaces',
    '',
    `Gerado em: ${s.finishedAt}`,
    `Somente leitura: ${s.readOnly ? 'sim' : 'não'}`,
    `Métodos usados: ${s.methodsUsed.join(', ')}`,
    '',
    '## Resumo',
    `- Canais de venda: ${s.canaisVenda}`,
    `- Canais Mercado Livre prováveis: ${s.canaisMercadoLivreProvaveis}`,
    `- Canais Shopee prováveis: ${s.canaisShopeeProvaveis}`,
    `- Anúncios detectados: ${s.anunciosTotal}`,
    `- Vínculos produto-loja: ${s.vinculosProdutosLojas}`,
    `- SKUs locais Brasil Drones: ${s.skusLocais}`,
    `- SKUs em anúncios batendo com cadastro local: ${s.skusAnunciosBatendoComBlingLocal}`,
    `- SKUs em vínculos batendo com cadastro local: ${s.skusVinculosBatendoComBlingLocal}`,
    `- SKUs locais sem match detectado: ${s.skusLocaisSemMatchDetectado}`,
    `- Erros de leitura: ${s.errors}`,
    '',
    '## Anúncios por situação',
    ...Object.entries(s.anunciosPorSituacao).map(([status, count]) => `- ${status}: ${count}`),
    '',
    '## Próximo passo seguro',
    'Vincular anúncios existentes do Mercado Livre aos SKUs do Bling antes de ativar criação/sincronização em massa.',
  ].join('\n');
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
}

function csvCell(value) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || 'sem_valor';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
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
