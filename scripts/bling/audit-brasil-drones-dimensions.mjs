import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const OPENAPI_REFERENCE_URL = 'https://developer.bling.com.br/referencia';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const AUDIT_FILE = path.join(OUTPUT_DIR, 'bling_dimensoes_dry_run.json');
const REPORT_FILE = path.join(OUTPUT_DIR, 'bling_dimensoes_dry_run.md');
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  rejectGlobalCredentials();
  const openApi = await loadCurrentOpenApi();
  const contract = validateDimensionsContract(openApi);
  const access = await loadAccessToken();
  const listedProducts = await listAllProducts(access.token);
  const startedAt = new Date().toISOString();
  const items = [];
  const readErrors = [];

  for (const [index, listedProduct] of listedProducts.entries()) {
    try {
      const response = await requestBling(
        'GET',
        `/produtos/${Number(listedProduct.id)}`,
        access.token
      );
      const product = {
        ...listedProduct,
        ...(response?.data ?? response),
        id: response?.data?.id ?? response?.id ?? listedProduct.id,
      };
      items.push(auditProduct(product));
    } catch (error) {
      readErrors.push({
        externalId: Number(listedProduct.id),
        sku: listedProduct.codigo ?? null,
        name: listedProduct.nome ?? null,
        error: safeError(error),
      });
    }

    if ((index + 1) % 50 === 0 || index + 1 === listedProducts.length) {
      console.log(
        `Auditoria de dimensões: ${index + 1}/${listedProducts.length}; erros: ${readErrors.length}.`
      );
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const document = {
    status: readErrors.length ? 'dry_run_completed_with_errors' : 'dry_run_completed',
    generatedAt: new Date().toISOString(),
    startedAt,
    mode: 'DRY_RUN',
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    writePolicy: 'No PATCH, PUT, POST or DELETE request is sent by this command.',
    openApi: {
      referenceUrl: OPENAPI_REFERENCE_URL,
      assetUrl: openApi.__assetUrl,
      version: openApi.info?.version ?? null,
      unitMapping: {
        0: 'metros',
        1: 'centímetros',
        2: 'milímetros',
      },
      productPatchSupportsDimensions: contract.productPatchSupportsDimensions,
      productPatchSupportsWeight: contract.productPatchSupportsWeight,
    },
    oauth: {
      credentialLoaded: true,
      productWritePermission: 'not_verified_without_write',
      note:
        'O contrato PATCH foi confirmado no OpenAPI. A permissão efetiva de escrita não é testada porque este modo não altera produtos.',
    },
    summary: buildSummary(listedProducts.length, items, readErrors.length),
    products: items,
    readErrors,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await fs.writeFile(REPORT_FILE, buildReport(document), 'utf8');
  console.log(JSON.stringify({ status: document.status, ...document.summary }, null, 2));
}

function auditProduct(product) {
  const received = normalizeDimensions(product?.dimensoes);
  const unit = parseUnit(product?.dimensoes?.unidadeMedida);
  const weight = toFiniteNumber(product?.pesoBruto ?? product?.pesoLiquido);
  const dimensions = classifyDimensions(received, unit);

  return {
    externalId: Number(product.id),
    sku: product.codigo?.trim() || null,
    name: product.nome?.trim() || null,
    currentUnit: unit ?? null,
    weightKg: weight ?? null,
    receivedDimensions: received,
    currentlyConvertedToCentimeters: dimensions.converted ?? null,
    reason: dimensions.reason,
    suggestedCorrection: dimensions.suggested ?? null,
    classification: dimensions.classification,
  };
}

function normalizeDimensions(dimensions) {
  return {
    width: toFiniteNumber(dimensions?.largura) ?? null,
    height: toFiniteNumber(dimensions?.altura) ?? null,
    depth: toFiniteNumber(dimensions?.profundidade) ?? null,
  };
}

function classifyDimensions(received, unit) {
  const values = [received.width, received.height, received.depth];
  if (values.some((value) => value === null)) {
    return { classification: 'blocked', reason: 'dimensions_missing' };
  }
  if (values.some((value) => value <= 0)) {
    return { classification: 'blocked', reason: 'dimensions_invalid' };
  }
  if (unit === null) {
    return { classification: 'blocked', reason: 'dimension_unit_unknown' };
  }

  const [width, height, depth] = values;
  const multiplier = unit === 0 ? 100 : unit === 2 ? 0.1 : 1;
  const converted = {
    width: roundDimension(width * multiplier),
    height: roundDimension(height * multiplier),
    depth: roundDimension(depth * multiplier),
  };
  const looksLikeCentimeters =
    unit === 0 &&
    values.every((value) => Number.isInteger(value) && value >= 1 && value <= 200);

  if (looksLikeCentimeters) {
    return {
      classification: 'ambiguous',
      reason: 'meter_values_look_like_centimeters',
      converted,
      suggested: {
        unidadeMedida: 1,
        largura: width,
        altura: height,
        profundidade: depth,
        requiresExplicitProductApproval: true,
      },
    };
  }

  return { classification: 'safe', reason: 'dimensions_valid', converted };
}

function buildSummary(productsListed, items, readErrors) {
  const count = (classification) =>
    items.filter((item) => item.classification === classification).length;
  return {
    productsListed,
    productsRead: items.length,
    safe: count('safe'),
    ambiguous: count('ambiguous'),
    blocked: count('blocked'),
    readErrors,
    proposedCorrections: items.filter((item) => item.suggestedCorrection).length,
  };
}

function buildReport(document) {
  const candidates = document.products.filter((item) => item.suggestedCorrection);
  const lines = [
    '# Dry-run de dimensões Bling → Zalen → SuperFrete',
    '',
    `Gerado em: ${document.generatedAt}`,
    'Modo: somente leitura. Nenhum produto do Bling foi alterado.',
    '',
    '## Contrato oficial confirmado',
    '',
    '- `dimensoes.unidadeMedida`: `0` metros, `1` centímetros, `2` milímetros.',
    '- O OpenAPI vigente expõe PATCH de produto com dimensões e peso.',
    '- A permissão efetiva de escrita não foi testada, pois isso exigiria alterar um produto.',
    '',
    '## Resumo',
    '',
    `- Produtos listados: ${document.summary.productsListed}`,
    `- Produtos lidos: ${document.summary.productsRead}`,
    `- Seguros, sem correção sugerida: ${document.summary.safe}`,
    `- Ambíguos, exigem aprovação por SKU/ID: ${document.summary.ambiguous}`,
    `- Bloqueados por dados ausentes/inválidos: ${document.summary.blocked}`,
    `- Erros de leitura: ${document.summary.readErrors}`,
    '',
    '## Candidatos ambíguos',
    '',
  ];

  for (const item of candidates) {
    lines.push(
      `- ${item.sku ?? 'sem SKU'} | ID ${item.externalId} | ${item.name ?? 'sem nome'} | recebido ${item.receivedDimensions.width} x ${item.receivedDimensions.height} x ${item.receivedDimensions.depth} com unidade metros; conversão atual ${item.currentlyConvertedToCentimeters.width} x ${item.currentlyConvertedToCentimeters.height} x ${item.currentlyConvertedToCentimeters.depth} cm; sugestão: manter números e alterar unidade para centímetros.`
    );
  }

  return `${lines.join('\n')}\n`;
}

function validateDimensionsContract(spec) {
  const patch = resolveSchema(
    spec,
    spec.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.['application/json']
      ?.schema
  );
  const dimensions = resolveSchema(spec, patch.properties?.dimensoes);
  const unitDescription = dimensions.properties?.unidadeMedida?.description ?? '';
  if (
    !spec.paths?.['/produtos']?.get ||
    !spec.paths?.['/produtos/{idProduto}']?.get ||
    !spec.paths?.['/produtos/{idProduto}']?.patch ||
    !dimensions.properties?.largura ||
    !dimensions.properties?.altura ||
    !dimensions.properties?.profundidade ||
    !/0.*metros.*1.*cent[ií]metros.*2.*mil[ií]metros/is.test(unitDescription)
  ) {
    throw new Error('OpenAPI Bling incompatível para auditoria segura de dimensões.');
  }
  return {
    productPatchSupportsDimensions: true,
    productPatchSupportsWeight: Boolean(
      patch.properties?.pesoBruto && patch.properties?.pesoLiquido
    ),
  };
}

async function listAllProducts(accessToken) {
  const products = [];
  const ids = new Set();
  for (let page = 1; page <= 1000; page += 1) {
    const response = await requestBling('GET', '/produtos', accessToken, {
      query: { pagina: page, limite: 100 },
    });
    const items = Array.isArray(response?.data) ? response.data : [];
    let newIds = 0;
    for (const item of items) {
      const id = Number(item?.id);
      if (!id || ids.has(id)) continue;
      ids.add(id);
      products.push(item);
      newIds += 1;
    }
    if (items.length < 100) break;
    if (!newIds) throw new Error(`Paginação do Bling repetiu a página ${page}.`);
    await sleep(REQUEST_INTERVAL_MS);
  }
  return products;
}

function rejectGlobalCredentials() {
  if (
    process.env.BLING_ACCESS_TOKEN &&
    !process.env.BLING_CUSTOMER_ACCESS_TOKEN &&
    !process.env.BLING_AUTH_CODE
  ) {
    throw new Error(
      'Credencial global recusada. Use somente OAuth ou BLING_CUSTOMER_ACCESS_TOKEN do app privado Brasil Drones.'
    );
  }
}

async function loadAccessToken() {
  if (process.env.BLING_AUTH_CODE) return exchangeAuthorizationCode();
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) {
    return { token: process.env.BLING_CUSTOMER_ACCESS_TOKEN };
  }
  throw new Error(
    'Credencial ausente. Use OAuth ou BLING_CUSTOMER_ACCESS_TOKEN do app privado Brasil Drones.'
  );
}

async function exchangeAuthorizationCode() {
  const clientId = requiredEnv('BLING_CUSTOMER_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CUSTOMER_CLIENT_SECRET');
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: requiredEnv('BLING_AUTH_CODE'),
    }),
  });
  const parsed = parseJson(await response.text());
  if (!response.ok || !parsed?.access_token) {
    throw new Error(`Troca OAuth falhou: HTTP ${response.status} ${extractError(parsed)}`);
  }
  return { token: parsed.access_token };
}

