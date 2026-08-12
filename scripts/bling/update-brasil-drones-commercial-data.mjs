import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const OPENAPI_REFERENCE_URL = 'https://developer.bling.com.br/referencia';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const SOURCE_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_produtos.json');
const DRY_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_dados_dry_run.json');
const RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_resultado_dados.json');
const dryRun = process.env.DRY_RUN !== 'false';
const approved = process.env.BRASIL_DRONES_DATA_UPDATE_APPROVED === 'true';
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
  const products = source.products ?? [];
  validateSource(source.metadata, products);

  const openApi = await loadCurrentOpenApi();
  const patchSchema = resolveSchema(
    openApi,
    openApi.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.['application/json']?.schema
  );
  const stockSchema = resolveSchema(
    openApi,
    openApi.paths?.['/estoques']?.post?.requestBody?.content?.['application/json']?.schema
  );
  validateSchemas(openApi, patchSchema, stockSchema);

  const gtinPlan = products
    .filter((product) => product.gtin)
    .map((product) => ({
      code: String(product.code),
      name: product.name,
      gtin: String(product.gtin),
      checksumValid: isValidGtin(product.gtin),
      sourceSheet: product.sourceSheet,
      sourceRow: product.sourceRow,
    }));
  const costPlan = products
    .filter((product) => product.cost !== null && product.cost !== undefined && product.cost !== '')
    .map((product) => ({
      code: String(product.code),
      name: product.name,
      cost: Number(product.cost),
      quantity: Number(product.stockToImport),
      sourceSheet: product.sourceSheet,
      sourceRow: product.sourceRow,
    }));
  const stockPlan = products.map((product) => ({
    code: String(product.code),
    name: product.name,
    quantity: Number(product.stockToImport),
    cost:
      product.cost === null || product.cost === undefined || product.cost === ''
        ? null
        : Number(product.cost),
    sourceSheet: product.sourceSheet,
    sourceRow: product.sourceRow,
  }));

  const dryDocument = {
    status: 'dry_run',
    generatedAt: new Date().toISOString(),
    dryRun,
    approved,
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    openApi: {
      referenceUrl: OPENAPI_REFERENCE_URL,
      assetUrl: openApi.__assetUrl,
      version: openApi.info?.version,
      productPatchSupportsGtin: Boolean(patchSchema.properties?.gtin),
      stockPostSupportsCost: Boolean(stockSchema.properties?.custo),
    },
    summary: {
      products: products.length,
      gtinsToSet: gtinPlan.length,
      uniqueGtins: new Set(gtinPlan.map((item) => item.gtin)).size,
      invalidGtinChecksums: gtinPlan.filter((item) => !item.checksumValid).length,
      costsToSet: costPlan.length,
      productsWithoutCostPreservedBlank: products.length - costPlan.length,
      stockProductsToVerify: stockPlan.length,
      stockQuantityExpected: stockPlan.reduce((total, item) => total + item.quantity, 0),
    },
    invalidGtins: gtinPlan.filter((item) => !item.checksumValid),
    gtinPlan,
    costPlan,
    stockPlan,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(DRY_FILE, `${JSON.stringify(dryDocument, null, 2)}\n`, 'utf8');

  if (dryRun) {
    await writeResult({
      status: 'dry_run_complete',
      generatedAt: new Date().toISOString(),
      summary: dryDocument.summary,
      invalidGtins: dryDocument.invalidGtins,
      dryRunFile: DRY_FILE,
    });
    console.log(JSON.stringify({ status: 'dry_run_complete', ...dryDocument.summary }, null, 2));
    return;
  }
  if (!approved) {
    throw new Error(
      'Atualização real bloqueada: defina BRASIL_DRONES_DATA_UPDATE_APPROVED=true.'
    );
  }

  const startedAt = new Date().toISOString();
  const accessToken = await loadAccessToken();
  const deposit = await chooseSafeDeposit(accessToken);
  const existing = await findProductsByCodes(
    accessToken,
    products.map((product) => String(product.code))
  );
  const existingByCode = new Map(existing.map((item) => [String(item.codigo), item]));
  const missingProducts = products
    .filter((product) => !existingByCode.has(String(product.code)))
    .map((product) => ({ code: String(product.code), name: product.name }));
  if (missingProducts.length) {
    await writeResult({ status: 'blocked_missing_products', startedAt, deposit, missingProducts });
    throw new Error(`${missingProducts.length} produto(s) da planilha não foram encontrados no Bling.`);
  }

  const productIdByCode = new Map(
    existing.map((item) => [String(item.codigo), Number(item.id)])
  );
  const expectedByProductId = new Map(
    stockPlan.map((item) => [productIdByCode.get(item.code), { ...item, productId: productIdByCode.get(item.code) }])
  );
  const beforeBalances = await getStockBalances(
    accessToken,
    deposit.id,
    [...expectedByProductId.keys()]
  );
  const stockBeforeMismatches = buildStockMismatches(expectedByProductId, beforeBalances);

  const gtinUpdates = [];
  const gtinErrors = [];
  for (const item of gtinPlan) {
    const productId = productIdByCode.get(item.code);
    try {
      await requestBling('PATCH', `/produtos/${productId}`, accessToken, {
        body: { gtin: item.gtin },
      });
      gtinUpdates.push({ ...item, productId, status: 'ATUALIZADO' });
    } catch (error) {
      gtinErrors.push({ ...item, productId, status: 'ERRO_API', error: safeError(error) });
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const stockUpdates = [];
  const stockErrors = [];
  const beforeMismatchIds = new Set(stockBeforeMismatches.map((item) => item.productId));
  for (const expected of expectedByProductId.values()) {
    if (expected.cost === null && !beforeMismatchIds.has(expected.productId)) continue;
    const previousQuantity = Number(beforeBalances.get(expected.productId) ?? 0);
    const body = {
      produto: { id: expected.productId },
      deposito: { id: deposit.id },
      operacao: 'B',
      quantidade: expected.quantity,
      observacoes: 'Conferência de estoque e custo conforme planilha Brasil Drones.',
    };
    if (expected.cost !== null) body.custo = expected.cost;
    try {
      const response = await requestBling('POST', '/estoques', accessToken, { body });
      stockUpdates.push({
        code: expected.code,
        productId: expected.productId,
        previousQuantity,
        quantity: expected.quantity,
        cost: expected.cost,
        stockRecordId: response?.data?.id ?? response?.id ?? null,
        status: 'BALANCO_ATUALIZADO',
      });
    } catch (error) {
      stockErrors.push({
        code: expected.code,
        productId: expected.productId,
        previousQuantity,
        quantity: expected.quantity,
        cost: expected.cost,
        status: 'ERRO_API',
        error: safeError(error),
      });
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const afterBalances = await getStockBalances(
    accessToken,
    deposit.id,
    [...expectedByProductId.keys()]
  );
  const stockVerificationMismatches = buildStockMismatches(expectedByProductId, afterBalances);

  const productDetails = [];
  const detailErrors = [];
  for (const product of products) {
    const productId = productIdByCode.get(String(product.code));
    try {
      const response = await requestBling('GET', `/produtos/${productId}`, accessToken);
      productDetails.push({ code: String(product.code), productId, data: response?.data ?? response });
    } catch (error) {
      detailErrors.push({ code: String(product.code), productId, error: safeError(error) });
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  const detailByCode = new Map(productDetails.map((item) => [item.code, item.data]));
  const gtinVerificationMismatches = gtinPlan.flatMap((expected) => {
    const actual = String(detailByCode.get(expected.code)?.gtin ?? '');
    return actual === expected.gtin ? [] : [{ code: expected.code, expected: expected.gtin, actual }];
  });
  const hasErrors =
    gtinErrors.length ||
    stockErrors.length ||
    detailErrors.length ||
    stockVerificationMismatches.length ||
    gtinVerificationMismatches.length;
  const result = {
    status: hasErrors ? 'completed_with_errors' : 'completed',
    startedAt,
    finishedAt: new Date().toISOString(),
    deposit,
    summary: {
      productsFound: existing.length,
      gtinsPlanned: gtinPlan.length,
      gtinsUpdated: gtinUpdates.length,
      gtinErrors: gtinErrors.length,
      costsPlanned: costPlan.length,
      stockOrCostBalancesPosted: stockUpdates.length,
      stockErrors: stockErrors.length,
      stockQuantityExpected: stockPlan.reduce((total, item) => total + item.quantity, 0),
      stockBeforeMismatches: stockBeforeMismatches.length,
      stockAfterMismatches: stockVerificationMismatches.length,
      gtinVerificationMismatches: gtinVerificationMismatches.length,
      costsPostedToStockHistory: stockUpdates.filter((item) => item.cost !== null).length,
      productCostVerificationDeferredToSupplierSync: costPlan.length,
      detailErrors: detailErrors.length,
    },
    invalidGtinsFromSource: dryDocument.invalidGtins,
    stockBeforeMismatches,
    gtinUpdates,
    gtinErrors,
    stockUpdates,
    stockErrors,
    stockVerificationMismatches,
    gtinVerificationMismatches,
    detailErrors,
  };
  await writeResult(result);
  console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
}

function validateSource(metadata, products) {
  if (metadata?.sourceRows !== 600 || products.length !== 599) {
    throw new Error(`Fonte inesperada: ${metadata?.sourceRows} linhas e ${products.length} produtos.`);
  }
  if (new Set(products.map((product) => String(product.code))).size !== products.length) {
    throw new Error('Existem códigos duplicados no lote.');
  }
  const stockTotal = products.reduce((total, product) => total + Number(product.stockToImport), 0);
  if (Math.abs(stockTotal - 504) >= 0.0001) {
    throw new Error(`O estoque da planilha deve totalizar 504 unidades; recebeu ${stockTotal}.`);
  }
  const forbiddenGlobalVars = ['BLING_ACCESS_TOKEN'];
  const present = forbiddenGlobalVars.filter((name) => process.env[name]);
  if (present.length && !process.env.BLING_CUSTOMER_ACCESS_TOKEN && !process.env.BLING_AUTH_CODE) {
    throw new Error(`Credencial global recusada (${present.join(', ')}). Use somente o app privado Brasil Drones.`);
  }
}

function validateSchemas(spec, patchSchema, stockSchema) {
  if (!spec.paths?.['/produtos/{idProduto}']?.patch || !patchSchema.properties?.gtin) {
    throw new Error('OpenAPI atual não permite atualizar GTIN via PATCH de produto.');
  }
  const required = ['produto', 'deposito', 'operacao', 'quantidade'];
  const missing = required.filter((field) => !stockSchema.properties?.[field]);
  if (!spec.paths?.['/estoques']?.post || missing.length || !stockSchema.properties?.custo) {
    throw new Error(`OpenAPI atual não permite o balanço com custo. Campos ausentes: ${missing.join(', ')}.`);
  }
}

function buildStockMismatches(expectedByProductId, balances) {
  const mismatches = [];
  for (const expected of expectedByProductId.values()) {
    const actual = Number(balances.get(expected.productId) ?? 0);
    if (Math.abs(actual - expected.quantity) >= 0.0001) {
      mismatches.push({
        code: expected.code,
        productId: expected.productId,
        expected: expected.quantity,
        actual,
      });
    }
  }
  return mismatches;
}

function isValidGtin(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const numbers = [...digits].map(Number);
  const checkDigit = numbers.pop();
  let sum = 0;
  for (let index = numbers.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += numbers[index] * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
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

function resolveSchema(spec, schema, seen = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (seen.has(name)) return {};
    const nextSeen = new Set(seen);
    nextSeen.add(name);
    return resolveSchema(spec, spec.components?.schemas?.[name], nextSeen);
  }
  const result = { properties: { ...(schema.properties ?? {}) }, required: [...(schema.required ?? [])] };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const child of schema[key] ?? []) {
      const resolved = resolveSchema(spec, child, new Set(seen));
      Object.assign(result.properties, resolved.properties ?? {});
      result.required.push(...(resolved.required ?? []));
    }
  }
  return result;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/json,*/*' },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Falha ao consultar ${url}: HTTP ${response.status}`);
  return text;
}

async function loadAccessToken() {
  if (process.env.BLING_AUTH_CODE) return exchangeAuthorizationCode();
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) return process.env.BLING_CUSTOMER_ACCESS_TOKEN;
  throw new Error('Credencial ausente. Use OAuth ou BLING_CUSTOMER_ACCESS_TOKEN do app privado Brasil Drones.');
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
    body: new URLSearchParams({ grant_type: 'authorization_code', code: requiredEnv('BLING_AUTH_CODE') }),
  });
  const parsed = parseJson(await response.text());
  if (!response.ok || !parsed?.access_token) {
    throw new Error(`Troca OAuth falhou: HTTP ${response.status} ${extractError(parsed)}`);
  }
  return parsed.access_token;
}

async function chooseSafeDeposit(accessToken) {
  const response = await requestBling('GET', '/depositos', accessToken, {
    query: { limite: 100, situacao: 1 },
  });
  const deposits = (Array.isArray(response?.data) ? response.data : []).filter(
    (deposit) => deposit?.id && deposit?.desconsiderarSaldo !== true
  );
  const requestedId = Number(process.env.BLING_CUSTOMER_DEPOSITO_ID ?? 0);
  if (requestedId) {
    const selected = deposits.find((deposit) => Number(deposit.id) === requestedId);
    if (!selected) throw new Error('O depósito configurado não está ativo ou não considera saldo.');
    return { id: Number(selected.id), description: selected.descricao, selectedBy: 'BLING_CUSTOMER_DEPOSITO_ID' };
  }
  if (deposits.length !== 1) {
    throw new Error(`Depósito não selecionado com segurança. Foram encontrados ${deposits.length} depósitos ativos.`);
  }
  return { id: Number(deposits[0].id), description: deposits[0].descricao, selectedBy: 'único depósito ativo' };
}

async function findProductsByCodes(accessToken, codes) {
  const found = [];
  for (const group of chunk(codes, 50)) {
    const response = await requestBling('GET', '/produtos', accessToken, {
      query: { 'codigos[]': group, limite: 100 },
    });
    found.push(...(Array.isArray(response?.data) ? response.data : []));
    await sleep(REQUEST_INTERVAL_MS);
  }
  return found;
}

async function getStockBalances(accessToken, depositId, productIds) {
  const balances = new Map();
  for (const group of chunk(productIds, 50)) {
    const response = await requestBling('GET', `/estoques/saldos/${depositId}`, accessToken, {
      query: { 'idsProdutos[]': group },
    });
    for (const item of Array.isArray(response?.data) ? response.data : []) {
      const productId = Number(item?.produto?.id);
      if (productId) balances.set(productId, Number(item.saldoFisicoTotal ?? 0));
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  return balances;
}

async function requestBling(method, endpoint, accessToken, options = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  }
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
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
    lastError = new Error(`${method} ${endpoint}: HTTP ${response.status} ${extractError(parsed)}`);
    if (response.status !== 429 && response.status < 500) throw lastError;
    await sleep(Math.min(30000, 1000 * 2 ** attempt));
  }
  throw lastError ?? new Error(`${method} ${endpoint} falhou.`);
}

async function writeResult(result) {
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function extractError(value) {
  const description =
    value?.error?.description ?? value?.error_description ?? value?.message ?? value?.raw;
  const fields = value?.error?.fields ?? value?.fields;
  return `${description ?? JSON.stringify(value)}${fields ? ` ${JSON.stringify(fields)}` : ''}`;
}

function safeError(error) {
  return error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]') : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}
