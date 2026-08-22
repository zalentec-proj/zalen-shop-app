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
const RESULT_FILE = path.join(OUTPUT_DIR, 'bling_dimensoes_correcao_resultado.json');
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  rejectGlobalCredentials();
  if (process.env.BRASIL_DRONES_DIMENSION_UPDATE_APPROVED !== 'true') {
    throw new Error(
      'Atualização real bloqueada: defina BRASIL_DRONES_DIMENSION_UPDATE_APPROVED=true.'
    );
  }

  const audit = JSON.parse(await fs.readFile(AUDIT_FILE, 'utf8'));
  const candidates = validateAudit(audit);
  const openApi = await loadCurrentOpenApi();
  validateDimensionsPatchContract(openApi);
  const accessToken = await loadAccessToken();
  const startedAt = new Date().toISOString();
  const updated = [];
  const alreadyCorrected = [];
  const skipped = [];
  const errors = [];

  for (const [index, candidate] of candidates.entries()) {
    try {
      const before = await getProduct(candidate.externalId, accessToken);
      const verification = verifyCandidateStillMatches(before, candidate);

      if (verification.status === 'already_corrected') {
        alreadyCorrected.push(verification.item);
      } else if (verification.status === 'stale') {
        skipped.push(verification.item);
      } else {
        await requestBling('PATCH', `/produtos/${candidate.externalId}`, accessToken, {
          body: { dimensoes: verification.patch },
        });
        await sleep(REQUEST_INTERVAL_MS);
        const after = await getProduct(candidate.externalId, accessToken);
        assertPatchVerification(after, verification);
        updated.push({
          id: candidate.externalId,
          sku: candidate.sku,
          name: candidate.name,
          before: verification.before,
          after: snapshotPhysicalData(after),
          status: 'ATUALIZADO_E_VERIFICADO',
        });
      }
    } catch (error) {
      errors.push({
        id: candidate.externalId,
        sku: candidate.sku,
        name: candidate.name,
        status: 'ERRO_API_OU_VERIFICACAO',
        error: safeError(error),
      });
    }

    console.log(
      `Correção de unidade: ${index + 1}/${candidates.length}; atualizados: ${updated.length}; já corretos: ${alreadyCorrected.length}; ignorados: ${skipped.length}; erros: ${errors.length}.`
    );
    await sleep(REQUEST_INTERVAL_MS);
  }

  const result = {
    status: errors.length || skipped.length ? 'completed_with_attention' : 'completed',
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceAudit: {
      file: AUDIT_FILE,
      generatedAt: audit.generatedAt ?? null,
      productsAudited: audit.summary?.productsRead ?? null,
    },
    policy: {
      credentials: 'BLING_CUSTOMER_* only',
      permittedRequestMethods: ['GET', 'PATCH'],
      changedField: 'dimensoes.unidadeMedida',
      targetUnit: 'centímetros',
      preservedFields: [
        'dimensoes.largura',
        'dimensoes.altura',
        'dimensoes.profundidade',
        'pesoBruto',
        'pesoLiquido',
      ],
    },
    summary: {
      candidates: candidates.length,
      updated: updated.length,
      alreadyCorrected: alreadyCorrected.length,
      skippedAsStale: skipped.length,
      errors: errors.length,
    },
    updated,
    alreadyCorrected,
    skipped,
    errors,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
  if (errors.length || skipped.length) process.exitCode = 1;
}

function validateAudit(audit) {
  if (audit?.status !== 'dry_run_completed' || audit?.readErrors?.length) {
    throw new Error('Dry-run inválido ou incompleto; execute a auditoria novamente antes de alterar.');
  }

  const candidates = (audit.products ?? []).filter(
    (item) =>
      item.classification === 'ambiguous' &&
      item.reason === 'meter_values_look_like_centimeters' &&
      item.suggestedCorrection?.unidadeMedida === 1
  );
  if (!candidates.length) throw new Error('Nenhum candidato seguro foi encontrado no dry-run.');
  if (audit.summary?.proposedCorrections !== candidates.length) {
    throw new Error('Dry-run inconsistente; a quantidade de correções não corresponde aos candidatos.');
  }
  return candidates;
}

