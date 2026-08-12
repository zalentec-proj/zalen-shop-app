import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const SOURCE_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_produtos.json');
const CATEGORY_MAP_FILE = path.join(process.cwd(), 'saida_bling', 'category-map.json');
const OPENAPI_REFERENCE_URL = 'https://developer.bling.com.br/referencia';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_resultado_importacao.json');
const PAYLOAD_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_payloads_dry_run.json');
const dryRun = process.env.DRY_RUN !== 'false';
const approved = process.env.BRASIL_DRONES_IMPORT_APPROVED === 'true';
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
  const categoryMap = JSON.parse(await fs.readFile(CATEGORY_MAP_FILE, 'utf8'));
  const products = source.products ?? [];
  validateSource(source.metadata, products);

  const openApi = await loadCurrentOpenApi();
  const schema = resolveSchema(openApi, openApi.paths?.['/produtos']?.post?.requestBody?.content?.['application/json']?.schema);
  validateProductSchema(schema);
  const stockSchema = resolveSchema(openApi, openApi.paths?.['/estoques']?.post?.requestBody?.content?.['application/json']?.schema);
  validateStockSchema(openApi, stockSchema);

  let categoryPlan = (source.categoryPlan ?? []).map((item) => ({
    ...item,
    id: categoryMap[item.path] ?? item.id ?? null,
  }));
  let missingCategories = categoryPlan.filter((item) => !item.id);
  let payloads = buildPayloads(products, categoryPlan, { allowMissingCategory: true });
  const stockPlan = products.map((product) => ({
    code: product.code,
    quantity: Number(product.stockToImport),
    sourceSheet: product.sourceSheet,
    sourceRow: product.sourceRow,
  }));

  const dryRunDocument = {
    generatedAt: new Date().toISOString(),
    dryRun,
    approved,
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    openApi: {
      referenceUrl: OPENAPI_REFERENCE_URL,
      assetUrl: openApi.__assetUrl,
      version: openApi.info?.version,
      schemaName: openApi.paths?.['/produtos']?.post?.requestBody?.content?.['application/json']?.schema?.$ref?.split('/').at(-1),
    },
    sourceMetadata: source.metadata,
    summary: {
      sourceRows: source.metadata?.sourceRows,
      uniqueProducts: products.length,
      payloads: payloads.length,
      stockQuantityPlanned: products.reduce((total, product) => total + Number(product.stockToImport ?? 0), 0),
      productsWithPositiveStock: products.filter((product) => Number(product.stockToImport) > 0).length,
      productsWithZeroStock: products.filter((product) => Number(product.stockToImport) === 0).length,
      categoriesMissing: missingCategories.map((item) => item.path),
      blocked: products.filter((product) => product.status === 'BLOQUEADO').length,
      gtinSent: 0,
      imagesSent: 0,
    },
    payloads,
    stockPlan,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(PAYLOAD_FILE, `${JSON.stringify(dryRunDocument, null, 2)}\n`, 'utf8');

  if (missingCategories.length && dryRun) {
    const result = {
      status: 'dry_run_complete_with_category_plan',
      generatedAt: new Date().toISOString(),
      missingCategories,
      dryRunFile: PAYLOAD_FILE,
    };
    await writeResult(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (dryRun) {
    const result = {
      status: 'dry_run_complete',
      generatedAt: new Date().toISOString(),
      summary: dryRunDocument.summary,
      dryRunFile: PAYLOAD_FILE,
    };
    await writeResult(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!approved) {
    throw new Error('Importação real bloqueada: defina BRASIL_DRONES_IMPORT_APPROVED=true.');
  }

  const accessToken = await loadAccessToken();
  const deposit = await chooseSafeDeposit(accessToken);

  const existing = await findProductsByCodes(accessToken, payloads.map((item) => item.code));
  const existingByCode = new Map(existing.map((item) => [String(item.codigo), item]));
  const conflicts = payloads.flatMap((item) => {
    const found = existingByCode.get(String(item.code));
    if (!found || normalizeText(found.nome) === normalizeText(item.payload.nome)) return [];
    return [{ code: item.code, expectedName: item.payload.nome, existingId: found.id, existingName: found.nome }];
  });
  if (conflicts.length) {
    const result = {
      status: 'blocked_existing_code_conflicts',
      generatedAt: new Date().toISOString(),
      deposit,
      conflicts,
    };
    await writeResult(result);
    throw new Error(`${conflicts.length} código(s) já existem com outro nome. Nenhuma categoria, produto ou estoque foi alterado.`);
  }

  if (missingCategories.length) {
    const createdCategoryIds = await ensureMissingCategories(accessToken, missingCategories);
    Object.assign(categoryMap, createdCategoryIds);
    await fs.writeFile(CATEGORY_MAP_FILE, `${JSON.stringify(categoryMap, null, 2)}\n`, 'utf8');
    categoryPlan = categoryPlan.map((item) => ({ ...item, id: categoryMap[item.path] ?? item.id }));
    missingCategories = categoryPlan.filter((item) => !item.id);
    if (missingCategories.length) {
      throw new Error(`Categorias continuam sem ID: ${missingCategories.map((item) => item.path).join(', ')}`);
    }
    payloads = buildPayloads(products, categoryPlan);
  }
  const existingResult = existing.map((item) => ({ code: item.codigo, id: item.id, name: item.nome }));
  const toCreate = payloads.filter((item) => !existingByCode.has(String(item.code)));

  const created = [];
  const errors = [];
  for (const item of toCreate) {
    try {
      const response = await requestBling('POST', '/produtos', accessToken, { body: item.payload });
      created.push({ code: item.code, id: response?.data?.id ?? response?.id ?? null, name: item.payload.nome });
    } catch (error) {
      errors.push({ code: item.code, name: item.payload.nome, error: safeError(error) });
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const productIdByCode = new Map(existingResult.map((item) => [String(item.code), Number(item.id)]));
  for (const item of created) {
    if (item.id) productIdByCode.set(String(item.code), Number(item.id));
  }

  const stockErrors = [];
  const stockBalances = [];
  const productsWithoutId = stockPlan.filter((item) => !productIdByCode.get(String(item.code)));
  for (const item of productsWithoutId) {
    stockErrors.push({ code: item.code, quantity: item.quantity, error: 'Produto sem ID após a criação; estoque não lançado.' });
  }

  const expectedStockByProductId = new Map(
    stockPlan
      .filter((item) => productIdByCode.get(String(item.code)))
      .map((item) => [productIdByCode.get(String(item.code)), { ...item, productId: productIdByCode.get(String(item.code)) }])
  );
  let currentStockByProductId = new Map();
  try {
    currentStockByProductId = await getStockBalances(accessToken, deposit.id, [...expectedStockByProductId.keys()]);
  } catch (error) {
    stockErrors.push({ scope: 'consulta_saldos_antes', error: safeError(error) });
  }

  if (!stockErrors.some((item) => item.scope === 'consulta_saldos_antes')) {
    for (const expected of expectedStockByProductId.values()) {
      const current = Number(currentStockByProductId.get(expected.productId) ?? 0);
      if (Math.abs(current - expected.quantity) < 0.0001) {
        stockBalances.push({ code: expected.code, productId: expected.productId, quantity: expected.quantity, status: 'JA_CORRETO' });
        continue;
      }
      try {
        const response = await requestBling('POST', '/estoques', accessToken, {
          body: {
            produto: { id: expected.productId },
            deposito: { id: deposit.id },
            operacao: 'B',
            quantidade: expected.quantity,
            observacoes: 'Balanço inicial conforme abas por modelo do novo catálogo Brasil Drones.',
          },
        });
        stockBalances.push({
          code: expected.code,
          productId: expected.productId,
          previousQuantity: current,
          quantity: expected.quantity,
          stockRecordId: response?.data?.id ?? response?.id ?? null,
          status: 'BALANCO_CRIADO',
        });
      } catch (error) {
        stockErrors.push({ code: expected.code, productId: expected.productId, quantity: expected.quantity, error: safeError(error) });
      }
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  const verificationMismatches = [];
  if (!stockErrors.length) {
    const verified = await getStockBalances(accessToken, deposit.id, [...expectedStockByProductId.keys()]);
    for (const expected of expectedStockByProductId.values()) {
      const actual = Number(verified.get(expected.productId) ?? 0);
      if (Math.abs(actual - expected.quantity) >= 0.0001) {
        verificationMismatches.push({ code: expected.code, productId: expected.productId, expected: expected.quantity, actual });
      }
    }
  }

  const result = {
    status: errors.length || stockErrors.length || verificationMismatches.length ? 'completed_with_errors' : 'completed',
    startedAt: dryRunDocument.generatedAt,
    finishedAt: new Date().toISOString(),
    sourceRows: source.metadata?.sourceRows,
    uniqueProducts: products.length,
    deposit,
    existing: existingResult,
    created,
    errors,
    stockBalances,
    stockErrors,
    verificationMismatches,
    stockQuantityExpected: stockPlan.reduce((total, item) => total + item.quantity, 0),
    stockProductsExpected: stockPlan.length,
  };
  await writeResult(result);
  console.log(JSON.stringify({ ...result, created: created.length }, null, 2));
}

function buildPayloads(products, categoryPlan, options = {}) {
  const categoryIdByPath = new Map(categoryPlan.filter((item) => item.id).map((item) => [item.path, Number(item.id)]));
  return products.map((product) => ({
    code: product.code,
    sourceSheet: product.sourceSheet,
    sourceRow: product.sourceRow,
    payload: buildPayload(product, categoryIdByPath.get(product.categoryPath), options),
  }));
}

async function ensureMissingCategories(accessToken, missingCategories) {
  const categories = await getAllCategories(accessToken);
  const index = buildCategoryIndex(categories);
  const created = {};
  for (const category of missingCategories) {
    const parts = category.path.split('>').map((part) => part.trim()).filter(Boolean);
    let parentId = 0;
    const built = [];
    for (const description of parts) {
      built.push(description);
      const currentPath = built.join(' > ');
      const key = `${parentId}::${normalizeText(description)}`;
      const existing = index.get(key);
      if (existing) {
        parentId = Number(existing.id);
        created[currentPath] = parentId;
        continue;
      }
      const body = { descricao: description };
      if (parentId) body.categoriaPai = { id: parentId };
      const response = await requestBling('POST', '/categorias/produtos', accessToken, { body });
      const id = Number(response?.data?.id ?? response?.id);
      if (!id) throw new Error(`Categoria ${currentPath} criada sem ID.`);
      index.set(key, { id, parentId, descricao: description });
      parentId = id;
      created[currentPath] = id;
      await sleep(REQUEST_INTERVAL_MS);
    }
  }
  return created;
}

async function getAllCategories(accessToken) {
  const categories = [];
  for (let page = 1; page <= 1000; page += 1) {
    const response = await requestBling('GET', '/categorias/produtos', accessToken, { query: { pagina: page, limite: 100 } });
    const items = Array.isArray(response?.data) ? response.data : [];
    categories.push(...flattenCategories(items));
    if (items.length < 100) break;
    await sleep(REQUEST_INTERVAL_MS);
  }
  return categories;
}

function flattenCategories(items, inheritedParentId = 0) {
  const flattened = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const parentId = item?.categoriaPai?.id ?? item?.idCategoriaPai ?? inheritedParentId;
    flattened.push({ ...item, __parentId: parentId });
    const children = item.filhos ?? item.subcategorias ?? item.categorias ?? [];
    if (Array.isArray(children)) flattened.push(...flattenCategories(children, item.id));
  }
  return flattened;
}

function buildCategoryIndex(categories) {
  const index = new Map();
  for (const category of categories) {
    const id = category?.id ?? category?.codigo ?? category?.idCategoria;
    const description = category?.descricao ?? category?.nome ?? category?.name;
    const parentId = category?.__parentId ?? category?.categoriaPai?.id ?? category?.idCategoriaPai ?? 0;
    if (!id || !description) continue;
    index.set(`${Number(parentId)}::${normalizeText(description)}`, { id: Number(id), parentId: Number(parentId), descricao: description });
  }
  return index;
}

function buildPayload(product, categoryId, options = {}) {
  if (!categoryId && !options.allowMissingCategory) {
    throw new Error(`Categoria sem ID para ${product.code}: ${product.categoryPath}`);
  }
  const payload = {
    nome: truncate(product.name, 120),
    codigo: product.code,
    preco: product.price,
    tipo: 'P',
    situacao: normalizeText(product.situation) === 'inativo' ? 'I' : 'A',
    formato: 'S',
    unidade: product.unit || 'UN',
    marca: product.brand || undefined,
    categoria: categoryId ? { id: categoryId } : { id: `PENDENTE:${product.categoryPath}` },
    descricaoCurta: product.shortDescription || undefined,
    descricaoComplementar: product.complementaryDescription || undefined,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function validateSource(metadata, products) {
  if (metadata?.sourceRows !== 600) throw new Error(`A origem deve conter 600 linhas; recebeu ${metadata?.sourceRows}.`);
  if (products.length !== 599) throw new Error(`Esperados 599 produtos únicos; recebeu ${products.length}.`);
  if (new Set(products.map((product) => product.code)).size !== products.length) throw new Error('Existem códigos duplicados no lote.');
  if (products.some((product) => Number(product.stockToImport) < 0)) throw new Error('O lote contém estoque negativo.');
  if (products.some((product) => Number(product.stockToImport) !== Number(product.stockSource))) {
    throw new Error('O estoque do lote diverge das abas por modelo.');
  }
  const stockTotal = products.reduce((total, product) => total + Number(product.stockToImport), 0);
  if (Math.abs(stockTotal - 504) >= 0.0001) throw new Error(`O estoque deve totalizar 504 unidades; recebeu ${stockTotal}.`);
  const critical = products.filter((product) => !product.code || !product.name || !product.unit || product.price === null || product.price === undefined);
  if (critical.length) throw new Error(`Produtos sem campos críticos: ${critical.map((product) => product.code).join(', ')}`);
  const forbiddenGlobalVars = ['BLING_ACCESS_TOKEN'];
  const present = forbiddenGlobalVars.filter((name) => process.env[name]);
  if (present.length && !process.env.BLING_CUSTOMER_ACCESS_TOKEN && !process.env.BLING_AUTH_CODE) {
    throw new Error(`Credencial global recusada (${present.join(', ')}). Use somente BLING_CUSTOMER_ACCESS_TOKEN ou OAuth do app privado.`);
  }
}

function validateStockSchema(spec, schema) {
  const requiredExpected = ['produto', 'deposito', 'quantidade', 'operacao'];
  const missingRequired = requiredExpected.filter((field) => !schema.required?.includes(field));
  const missingFields = requiredExpected.filter((field) => !schema.properties?.[field]);
  const operations = schema.properties?.operacao?.enum ?? [];
  if (!spec.paths?.['/depositos']?.get || !spec.paths?.['/estoques/saldos/{idDeposito}']?.get || missingFields.length || missingRequired.length || !operations.includes('B')) {
    throw new Error(
      `Schema de estoque Bling incompatível. Campos ausentes: ${missingFields.join(', ')}; obrigatórios ausentes: ${missingRequired.join(', ')}; operação B: ${operations.includes('B')}.`
    );
  }
}

async function loadCurrentOpenApi() {
  const reference = await fetchText(OPENAPI_REFERENCE_URL);
  const referenceAsset = reference.match(/https:\/\/developer\.bling\.com\.br\/build\/assets\/reference-[A-Za-z0-9_-]+\.js/)?.[0];
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
  const response = await fetch(url, { headers: { Accept: 'text/html,application/json,*/*' }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Falha ao consultar ${url}: HTTP ${response.status}`);
  return text;
}

function validateProductSchema(schema) {
  const requiredExpected = ['nome', 'tipo', 'situacao', 'formato'];
  const fieldsUsed = ['nome', 'codigo', 'preco', 'tipo', 'situacao', 'formato', 'unidade', 'marca', 'categoria', 'descricaoCurta', 'descricaoComplementar'];
  const missingFields = fieldsUsed.filter((field) => !schema.properties?.[field]);
  const missingRequired = requiredExpected.filter((field) => !schema.required?.includes(field));
  if (missingFields.length || missingRequired.length) {
    throw new Error(`Schema Bling incompatível. Campos ausentes: ${missingFields.join(', ')}; obrigatórios ausentes: ${missingRequired.join(', ')}`);
  }
}

function resolveSchema(spec, schema, seen = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (seen.has(name)) return {};
    seen.add(name);
    return resolveSchema(spec, spec.components?.schemas?.[name], seen);
  }
  const result = { properties: { ...(schema.properties ?? {}) }, required: [...(schema.required ?? [])] };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const child of schema[key] ?? []) {
      const resolved = resolveSchema(spec, child, seen);
      Object.assign(result.properties, resolved.properties ?? {});
      result.required.push(...(resolved.required ?? []));
    }
  }
  return result;
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
  if (!response.ok || !parsed?.access_token) throw new Error(`Troca OAuth falhou: HTTP ${response.status} ${extractError(parsed)}`);
  return parsed.access_token;
}

async function chooseSafeDeposit(accessToken) {
  const response = await requestBling('GET', '/depositos', accessToken, { query: { limite: 100, situacao: 1 } });
  const deposits = (Array.isArray(response?.data) ? response.data : []).filter(
    (deposit) => deposit?.id && deposit?.desconsiderarSaldo !== true
  );
  const requestedId = Number(process.env.BLING_CUSTOMER_DEPOSITO_ID ?? 0);
  if (requestedId) {
    const selected = deposits.find((deposit) => Number(deposit.id) === requestedId);
    if (!selected) throw new Error(`BLING_CUSTOMER_DEPOSITO_ID=${requestedId} não corresponde a um depósito ativo que considera saldo.`);
    return { id: Number(selected.id), description: selected.descricao, selectedBy: 'BLING_CUSTOMER_DEPOSITO_ID' };
  }
  if (deposits.length !== 1) {
    const options = deposits.map((deposit) => `${deposit.id}:${deposit.descricao}`).join(', ') || 'nenhum';
    throw new Error(`Depósito não selecionado com segurança. Ativos disponíveis: ${options}. Defina BLING_CUSTOMER_DEPOSITO_ID.`);
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
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) url.searchParams.append(key, String(item));
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
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

function extractError(value) {
  return value?.error?.description ?? value?.error_description ?? value?.message ?? value?.raw ?? JSON.stringify(value);
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function truncate(value, maxLength) {
  const string = String(value ?? '').trim();
  return string.length <= maxLength ? string : string.slice(0, maxLength).trimEnd();
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}
