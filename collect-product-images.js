import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const JSON_FILE = path.join(OUT, '15_imagens_candidatas.json');
const CSV_FILE = path.join(OUT, '15_imagens_candidatas.csv');
const SUMMARY_FILE = path.join(OUT, '15_imagens_candidatas_resumo.md');

const MAX_PRODUCTS = Number(process.env.IMAGE_MAX_PRODUCTS ?? 76);
const MAX_RESULTS_PER_PRODUCT = Number(process.env.IMAGE_MAX_RESULTS ?? 8);
const MAX_IMAGES_PER_PRODUCT = Number(process.env.IMAGE_MAX_CANDIDATES ?? 4);
const REQUEST_DELAY_MS = Number(process.env.IMAGE_SEARCH_DELAY_MS ?? 450);

const DOMAIN_PRIORITY = [
  ['dji.com', 100],
  ['store.dji.com', 100],
  ['mundrone.com.br', 92],
  ['xklen.com.br', 86],
  ['djioemparts.com', 82],
  ['loja.droner.com.br', 78],
  ['companhiadodrone.com.br', 76],
  ['mercadolivre.com.br', 62],
  ['shopee.com.br', 48],
  ['aliexpress.com', 35],
];

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'))
    .filter((product) => product.bling_id)
    .slice(0, MAX_PRODUCTS);

  const rows = [];
  const details = [];
  for (const product of products) {
    await sleep(REQUEST_DELAY_MS);
    const query = buildQuery(product);
    const results = await searchDuckDuckGo(query).catch((error) => {
      details.push({ sku: product.sku, query, error: safeError(error), candidates: [] });
      return [];
    });

    const candidates = [];
    for (const result of results.slice(0, MAX_RESULTS_PER_PRODUCT)) {
      await sleep(REQUEST_DELAY_MS);
      const imageData = await extractImagesFromPage(result.url, product).catch((error) => ({
        images: [],
        error: safeError(error),
      }));
      for (const imageUrl of imageData.images.slice(0, 3)) {
        const candidate = {
          linha_ods: product.linha_ods,
          sku: product.sku,
          nome_bling: product.nome_bling,
          modelo_detectado: product.modelo_detectado,
          tipo_peca: product.tipo_peca,
          categoria_path: product.categoria_path,
          source_url: result.url,
          source_domain: domainOf(result.url),
          source_title: result.title,
          image_url: absolutize(imageUrl, result.url),
          confidence: scoreCandidate(product, result, imageUrl),
          license_status: licenseStatus(result.url),
          review_status: 'PENDENTE_REVISAO',
        };
        if (candidate.image_url && !candidates.some((item) => item.image_url === candidate.image_url)) {
          candidates.push(candidate);
        }
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const selected = candidates.slice(0, MAX_IMAGES_PER_PRODUCT);
    rows.push(...selected);
    details.push({ sku: product.sku, query, resultCount: results.length, candidates: selected });
    console.log(`${product.sku}: ${selected.length} candidatos`);
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    startedAt,
    finishedAt,
    totalProdutos: products.length,
    produtosComCandidato: new Set(rows.map((row) => row.sku)).size,
    candidatos: rows.length,
    fontes: countBy(rows, (row) => row.source_domain),
  };

  await fs.writeFile(JSON_FILE, `${JSON.stringify({ summary, rows, details }, null, 2)}\n`, 'utf8');
  await fs.writeFile(CSV_FILE, toCsv(rows), 'utf8');
  await fs.writeFile(SUMMARY_FILE, toMarkdown(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

function buildQuery(product) {
  const name = String(product.nome_bling ?? '').replace(/\bDJI\b/g, '').trim();
  const model = product.modelo_detectado ? `DJI ${product.modelo_detectado}` : 'DJI';
  const type = product.tipo_peca ?? '';
  return `${name} ${model} ${type} original imagem`;
}

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const results = [];
  const regex = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>/g;
  let match;
  while ((match = regex.exec(html))) {
    const target = decodeDuckDuckGoUrl(decodeHtml(match[1]));
    if (!target || !/^https?:\/\//.test(target)) continue;
    results.push({
      url: target,
      title: stripTags(decodeHtml(match[2])),
      domain: domainOf(target),
    });
  }
  return dedupeBy(results, (item) => item.url);
}

async function extractImagesFromPage(url, product) {
  const html = await fetchText(url);
  const images = [];
  for (const pattern of [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
  ]) {
    let match;
    while ((match = pattern.exec(html))) images.push(decodeHtml(match[1]));
  }

  const jsonLdImages = extractJsonLdImages(html);
  images.push(...jsonLdImages);
  images.push(...extractImgTagImages(html, product));

  return {
    images: dedupeBy(
      images
        .map((image) => image.trim())
        .filter((image) => image && !image.startsWith('data:') && !/logo|favicon|sprite/i.test(image)),
      (image) => image
    ),
  };
}

function extractImgTagImages(html, product) {
  const images = [];
  const productTerms = [
    ...normalize(product.nome_bling).split(/\s+/),
    ...normalize(product.modelo_detectado).split(/\s+/),
    ...normalize(product.tipo_peca).split(/\s+/),
  ].filter((term) => term.length >= 3 && !['dji', 'para', 'com'].includes(term));
  const imgRegex = /<img\b[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html))) {
    const tag = match[0];
    const attrs = Object.fromEntries(
      [...tag.matchAll(/\s([a-zA-Z_:.-]+)=["']([^"']*)["']/g)].map((attr) => [attr[1].toLowerCase(), decodeHtml(attr[2])])
    );
    const src =
      attrs.src ||
      attrs['data-src'] ||
      attrs['data-original'] ||
      attrs['data-lazy'] ||
      attrs['data-zoom-image'] ||
      attrs['data-image'];
    if (!src || src.startsWith('data:')) continue;
    const text = normalize(`${attrs.alt ?? ''} ${attrs.title ?? ''} ${src}`);
    const matches = productTerms.filter((term) => text.includes(term)).length;
    const looksProduct =
      matches >= 2 || /product|produto|uploads|cdn|images|imagens|catalog|catalogo/i.test(src);
    if (looksProduct) images.push(src);
  }
  return images;
}

function extractJsonLdImages(html) {
  const images = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      collectImageFields(parsed, images);
    } catch {
      // Ignore malformed JSON-LD.
    }
  }
  return images;
}