function verifyCandidateStillMatches(product, candidate) {
  const current = snapshotPhysicalData(product);
  const expected = {
    unit: 0,
    width: candidate.receivedDimensions.width,
    height: candidate.receivedDimensions.height,
    depth: candidate.receivedDimensions.depth,
  };
  const unchangedDimensions =
    current.width === expected.width &&
    current.height === expected.height &&
    current.depth === expected.depth;

  if (current.unit === 1 && unchangedDimensions) {
    return {
      status: 'already_corrected',
      item: {
        id: candidate.externalId,
        sku: candidate.sku,
        name: candidate.name,
        current,
        status: 'JA_CORRETO',
      },
    };
  }
  if (current.unit !== expected.unit || !unchangedDimensions) {
    return {
      status: 'stale',
      item: {
        id: candidate.externalId,
        sku: candidate.sku,
        name: candidate.name,
        expected,
        current,
        status: 'IGNORADO_POR_ALTERACAO_POSTERIOR_AO_DRY_RUN',
      },
    };
  }

  return {
    status: 'ready',
    before: current,
    patch: {
      largura: current.width,
      altura: current.height,
      profundidade: current.depth,
      unidadeMedida: 1,
    },
  };
}

function assertPatchVerification(product, verification) {
  const after = snapshotPhysicalData(product);
  if (
    after.unit !== 1 ||
    after.width !== verification.before.width ||
    after.height !== verification.before.height ||
    after.depth !== verification.before.depth ||
    after.pesoBruto !== verification.before.pesoBruto ||
    after.pesoLiquido !== verification.before.pesoLiquido
  ) {
    throw new Error('PATCH não preservou integralmente as dimensões numéricas e os pesos.');
  }
}

function snapshotPhysicalData(product) {
  return {
    unit: parseUnit(product?.dimensoes?.unidadeMedida),
    width: toFiniteNumber(product?.dimensoes?.largura),
    height: toFiniteNumber(product?.dimensoes?.altura),
    depth: toFiniteNumber(product?.dimensoes?.profundidade),
    pesoBruto: toFiniteNumber(product?.pesoBruto),
    pesoLiquido: toFiniteNumber(product?.pesoLiquido),
  };
}

async function getProduct(productId, accessToken) {
  const response = await requestBling('GET', `/produtos/${productId}`, accessToken);
  const product = response?.data ?? response;
  if (!product?.id) throw new Error(`Produto ${productId} não foi retornado pelo Bling.`);
  return product;
}

function validateDimensionsPatchContract(spec) {
  const patch = resolveSchema(
    spec,
    spec.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.['application/json']
      ?.schema
  );
  const dimensions = resolveSchema(spec, patch.properties?.dimensoes);
  const unitDescription = dimensions.properties?.unidadeMedida?.description ?? '';
  if (
    !spec.paths?.['/produtos/{idProduto}']?.get ||
    !spec.paths?.['/produtos/{idProduto}']?.patch ||
    !dimensions.properties?.largura ||
    !dimensions.properties?.altura ||
    !dimensions.properties?.profundidade ||
    !/0.*metros.*1.*cent[ií]metros.*2.*mil[ií]metros/is.test(unitDescription)
  ) {
    throw new Error('OpenAPI Bling incompatível: PATCH seguro de dimensões não confirmado.');
  }
}

function rejectGlobalCredentials() {
  if (
    process.env.BLING_ACCESS_TOKEN &&
    !process.env.BLING_CUSTOMER_ACCESS_TOKEN &&
    !process.env.BLING_AUTH_CODE
  ) {
    throw new Error('Credencial global recusada. Use somente o app privado da Brasil Drones.');
  }
}

async function loadAccessToken() {
  if (process.env.BLING_AUTH_CODE) {
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
      body: new URLSearchParams({ grant_type: 'authorization_code', code: process.env.BLING_AUTH_CODE }),
    });
    const data = parseJson(await response.text());
    if (!response.ok || !data?.access_token) {
      throw new Error(`Troca OAuth falhou: HTTP ${response.status} ${extractError(data)}`);
    }
    return data.access_token;
  }
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) return process.env.BLING_CUSTOMER_ACCESS_TOKEN;
  throw new Error('Credencial ausente do app privado Brasil Drones.');
}

async function requestBling(method, endpoint, accessToken, options = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'enable-jwt': '1',
      };
      if (options.body) headers['Content-Type'] = 'application/json';
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
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
  return [0, 1, 2].includes(parsed) ? parsed : null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractError(value) {
  return String(value?.error?.message ?? value?.error?.description ?? value?.message ?? 'erro não detalhado')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

function safeError(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
