import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const DRY_FILE = path.join(OUT, '13_ncm_completo_dry_run.json');
const RESULT_FILE = path.join(OUT, '14_resultado_ncm_completo.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const NCM_APPROVED =
  String(process.env.NCM_APPROVED ?? process.env.UPDATE_APPROVED ?? 'false').toLowerCase() ===
  'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_NCM_DELAY_MS ?? 700);
const FALLBACK_NCM = '8807.30.00';
const FALLBACK_REASON =
  'NCM provisório aplicado por autorização do usuário para revisão manual posterior no Bling.';

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  const candidates = products
    .filter((product) => product.bling_id)
    .map((product) => {
      const existing = product.ncm ? String(product.ncm) : '';
      const provisional = !existing;
      return {
        linha_ods: product.linha_ods,
        sku: product.sku,
        bling_id: product.bling_id,
        nome_bling: product.nome_bling,
        tipo_peca: product.tipo_peca,
        categoria_path: product.categoria_path,
        ncm_anterior: existing || null,
        ncm: existing || FALLBACK_NCM,
        ncm_digits: digits(existing || FALLBACK_NCM),
        ncm_status: product.ncm_status,
        ncm_provisorio: provisional,
        motivo: provisional ? FALLBACK_REASON : 'NCM já definido no pipeline e reenviado para consistência.',
      };
    });

  const result = {
    status: DRY_RUN || !NCM_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    ncmApproved: NCM_APPROVED,
    startedAt,
    finishedAt: null,
    totalProdutosComBlingId: candidates.length,
    ncmJaExistente: candidates.filter((item) => !item.ncm_provisorio).length,
    ncmProvisorioAplicar: candidates.filter((item) => item.ncm_provisorio).length,
    fallbackNcm: FALLBACK_NCM,
    updates: [],
    errors: [],
    sources: [
      'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json',
      'https://developer.bling.com.br/referencia',
    ],
  };

  await fs.writeFile(DRY_FILE, `${JSON.stringify({ dryRun: true, candidates }, null, 2)}\n`, 'utf8');

  if (DRY_RUN || !NCM_APPROVED) {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const token = await loadAccessToken();
  if (!token) {
    throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para atualizar NCM.');
  }

  for (const item of candidates) {
    await sleep(REQUEST_DELAY_MS);
    try {
      await bling(token, 'PATCH', `/produtos/${item.bling_id}`, {
        tributacao: { ncm: item.ncm_digits },
      });
      result.updates.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        ncm: item.ncm,
        ncm_provisorio: item.ncm_provisorio,
        status: 'ATUALIZADO',
      });
    } catch (error) {
      result.updates.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        ncm: item.ncm,
        ncm_provisorio: item.ncm_provisorio,
        status: 'ERRO_API',
        error: safeError(error),
      });
      result.errors.push({ sku: item.sku, error: safeError(error) });
    }
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
}

function digits(ncm) {
  return String(ncm).replace(/\D/g, '');
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
    '## NCM completo no Bling',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZAÇÃO REAL'}`,
    `- Produtos com Bling ID: ${result.totalProdutosComBlingId}`,
    `- NCMs já existentes reenviados: ${result.ncmJaExistente}`,
    `- NCMs provisórios aplicados: ${result.ncmProvisorioAplicar}`,
    `- Fallback provisório: ${result.fallbackNcm}`,
    `- Produtos atualizados: ${summary.atualizados}`,
    `- Erros: ${summary.errors}`,
    '- Observação: NCMs provisórios devem ser revisados manualmente no Bling pelo responsável fiscal.',
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    atualizados: result.updates.filter((item) => item.status === 'ATUALIZADO').length,
    provisoriosAtualizados: result.updates.filter((item) => item.status === 'ATUALIZADO' && item.ncm_provisorio).length,
    errors: result.errors.length,
  };
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
