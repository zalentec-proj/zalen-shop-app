import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const DRY_RUN_FILE = path.join(OUT, '21_pesos_medidas_dry_run.json');
const RESULT_FILE = path.join(OUT, '22_resultado_pesos_medidas.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const OPENAPI_URL = 'https://developer.bling.com.br/build/assets/openapi-Bv1-CYM5.json';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const MEASURES_APPROVED =
  String(process.env.MEASURES_APPROVED ?? process.env.UPDATE_APPROVED ?? 'false').toLowerCase() === 'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_MEASURES_DELAY_MS ?? 700);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const dryRunDocument = JSON.parse(await fs.readFile(DRY_RUN_FILE, 'utf8'));
  const payloads = dryRunDocument.payloads ?? [];
  validatePayloads(payloads);
  const schemaInfo = await validateOpenApiSchema();

  const result = {
    status: DRY_RUN || !MEASURES_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    measuresApproved: MEASURES_APPROVED,
    startedAt,
    finishedAt: null,
    produtosPlanejados: payloads.length,
    atualizados: [],
    errors: [],
    schemaInfo,
    sources: [OPENAPI_URL, 'https://developer.bling.com.br/referencia'],
  };

  if (DRY_RUN || !MEASURES_APPROVED) {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summarize(result), null, 2));
    return;
  }

  const token = await loadAccessToken();
  if (!token) throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para atualizar pesos e medidas.');

  for (const item of payloads) {
    await sleep(REQUEST_DELAY_MS);
    try {
      await bling(token, 'PATCH', `/produtos/${item.bling_id}`, item.payload_patch_sugerido);
      result.atualizados.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        nome_bling: item.nome_bling,
        status: 'ATUALIZADO',
        payload: item.payload_patch_sugerido,
      });
    } catch (error) {
      const safe = safeError(error);
      result.atualizados.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        nome_bling: item.nome_bling,
        status: 'ERRO_API',
        error: safe,
      });
      result.errors.push({ sku: item.sku, bling_id: item.bling_id, error: safe });
    }
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
}

async function validateOpenApiSchema() {
  const spec = await fetchJson(OPENAPI_URL);
  const schema = spec.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.['application/json']?.schema;
  const resolved = resolveSchema(spec, schema);
  const requiredTop = ['pesoLiquido', 'pesoBruto', 'dimensoes'];
  const missingTop = requiredTop.filter((field) => !resolved.properties?.[field]);
  if (missingTop.length) throw new Error(`Schema PATCH /produtos/{idProduto} sem campos: ${missingTop.join(', ')}`);
  const dimensoes = resolveSchema(spec, resolved.properties.dimensoes);
  const requiredDimensions = ['largura', 'altura', 'profundidade', 'unidadeMedida'];
  const missingDimensions = requiredDimensions.filter((field) => !dimensoes.properties?.[field]);
  if (missingDimensions.length) throw new Error(`Schema dimensoes sem campos: ${missingDimensions.join(', ')}`);
  return {
    openapiUrl: OPENAPI_URL,
    patchSchema: schema?.$ref ?? 'inline',
    fields: requiredTop,
    dimensionFields: requiredDimensions,
    unidadeMedidaCentimetros: 1,
  };
}

function validatePayloads(payloads) {
  if (!Array.isArray(payloads) || payloads.length !== 76) {
    throw new Error(`Payload de medidas inválido: esperado 76 produtos com bling_id, recebido ${Array.isArray(payloads) ? payloads.length : 'n/a'}`);
  }
  for (const item of payloads) {
    const body = item.payload_patch_sugerido;
    if (!item.bling_id || !item.sku || !body) throw new Error(`Payload incompleto para SKU ${item.sku ?? 'desconhecido'}`);
    for (const key of ['pesoLiquido', 'pesoBruto']) {
      if (!isPositiveNumber(body[key])) throw new Error(`Peso inválido em ${item.sku}: ${key}`);
    }
    for (const key of ['largura', 'altura', 'profundidade']) {
      if (!isPositiveNumber(body.dimensoes?.[key])) throw new Error(`Dimensão inválida em ${item.sku}: ${key}`);
    }
    if (body.dimensoes?.unidadeMedida !== 1) {
      throw new Error(`unidadeMedida inválida em ${item.sku}: esperado 1 (centímetros)`);
    }
  }
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ZalenShopBrasilDrones/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  return response.json();
}

function resolveSchema(spec, schema, seen = new Set()) {
  if (!schema) return {};
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

async function appendReport(result) {
  const text = await fs.readFile(REPORT_FILE, 'utf8').catch(() => '');
  const summary = summarize(result);
  const section = [
    '',
    '## Pesos e medidas logisticas no Bling',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZACAO REAL'}`,
    `- Produtos planejados: ${result.produtosPlanejados}`,
    `- Produtos atualizados: ${summary.atualizados}`,
    `- Erros: ${summary.errors}`,
    '- Observacao: pesos e medidas sao estimativas logisticas para frete, nao medicao real do fabricante.',
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    produtosPlanejados: result.produtosPlanejados,
    atualizados: result.atualizados.filter((item) => item.status === 'ATUALIZADO').length,
    errors: result.errors.length,
  };
}

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
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
