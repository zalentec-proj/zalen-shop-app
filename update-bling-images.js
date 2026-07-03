import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const SUPABASE_IMAGES_FILE = path.join(OUT, '16_imagens_supabase.json');
const DRY_FILE = path.join(OUT, '17_bling_imagens_dry_run.json');
const RESULT_FILE = path.join(OUT, '18_resultado_bling_imagens.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const IMAGES_APPROVED =
  String(process.env.IMAGES_APPROVED ?? process.env.UPDATE_APPROVED ?? 'false').toLowerCase() ===
  'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_IMAGES_DELAY_MS ?? 700);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  const images = JSON.parse(await fs.readFile(SUPABASE_IMAGES_FILE, 'utf8')).rows.filter(
    (row) => row.status === 'COPIADA' && row.supabase_public_url
  );
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const updates = [...groupImagesBySku(images)]
    .map(([sku, skuImages]) => {
      const product = productsBySku.get(sku);
      if (!product?.bling_id) return null;
      const orderedImages = skuImages.sort((a, b) => Number(a.image_order ?? 999) - Number(b.image_order ?? 999));
      return {
        linha_ods: product.linha_ods,
        sku,
        bling_id: product.bling_id,
        nome_bling: product.nome_bling,
        supabase_public_urls: orderedImages.map((image) => image.supabase_public_url),
        supabase_paths: orderedImages.map((image) => image.supabase_path),
        source_domain: orderedImages[0]?.source_domain,
        source_url: orderedImages[0]?.source_url,
        imagens: orderedImages.length,
      };
    })
    .filter(Boolean);

  const result = {
    status: DRY_RUN || !IMAGES_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    imagesApproved: IMAGES_APPROVED,
    startedAt,
    finishedAt: null,
    imagensCopiadasSupabase: images.length,
    produtosAtualizar: updates.length,
    updates: [],
    errors: [],
    sources: ['https://developer.bling.com.br/referencia'],
  };

  await fs.writeFile(DRY_FILE, `${JSON.stringify({ dryRun: true, updates }, null, 2)}\n`, 'utf8');

  if (DRY_RUN || !IMAGES_APPROVED) {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const token = await loadAccessToken();
  if (!token) throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para atualizar imagens.');

  for (const item of updates) {
    await sleep(REQUEST_DELAY_MS);
    try {
      await bling(token, 'PATCH', `/produtos/${item.bling_id}`, {
        midia: {
          imagens: {
            imagensURL: item.supabase_public_urls.map((link) => ({ link })),
          },
        },
      });
      result.updates.push({ ...item, status: 'ATUALIZADO' });
    } catch (error) {
      result.updates.push({ ...item, status: 'ERRO_API', error: safeError(error) });
      result.errors.push({ sku: item.sku, error: safeError(error) });
    }
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
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
    '## Imagens Supabase no Bling',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZAÇÃO REAL'}`,
    `- Imagens copiadas no Supabase: ${result.imagensCopiadasSupabase}`,
    `- Produtos planejados para imagem: ${result.produtosAtualizar}`,
    `- Total de URLs planejadas: ${result.updates.reduce((sum, item) => sum + (item.imagens ?? 0), 0)}`,
    `- Produtos atualizados no Bling: ${summary.atualizados}`,
    `- Erros: ${summary.errors}`,
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    atualizados: result.updates.filter((item) => item.status === 'ATUALIZADO').length,
    urlsAtualizadas: result.updates
      .filter((item) => item.status === 'ATUALIZADO')
      .reduce((sum, item) => sum + (item.imagens ?? 0), 0),
    errors: result.errors.length,
  };
}

function groupImagesBySku(images) {
  const bySku = new Map();
  for (const image of images) {
    const rows = bySku.get(image.sku) ?? [];
    rows.push(image);
    bySku.set(image.sku, rows);
  }
  return bySku;
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
