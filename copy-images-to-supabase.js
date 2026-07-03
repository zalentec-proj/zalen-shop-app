import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const CANDIDATES_FILE = process.env.IMAGE_CANDIDATES_FILE ?? path.join(OUT, '15_imagens_candidatas.json');
const RESULT_FILE = path.join(OUT, '16_imagens_supabase.json');
const CSV_FILE = path.join(OUT, '16_imagens_supabase.csv');
const SUMMARY_FILE = path.join(OUT, '16_imagens_supabase_resumo.md');
const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET ?? 'product-images';
const PREFIX = process.env.SUPABASE_PRODUCT_IMAGES_PREFIX ?? 'bling/brasil-drones';
const MAX_BYTES = Number(process.env.IMAGE_MAX_BYTES ?? 10 * 1024 * 1024);
const REQUEST_DELAY_MS = Number(process.env.IMAGE_UPLOAD_DELAY_MS ?? 350);
const MAX_PRODUCTS = Number(process.env.IMAGE_UPLOAD_MAX_PRODUCTS ?? 0);
const IMAGES_PER_PRODUCT = Math.max(1, Number(process.env.IMAGE_IMAGES_PER_PRODUCT ?? 1));
const ALLOW_VISUAL_SUSPECTS = String(process.env.IMAGE_ALLOW_VISUAL_SUSPECTS ?? 'false').toLowerCase() === 'true';

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = requiredEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  await ensurePublicBucket(supabase);

  const candidatesDocument = JSON.parse(await fs.readFile(CANDIDATES_FILE, 'utf8'));
  const selectedAll = selectBestCandidates(candidatesDocument.rows);
  const selected = MAX_PRODUCTS > 0 ? selectedAll.slice(0, MAX_PRODUCTS) : selectedAll;
  const results = [];

  for (const item of selected) {
    await sleep(REQUEST_DELAY_MS);
    const sourceDomains = candidateSourceDomains(candidatesDocument.rows, item.sku, item.source_domain);
    let uploadedItems = [];
    const errors = [];

    for (const sourceDomain of sourceDomains) {
      const attempts = candidatesForSku(candidatesDocument.rows, item.sku, sourceDomain);
      const sourceUploads = [];
      const seenImageKeys = new Set();

      for (const candidate of attempts) {
        if (sourceUploads.length >= IMAGES_PER_PRODUCT) break;
        const candidateKey = canonicalImageKey(candidate.image_url);
        if (seenImageKeys.has(candidateKey)) continue;
        seenImageKeys.add(candidateKey);
        try {
          const downloaded = await downloadImage(candidate.image_url);
          const visual = await analyzeImage(downloaded.buffer);
          const visualProblems = visualProblemsFor(visual);
          if (visualProblems.length && !ALLOW_VISUAL_SUSPECTS) {
            throw new Error(`imagem_suspeita:${visualProblems.join('|')}`);
          }
          const extension = extensionFor(downloaded.contentType, candidate.image_url);
          const hash = crypto.createHash('sha1').update(downloaded.buffer).digest('hex').slice(0, 12);
          const objectPath = `${PREFIX}/${safePath(candidate.sku)}/${safePath(candidate.sku)}-${hash}.${extension}`;
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, downloaded.buffer, {
            contentType: downloaded.contentType,
            cacheControl: '31536000',
            upsert: true,
          });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
          sourceUploads.push({
            ...candidate,
            image_order: sourceUploads.length + 1,
            supabase_bucket: BUCKET,
            supabase_path: objectPath,
            supabase_public_url: publicData.publicUrl,
            content_type: downloaded.contentType,
            bytes: downloaded.buffer.length,
            width: visual.width,
            height: visual.height,
            mean_brightness: visual.meanBrightness,
            std_brightness: visual.stdBrightness,
            visual_warnings: visualProblems,
            status: 'COPIADA',
          });
        } catch (error) {
          errors.push({
            source_domain: candidate.source_domain,
            source_url: candidate.source_url,
            image_url: candidate.image_url,
            error: safeError(error),
          });
        }
      }

      if (sourceUploads.length) {
        uploadedItems = sourceUploads;
        break;
      }
    }

    if (uploadedItems.length) {
      results.push(...uploadedItems);
      console.log(`${item.sku}: copiadas ${uploadedItems.length}`);
    } else {
      results.push({
        sku: item.sku,
        nome_bling: item.nome_bling,
        source_domain: item.source_domain,
        source_domains_tried: sourceDomains,
        status: 'ERRO_SEM_IMAGEM_VALIDA',
        errors,
      });
      console.log(`${item.sku}: erro`);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    startedAt,
    finishedAt,
    bucket: BUCKET,
    prefix: PREFIX,
    selecionadas: selected.length,
    imagensPorProduto: IMAGES_PER_PRODUCT,
    mesmaFontePorProduto: true,
    copiadas: results.filter((item) => item.status === 'COPIADA').length,
    produtosComImagem: new Set(results.filter((item) => item.status === 'COPIADA').map((item) => item.sku)).size,
    erros: results.filter((item) => item.status !== 'COPIADA').length,
    fontes: countBy(results.filter((item) => item.status === 'COPIADA'), (item) => item.source_domain),
  };

  await fs.writeFile(RESULT_FILE, `${JSON.stringify({ summary, rows: results }, null, 2)}\n`, 'utf8');
  await fs.writeFile(CSV_FILE, toCsv(results), 'utf8');
  await fs.writeFile(SUMMARY_FILE, toMarkdown(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

async function ensurePublicBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const existing = buckets.find((bucket) => bucket.name === BUCKET || bucket.id === BUCKET);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createError) throw createError;
    return;
  }
  if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET, { public: true });
    if (updateError) throw updateError;
  }
}

