import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import {
  buildDescriptionPatch,
  containsMundroneReference,
  countMundroneReferences,
} from './brasil-drones-description-sanitizer.mjs';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const OPENAPI_REFERENCE_URL = 'https://developer.bling.com.br/referencia';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const AUDIT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_descricoes_mundrone_auditoria.json');
const RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_descricoes_mundrone_resultado.json');
const REPORT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_descricoes_mundrone_relatorio.md');
const auditOnly = process.env.AUDIT_ONLY !== 'false';
const approved = process.env.BRASIL_DRONES_DESCRIPTION_UPDATE_APPROVED === 'true';
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  rejectGlobalCredentials();
  if (!auditOnly && !approved) {
    throw new Error(
      'Atualização real bloqueada: defina BRASIL_DRONES_DESCRIPTION_UPDATE_APPROVED=true.'
    );
  }

  const openApi = await loadCurrentOpenApi();
  validateProductEndpoints(openApi);
  const accessToken = await loadAccessToken();
  const listedProducts = await listAllProducts(accessToken);
  const auditStartedAt = new Date().toISOString();
  const affected = [];
  const readErrors = [];

  for (const [index, listedProduct] of listedProducts.entries()) {
    try {
      const response = await requestBling(
        'GET',
        `/produtos/${Number(listedProduct.id)}`,
        accessToken
      );
      const product = {
        ...listedProduct,
        ...(response?.data ?? response),
        id: response?.data?.id ?? response?.id ?? listedProduct.id,
      };
      const patch = buildDescriptionPatch(product);
      if (Object.keys(patch).length) {
        affected.push(buildAuditItem(product, patch));
      }
    } catch (error) {
      readErrors.push({
        id: Number(listedProduct.id),
        codigo: listedProduct.codigo ?? null,
        nome: listedProduct.nome ?? null,
        error: safeError(error),
      });
    }
    if ((index + 1) % 50 === 0 || index + 1 === listedProducts.length) {
      console.log(
        `Auditoria Bling: ${index + 1}/${listedProducts.length}; afetados: ${affected.length}; erros: ${readErrors.length}.`
      );
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const audit = {
    status: readErrors.length ? 'audit_complete_with_errors' : 'audit_complete',
    generatedAt: new Date().toISOString(),
    auditStartedAt,
    mode: auditOnly ? 'AUDIT_ONLY' : 'UPDATE',
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    replacementPolicy: {
      competitorName: 'Mundrone',
      replacementName: 'Brasil Drones & Parts',
      competitorDomain: 'mundrone.com.br',
      replacementDomain: 'brasildroneseparts.com.br',
      allowedFields: ['descricaoCurta', 'descricaoComplementar'],
    },
    openApi: {
      referenceUrl: OPENAPI_REFERENCE_URL,
      assetUrl: openApi.__assetUrl,
      version: openApi.info?.version ?? null,
      patchSchemaName:
        openApi.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.[
          'application/json'
        ]?.schema?.$ref?.split('/').at(-1) ?? null,
    },
    summary: {
      productsListed: listedProducts.length,
      productsRead: listedProducts.length - readErrors.length,
      productsAffected: affected.length,
      descricaoCurtaAffected: affected.filter((item) =>
        item.changedFields.includes('descricaoCurta')
      ).length,
      descricaoComplementarAffected: affected.filter((item) =>
        item.changedFields.includes('descricaoComplementar')
      ).length,
      referencesFound: affected.reduce((total, item) => total + item.referencesFound, 0),
      readErrors: readErrors.length,
    },
    affected,
    readErrors,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  if (auditOnly) {
    const result = {
      status: audit.status,
      generatedAt: new Date().toISOString(),
      auditFile: AUDIT_FILE,
      summary: audit.summary,
      updated: [],
      errors: readErrors,
    };
    await writeOutputs(result, audit);
    console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
    return;
  }

  if (readErrors.length) {
    throw new Error(
      `A atualização foi bloqueada porque ${readErrors.length} produto(s) não puderam ser auditados.`
    );
  }

  const updated = [];
  const updateErrors = [];
  for (const [index, item] of affected.entries()) {
    try {
      await requestBling('PATCH', `/produtos/${item.id}`, accessToken, { body: item.patch });
      await sleep(REQUEST_INTERVAL_MS);
      const verificationResponse = await requestBling(
        'GET',
        `/produtos/${item.id}`,
        accessToken
      );
      const verified = verificationResponse?.data ?? verificationResponse;
      const remainingReferences = item.changedFields.filter((field) =>
        containsMundroneReference(verified?.[field])
      );
      if (remainingReferences.length) {
        throw new Error(
          `A referência à Mundrone permaneceu nos campos: ${remainingReferences.join(', ')}`
        );
      }
      updated.push({
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        changedFields: item.changedFields,
        status: 'ATUALIZADO_E_VERIFICADO',
      });
    } catch (error) {
      updateErrors.push({
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        changedFields: item.changedFields,
        error: safeError(error),
      });
    }
    console.log(
      `Correção Bling: ${index + 1}/${affected.length}; atualizados: ${updated.length}; erros: ${updateErrors.length}.`
    );
    await sleep(REQUEST_INTERVAL_MS);
  }

  const result = {
    status: updateErrors.length ? 'completed_with_errors' : 'completed',
    generatedAt: new Date().toISOString(),
    auditFile: AUDIT_FILE,
    summary: {
      ...audit.summary,
      productsUpdated: updated.length,
      productsWithUpdateError: updateErrors.length,
      productsVerifiedWithoutMundrone: updated.length,
    },
    updated,
    errors: updateErrors,
  };
  await writeOutputs(result, audit);
  console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
  if (updateErrors.length) process.exitCode = 1;
}

function buildAuditItem(product, patch) {
  const changedFields = Object.keys(patch);
  return {
    id: Number(product.id),
    codigo: product.codigo ?? null,
    nome: product.nome ?? null,
    changedFields,
    referencesFound: changedFields.reduce(
      (total, field) => total + countMundroneReferences(product[field]),
      0
    ),
    before: Object.fromEntries(changedFields.map((field) => [field, product[field]])),
    patch,
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

function validateProductEndpoints(spec) {
  const productPath = spec.paths?.['/produtos/{idProduto}'];
  if (!spec.paths?.['/produtos']?.get || !productPath?.get || !productPath?.patch) {
    throw new Error('OpenAPI Bling sem os endpoints esperados de consulta e PATCH de produto.');
  }
  const patchSchema = resolveSchema(
    spec,
    productPath.patch.requestBody?.content?.['application/json']?.schema
  );
  const requiredFields = ['descricaoCurta', 'descricaoComplementar'];
  const missing = requiredFields.filter((field) => !patchSchema.properties?.[field]);
  if (missing.length) {
    throw new Error(
      `Schema PATCH de produto incompatível. Campos ausentes: ${missing.join(', ')}.`
    );
  }
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
  const result = {
    properties: { ...(schema.properties ?? {}) },
    required: [...(schema.required ?? [])],
  };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const child of schema[key] ?? []) {
      const resolved = resolveSchema(spec, child, new Set(seen));
      Object.assign(result.properties, resolved.properties ?? {});
      result.required.push(...(resolved.required ?? []));
    }
  }
  return result;
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
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) return process.env.BLING_CUSTOMER_ACCESS_TOKEN;
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
  return parsed.access_token;
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
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      const parsed = parseJson(await response.text());
      if (response.ok) return parsed;
      lastError = new Error(
        `${method} ${endpoint}: HTTP ${response.status} ${extractError(parsed)}`
      );
      if (response.status !== 429 && response.status < 500) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(30000, 1000 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`${method} ${endpoint} falhou.`);
}

async function writeOutputs(result, audit) {
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const report = [
    '# Auditoria de descrições Bling - Brasil Drones',
    '',
    `- Gerado em: ${result.generatedAt}`,
    `- Modo: ${audit.mode}`,
    `- Produtos listados: ${audit.summary.productsListed}`,
    `- Produtos auditados: ${audit.summary.productsRead}`,
    `- Produtos com referência à Mundrone: ${audit.summary.productsAffected}`,
    `- Referências encontradas: ${audit.summary.referencesFound}`,
    `- Produtos atualizados e verificados: ${result.summary.productsUpdated ?? 0}`,
    `- Erros de leitura: ${audit.summary.readErrors}`,
    `- Erros de atualização: ${result.summary.productsWithUpdateError ?? 0}`,
    '',
    '## Escopo da correção',
    '',
    'Somente `descricaoCurta` e `descricaoComplementar` foram elegíveis para alteração.',
    'Nenhum nome, SKU, preço, custo, estoque, categoria, marca, GTIN ou imagem foi enviado no PATCH.',
    '',
    '## Produtos afetados',
    '',
    ...audit.affected.map(
      (item) =>
        `- ${item.codigo ?? 'sem SKU'} | ${item.nome ?? 'sem nome'} | ${item.changedFields.join(', ')}`
    ),
    '',
  ].join('\n');
  await fs.writeFile(REPORT_FILE, report, 'utf8');
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return { raw: value };
  }
}

function extractError(value) {
  return (
    value?.error?.description ??
    value?.error_description ??
    value?.message ??
    value?.raw ??
    JSON.stringify(value)
  );
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