function collectImageFields(value, images) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectImageFields(item, images);
    return;
  }
  if (typeof value !== 'object') return;
  if (typeof value.image === 'string') images.push(value.image);
  if (Array.isArray(value.image)) {
    for (const item of value.image) {
      if (typeof item === 'string') images.push(item);
      else if (item?.url) images.push(item.url);
    }
  }
  if (value.image?.url) images.push(value.image.url);
  for (const item of Object.values(value)) collectImageFields(item, images);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function scoreCandidate(product, result, imageUrl) {
  const domainScore = DOMAIN_PRIORITY.find(([domain]) => domainOf(result.url).includes(domain))?.[1] ?? 40;
  const haystack = normalize(`${result.title} ${result.url} ${imageUrl}`);
  const terms = [
    ...normalize(product.nome_bling).split(/\s+/),
    ...normalize(product.modelo_detectado).split(/\s+/),
    ...normalize(product.tipo_peca).split(/\s+/),
  ].filter((term) => term.length >= 3 && !['dji', 'para', 'com'].includes(term));
  const matches = terms.filter((term) => haystack.includes(term)).length;
  const matchScore = Math.min(45, matches * 8);
  const imagePenalty = /logo|banner|placeholder|avatar|icon/i.test(imageUrl) ? -35 : 0;
  return Math.max(0, Math.min(100, domainScore + matchScore + imagePenalty));
}

function licenseStatus(url) {
  const domain = domainOf(url);
  if (domain.includes('dji.com')) return 'OFICIAL_DJI_REVISAR_USO';
  if (domain.includes('mundrone.com.br')) return 'PARCEIRO_TERCEIRO_REVISAR_USO';
  return 'TERCEIRO_REVISAR_USO';
}

function decodeDuckDuckGoUrl(url) {
  const normalized = url.startsWith('//') ? `https:${url}` : url;
  try {
    const parsed = new URL(normalized);
    return parsed.searchParams.get('uddg') ? decodeURIComponent(parsed.searchParams.get('uddg')) : normalized;
  } catch {
    return normalized;
  }
}

function absolutize(imageUrl, baseUrl) {
  try {
    return new URL(imageUrl, baseUrl).toString();
  } catch {
    return '';
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'sem_fonte';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function toCsv(rows) {
  const headers = [
    'linha_ods',
    'sku',
    'nome_bling',
    'modelo_detectado',
    'tipo_peca',
    'categoria_path',
    'source_domain',
    'source_url',
    'source_title',
    'image_url',
    'confidence',
    'license_status',
    'review_status',
  ];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toMarkdown(summary) {
  return [
    '# Imagens candidatas',
    '',
    `Gerado em: ${summary.finishedAt}`,
    `Produtos analisados: ${summary.totalProdutos}`,
    `Produtos com candidato: ${summary.produtosComCandidato}`,
    `Candidatos totais: ${summary.candidatos}`,
    '',
    '## Fontes',
    ...Object.entries(summary.fontes).map(([domain, count]) => `- ${domain}: ${count}`),
    '',
    'Observação: revisar visualmente e juridicamente antes de subir imagens no Bling.',
  ].join('\n');
}

function safeError(error) {
  return error instanceof Error ? error.message : 'unknown_error';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