async function requestBling(method, endpoint, accessToken, options = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) url.searchParams.append(key, String(item));
  }
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'enable-jwt': '1',
        },
        signal: AbortSignal.timeout(30000),
      });
      const parsed = parseJson(await response.text());
      if (response.ok) return parsed;
      lastError = new Error(`${method} ${endpoint}: HTTP ${response.status} ${extractError(parsed)}`);
      if (response.status !== 429 && response.status < 500) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < MAX_RETRIES) await sleep(Math.min(30000, 1000 * 2 ** attempt));
  }
  throw lastError ?? new Error(`${method} ${endpoint} falhou.`);
}

async function loadCurrentOpenApi() {
  const reference = await fetchText(OPENAPI_REFERENCE_URL);
  const referenceAsset = reference.match(
    /https:\/\/developer\.bling\.com\.br\/build\/assets\/reference-[A-Za-z0-9_-]+\.js/
  )?.[0];
  if (!referenceAsset) throw new Error('Página oficial não expôs o asset da referência Bling.');
  const script = await fetchText(referenceAsset);
  const openApiName = script.match(/openapi-[A-Za-z0-9_-]+\.json/)?.[0];
  if (!openApiName) throw new Error('Asset oficial não expôs o OpenAPI Bling.');
  const assetUrl = new URL(openApiName, referenceAsset).toString();
  const spec = JSON.parse(await fetchText(assetUrl));
  spec.__assetUrl = assetUrl;
  return spec;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/json,*/*' },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Falha ao consultar ${url}: HTTP ${response.status}`);
  return body;
}

function resolveSchema(spec, schema, seen = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (seen.has(name)) return {};
    seen.add(name);
    return resolveSchema(spec, spec.components?.schemas?.[name], seen);
  }
  const result = { properties: { ...(schema.properties ?? {}) } };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const child of schema[key] ?? []) {
      const resolved = resolveSchema(spec, child, new Set(seen));
      Object.assign(result.properties, resolved.properties ?? {});
    }
  }
  return result;
}

function parseUnit(value) {
  const parsed = toFiniteNumber(value);
  return parsed === 0 || parsed === 1 || parsed === 2 ? parsed : null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundDimension(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function extractError(value) {
  const candidate = value?.error?.message ?? value?.error?.description ?? value?.error;
  return typeof candidate === 'string' ? candidate.slice(0, 120) : 'unknown_error';
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').slice(0, 160);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
