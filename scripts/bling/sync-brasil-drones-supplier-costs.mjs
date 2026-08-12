import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const SOURCE_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_produtos.json');
const AUDIT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_fornecedores_auditoria.json');
const RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_resultado_custos_fornecedor.json');
const auditOnly = process.env.AUDIT_ONLY !== 'false';
const approved = process.env.BRASIL_DRONES_COST_UPDATE_APPROVED === 'true';
const REQUEST_INTERVAL_MS = Number(process.env.BLING_REQUEST_INTERVAL_MS ?? 380);
const MAX_RETRIES = 4;

await main();

async function main() {
  const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
  const products = source.products ?? [];
  const costs = products
    .filter((product) => product.cost !== null && product.cost !== undefined && product.cost !== '')
    .map((product) => ({
      code: String(product.code),
      name: product.name,
      cost: Number(product.cost),
      sourceSheet: product.sourceSheet,
      sourceRow: product.sourceRow,
    }));
  if (products.length !== 599 || costs.length !== 116) {
    throw new Error(`Fonte inesperada: ${products.length} produtos e ${costs.length} custos.`);
  }
  rejectGlobalCredentials();

  const accessToken = await loadAccessToken();
  const contactTypes = await listContactTypes(accessToken);
  const supplierTypes = contactTypes.filter((type) => /fornecedor/i.test(String(type.descricao ?? '')));
  const suppliers = await listSuppliers(accessToken, supplierTypes);
  const productSupplierLinks = await listAllPages(accessToken, '/produtos/fornecedores');
  const pendingGtins = [
    { code: '35435', gtin: '6382838711339', checksumValid: true },
    { code: '37672', gtin: '8522088127247', checksumValid: true },
    { code: '3923783', gtin: '6382838690511', checksumValid: true },
    { code: '3243', gtin: '6382835690511', checksumValid: false },
    { code: '32324', gtin: '6452835690511', checksumValid: false },
  ];
  const gtinConflicts = [];
  for (const item of pendingGtins) {
    const currentResponse = await requestBling('GET', '/produtos', accessToken, {
      query: { criterio: 5, 'gtins[]': [item.gtin], limite: 100 },
    });
    await sleep(REQUEST_INTERVAL_MS);
    const deletedResponse = await requestBling('GET', '/produtos', accessToken, {
      query: { criterio: 4, 'gtins[]': [item.gtin], limite: 100 },
    });
    gtinConflicts.push({
      ...item,
      currentProductsFound: currentResponse?.data ?? [],
      deletedProductsFound: deletedResponse?.data ?? [],
    });
    await sleep(REQUEST_INTERVAL_MS);
  }

  const audit = {
    status: 'audit_complete',
    generatedAt: new Date().toISOString(),
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    summary: {
      contactTypes: contactTypes.length,
      supplierTypes: supplierTypes.length,
      suppliers: suppliers.length,
      existingProductSupplierLinks: productSupplierLinks.length,
      costsPlanned: costs.length,
      pendingGtins: pendingGtins.length,
      pendingGtinsWithCurrentProductConflict: gtinConflicts.filter(
        (item) => item.currentProductsFound.length
      ).length,
      pendingGtinsWithDeletedProductConflict: gtinConflicts.filter(
        (item) => item.deletedProductsFound.length
      ).length,
    },
    supplierTypes,
    suppliers,
    existingProductSupplierLinks: productSupplierLinks,
    gtinConflicts,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  if (auditOnly) {
    console.log(JSON.stringify(audit.summary, null, 2));
    return;
  }
  if (!approved) {
    throw new Error('Atualização real bloqueada: defina BRASIL_DRONES_COST_UPDATE_APPROVED=true.');
  }

  const requestedSupplierId = Number(process.env.BLING_CUSTOMER_SUPPLIER_ID ?? 0);
  let selectedSupplier = requestedSupplierId
    ? suppliers.find((supplier) => Number(supplier.id) === requestedSupplierId)
    : suppliers.length === 1
      ? suppliers[0]
      : null;
  let supplierSelectedBy = requestedSupplierId
    ? 'BLING_CUSTOMER_SUPPLIER_ID'
    : suppliers.length === 1
      ? 'único fornecedor ativo'
      : null;
  if (!selectedSupplier && !requestedSupplierId && suppliers.length === 0 && supplierTypes.length === 1) {
    const response = await requestBling('POST', '/contatos', accessToken, {
      body: {
        nome: 'Fornecedor não informado - estoque inicial Brasil Drones',
        codigo: 'FORN-ESTOQUE-INICIAL-BD',
        situacao: 'A',
        tipo: 'J',
        indicadorIe: 9,
        orgaoPublico: 'N',
        tiposContato: [{ id: Number(supplierTypes[0].id) }],
      },
    });
    const supplierId = Number(response?.data?.id ?? response?.id ?? 0);
    if (!supplierId) throw new Error('O Bling não retornou o ID do fornecedor técnico criado.');
    selectedSupplier = {
      id: supplierId,
      nome: 'Fornecedor não informado - estoque inicial Brasil Drones',
      fantasia: '',
    };
    supplierSelectedBy = 'criado para custos sem fornecedor identificado na planilha';
  }
  if (!selectedSupplier) {
    throw new Error(
      requestedSupplierId
        ? 'O fornecedor configurado não foi encontrado entre os fornecedores ativos.'
        : `Seleção de fornecedor ambígua: foram encontrados ${suppliers.length} fornecedores.`
    );
  }

  const existingProducts = await findProductsByCodes(
    accessToken,
    costs.map((item) => item.code)
  );
  const productByCode = new Map(existingProducts.map((product) => [String(product.codigo), product]));
  const missing = costs.filter((item) => !productByCode.has(item.code));
  if (missing.length) throw new Error(`${missing.length} produto(s) com custo não foram encontrados no Bling.`);

  const linksByProductId = new Map();
  for (const link of productSupplierLinks) {
    const productId = Number(link?.produto?.id);
    if (!productId) continue;
    const links = linksByProductId.get(productId) ?? [];
    links.push(link);
    linksByProductId.set(productId, links);
  }

  const updated = [];
  const created = [];
  const blocked = [];
  const errors = [];
  for (const item of costs) {
    const product = productByCode.get(item.code);
    const productId = Number(product.id);
    const links = linksByProductId.get(productId) ?? [];
    const standardLinks = links.filter((link) => link.padrao === true);
    const target = standardLinks[0] ?? (links.length === 1 ? links[0] : null);
    if (!target && links.length > 1) {
      blocked.push({ ...item, productId, reason: 'Múltiplos fornecedores sem fornecedor padrão.' });
      continue;
    }
    try {
      if (target) {
        const body = {
          descricao: target.descricao || item.name,
          codigo: target.codigo || item.code,
          precoCusto: item.cost,
          precoCompra: target.precoCompra ?? item.cost,
          padrao: true,
          produto: { id: productId },
          fornecedor: { id: Number(target?.fornecedor?.id ?? selectedSupplier.id) },
          garantia: target.garantia ?? 0,
        };
        await requestBling('PUT', `/produtos/fornecedores/${target.id}`, accessToken, { body });
        updated.push({ ...item, productId, productSupplierId: Number(target.id) });
      } else {
        const body = {
          descricao: item.name,
          codigo: item.code,
          precoCusto: item.cost,
          precoCompra: item.cost,
          padrao: true,
          produto: { id: productId },
          fornecedor: { id: Number(selectedSupplier.id) },
          garantia: 0,
        };
        const response = await requestBling('POST', '/produtos/fornecedores', accessToken, { body });
        created.push({
          ...item,
          productId,
          productSupplierId: Number(response?.data?.id ?? response?.id ?? 0) || null,
        });
      }
    } catch (error) {
      errors.push({ ...item, productId, error: safeError(error) });
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  const verificationLinks = await listAllPages(accessToken, '/produtos/fornecedores');
  const verificationByProductId = new Map(
    verificationLinks
      .filter((link) => link.padrao === true && link?.produto?.id)
      .map((link) => [Number(link.produto.id), link])
  );
  const verificationMismatches = [];
  for (const item of costs) {
    const productId = Number(productByCode.get(item.code).id);
    const link = verificationByProductId.get(productId);
    const actual = link?.precoCusto === null || link?.precoCusto === undefined
      ? null
      : Number(link.precoCusto);
    if (actual === null || Math.abs(actual - item.cost) >= 0.0001) {
      verificationMismatches.push({
        code: item.code,
        productId,
        expected: item.cost,
        actual,
        productSupplierId: link?.id ?? null,
      });
    }
  }

  const result = {
    status:
      errors.length || blocked.length || verificationMismatches.length
        ? 'completed_with_errors'
        : 'completed',
    generatedAt: new Date().toISOString(),
    selectedSupplier: {
      id: Number(selectedSupplier.id),
      nome: selectedSupplier.nome,
      fantasia: selectedSupplier.fantasia,
      selectedBy: supplierSelectedBy,
    },
    summary: {
      costsPlanned: costs.length,
      linksCreated: created.length,
      linksUpdated: updated.length,
      blocked: blocked.length,
      apiErrors: errors.length,
      verifiedSupplierLinks: costs.length - verificationMismatches.length,
      verificationMismatches: verificationMismatches.length,
    },
    created,
    updated,
    blocked,
    errors,
    verificationMismatches,
  };
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
}

async function listContactTypes(accessToken) {
  const response = await requestBling('GET', '/contatos/tipos', accessToken);
  return Array.isArray(response?.data) ? response.data : [];
}

async function listSuppliers(accessToken, supplierTypes) {
  const suppliers = [];
  for (const type of supplierTypes) {
    suppliers.push(
      ...(await listAllPages(accessToken, '/contatos', { criterio: 1, idTipoContato: type.id }))
    );
  }
  return [...new Map(suppliers.map((supplier) => [Number(supplier.id), supplier])).values()];
}

async function listAllPages(accessToken, endpoint, query = {}) {
  const items = [];
  for (let pagina = 1; ; pagina += 1) {
    const response = await requestBling('GET', endpoint, accessToken, {
      query: { ...query, pagina, limite: 100 },
    });
    const page = Array.isArray(response?.data) ? response.data : [];
    items.push(...page);
    if (page.length < 100) break;
    await sleep(REQUEST_INTERVAL_MS);
  }
  return items;
}

async function findProductsByCodes(accessToken, codes) {
  const found = [];
  for (const group of chunk(codes, 50)) {
    const response = await requestBling('GET', '/produtos', accessToken, {
      query: { 'codigos[]': group, limite: 100 },
    });
    found.push(...(response?.data ?? []));
    await sleep(REQUEST_INTERVAL_MS);
  }
  return found;
}

function rejectGlobalCredentials() {
  if (process.env.BLING_ACCESS_TOKEN && !process.env.BLING_CUSTOMER_ACCESS_TOKEN && !process.env.BLING_AUTH_CODE) {
    throw new Error('Credencial global recusada. Use somente o app privado Brasil Drones.');
  }
}

async function loadAccessToken() {
  if (process.env.BLING_AUTH_CODE) return exchangeAuthorizationCode();
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) return process.env.BLING_CUSTOMER_ACCESS_TOKEN;
  throw new Error('Credencial privada Brasil Drones ausente.');
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

function extractError(value) {
  const description = value?.error?.description ?? value?.error_description ?? value?.message ?? value?.raw;
  const fields = value?.error?.fields ?? value?.fields;
  return `${description ?? JSON.stringify(value)}${fields ? ` ${JSON.stringify(fields)}` : ''}`;
}

function safeError(error) {
  return error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]') : String(error);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}