function selectBestCandidates(rows) {
  const bySku = new Map();
  for (const row of rows.filter(isUsableCandidate).sort(compareCandidates)) {
    if (!bySku.has(row.sku)) bySku.set(row.sku, row);
  }
  return [...bySku.values()].sort((a, b) => Number(a.linha_ods) - Number(b.linha_ods));
}

function candidatesForSku(rows, sku, sourceDomain) {
  return rows
    .filter((row) => row.sku === sku && row.source_domain === sourceDomain && isUsableCandidate(row))
    .sort(compareCandidates)
    .slice(0, 16);
}

function candidateSourceDomains(rows, sku, preferredDomain) {
  const domains = [];
  if (preferredDomain) domains.push(preferredDomain);
  for (const row of rows.filter((candidate) => candidate.sku === sku && isUsableCandidate(candidate)).sort(compareCandidates)) {
    if (row.source_domain && !domains.includes(row.source_domain)) domains.push(row.source_domain);
  }
  return domains;
}

function isUsableCandidate(row) {
  const url = String(row.image_url ?? '');
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/placeholder|PRODUTO_IMAGEM|favicon|logo|sprite|avatar/i.test(url)) return false;
  if (/\.svg($|\?)/i.test(url)) return false;
  return true;
}

function compareCandidates(a, b) {
  return b.confidence - a.confidence || domainRank(b.source_domain) - domainRank(a.source_domain);
}

function domainRank(domain) {
  const ranks = {
    'dji.com': 100,
    'store.dji.com': 100,
    'mundrone.com.br': 92,
    'loja.droner.com.br': 85,
    'djioemparts.com': 80,
  };
  return ranks[domain] ?? 50;
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      Referer: new URL(url).origin,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`download_http_${response.status}`);
  const contentType = String(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(contentType)) {
    throw new Error(`content_type_invalido:${contentType || 'unknown'}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) throw new Error('imagem_vazia');
  if (buffer.length > MAX_BYTES) throw new Error(`imagem_maior_que_limite:${buffer.length}`);
  return { buffer, contentType };
}

async function analyzeImage(buffer) {
  const image = sharp(buffer, { limitInputPixels: false });
  const meta = await image.metadata();
  const resized = await image.resize(64, 64, { fit: 'inside' }).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < resized.data.length; i += 3) {
    const lum = 0.2126 * resized.data[i] + 0.7152 * resized.data[i + 1] + 0.0722 * resized.data[i + 2];
    sum += lum;
    sum2 += lum * lum;
  }
  const n = resized.data.length / 3;
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    meanBrightness: Number(mean.toFixed(1)),
    stdBrightness: Number(std.toFixed(1)),
  };
}

function visualProblemsFor(visual) {
  const problems = [];
  if (!visual.width || !visual.height) problems.push('DIMENSAO_NAO_LIDA');
  if (visual.width && visual.height) {
    const ratio = Math.max(visual.width / visual.height, visual.height / visual.width);
    if (visual.width < 280 || visual.height < 220) problems.push('MUITO_PEQUENA');
    if (ratio > 2.2) problems.push('ASPECTO_BANNER');
  }
  const hasEnoughDetail = visual.stdBrightness >= 25 && visual.width >= 300 && visual.height >= 300;
  if (visual.meanBrightness < 25 && !hasEnoughDetail) problems.push('MUITO_ESCURA_PRETA');
  if (visual.stdBrightness < 8) problems.push('BAIXA_VARIACAO_VISUAL');
  return problems;
}

function extensionFor(contentType, url) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/avif') return 'avif';
  const match = new URL(url).pathname.match(/\.([a-z0-9]{3,4})$/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

function safePath(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canonicalImageKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`
      .toLowerCase()
      .replace(/\/(?:64|150|300|480|640|800|1024|1200|1600|1920)x(?:64|150|300|480|640|800|1024|1200|1600|1920)\//g, '/SIZE/')
      .replace(/-(?:64|150|300|480|640|800|1024|1200|1600|1920)-0(?=\.)/g, '-SIZE-0');
  } catch {
    return String(url ?? '').toLowerCase();
  }
}

function toCsv(rows) {
  const headers = [
    'sku',
    'nome_bling',
    'status',
    'image_order',
    'supabase_public_url',
    'supabase_path',
    'source_domain',
    'source_url',
    'image_url',
    'confidence',
    'content_type',
    'bytes',
    'width',
    'height',
    'mean_brightness',
    'std_brightness',
    'visual_warnings',
  ];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toMarkdown(summary) {
  return [
    '# Imagens copiadas para Supabase',
    '',
    `Gerado em: ${summary.finishedAt}`,
    `Bucket: ${summary.bucket}`,
    `Prefixo: ${summary.prefix}`,
    `Selecionadas: ${summary.selecionadas}`,
    `Imagens por produto solicitadas: ${summary.imagensPorProduto}`,
    `Mesma fonte por produto: ${summary.mesmaFontePorProduto ? 'sim' : 'não'}`,
    `Produtos com imagem: ${summary.produtosComImagem}`,
    `Imagens copiadas: ${summary.copiadas}`,
    `Erros: ${summary.erros}`,
    '',
    '## Fontes copiadas',
    ...Object.entries(summary.fontes).map(([domain, count]) => `- ${domain}: ${count}`),
  ].join('\n');
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'sem_fonte';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match) continue;
      const shouldOverride = /^SUPABASE|^NEXT_PUBLIC_SUPABASE/.test(match[1]);
      if (!shouldOverride && process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function safeError(error) {
  return error instanceof Error ? error.message : 'unknown_error';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
