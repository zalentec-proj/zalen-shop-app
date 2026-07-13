import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { BRASIL_DRONES_MODEL_CATEGORY_PATHS } from './brasil-drones-model-category-paths.mjs';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const CATEGORIES_ENDPOINT = '/categorias/produtos';
const ROOT_PARENT_ID = 0;
const PAGE_LIMIT = 100;
const REQUEST_DELAY_MS = 350;
const MAX_RETRIES = 3;
const dryRun = process.env.DRY_RUN !== 'false' && !process.argv.includes('--run');
const approved = process.env.MODEL_CATEGORIES_APPROVED === 'true';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(process.cwd(), 'saida_bling');
const categoryMapFile = path.join(outputDir, 'category-map.json');
const outputFile = path.join(
  outputDir,
  `26_categorias_modelos_${dryRun ? 'dry_run' : 'resultado'}_${timestamp}.json`
);

const summary = {
  operation: 'bling_model_categories',
  dryRun,
  app: 'Brasil Drones customer Bling app only',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  requestedPaths: BRASIL_DRONES_MODEL_CATEGORY_PATHS,
  requestedCategoryCount: BRASIL_DRONES_MODEL_CATEGORY_PATHS.length,
  existingPaths: [],
  wouldCreatePaths: [],
  createdPaths: [],
  categoryMap: {},
  categoryMapFile: null,
  errors: [],
};

try {
  if (!dryRun && !approved) {
    throw new Error('Execução real bloqueada: defina MODEL_CATEGORIES_APPROVED=true.');
  }

  await fs.mkdir(outputDir, { recursive: true });
  const accessToken = await loadAccessToken();
  const categories = await getAllCategories(accessToken);
  const categoryIndex = buildCategoryIndex(categories);

  for (const categoryPath of normalizePaths(BRASIL_DRONES_MODEL_CATEGORY_PATHS)) {
    await ensureCategoryPath(categoryPath, categoryIndex, accessToken);
  }
} catch (error) {
  summary.errors.push(toSafeError(error));
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  await fs.mkdir(outputDir, { recursive: true });
  if (!dryRun && summary.errors.length === 0) {
    await updateCategoryMapFile();
    summary.categoryMapFile = categoryMapFile;
  }
  await fs.writeFile(outputFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Resultado: ${outputFile}`);
  console.log(
    `Categorias: existentes ${summary.existingPaths.length}, ` +
      `criariam ${summary.wouldCreatePaths.length}, criadas ${summary.createdPaths.length}, ` +
      `erros ${summary.errors.length}.`
  );
}

async function loadAccessToken() {
  if (process.env.BLING_AUTH_CODE) {
    return exchangeAuthorizationCode();
  }

  const accessToken = process.env.BLING_CUSTOMER_ACCESS_TOKEN;
  if (accessToken) {
    return accessToken;
  }

  throw new Error(
    'Credencial ausente. Use o callback OAuth do app Bling da Brasil Drones ou BLING_CUSTOMER_ACCESS_TOKEN.'
  );
}

async function exchangeAuthorizationCode() {
  const clientId = requiredEnv('BLING_CUSTOMER_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CUSTOMER_CLIENT_SECRET');
  const code = requiredEnv('BLING_AUTH_CODE');
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  const parsed = parseJson(await response.text());

  if (!response.ok) {
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }

  const accessToken = parsed?.access_token ?? parsed?.accessToken;
  if (!accessToken) {
    throw new Error('Troca OAuth Bling não retornou access token.');
  }

  return accessToken;
}

async function getAllCategories(accessToken) {
  const categories = [];

  for (let page = 1; page <= 1000; page += 1) {
    const response = await requestBling('GET', CATEGORIES_ENDPOINT, accessToken, {
      query: { pagina: page, limite: PAGE_LIMIT },
    });
    const items = extractArray(response);
    categories.push(...flattenCategories(items));

    if (items.length < PAGE_LIMIT) break;
    await sleep(REQUEST_DELAY_MS);
  }

  return dedupeById(categories);
}

async function ensureCategoryPath(fullPath, index, accessToken) {
  let parentId = ROOT_PARENT_ID;
  const parts = splitPath(fullPath);
  const built = [];

  for (const description of parts) {
    built.push(description);
    const currentPath = built.join(' > ');
    const key = makeKey(parentId, description);
    const existing = index.get(key);

    if (existing) {
      parentId = existing.id;
      summary.categoryMap[currentPath] = existing.id;
      // Dry-run parents are kept in the index only to model the hierarchy.
      // They are planned creations, not categories that already exist in Bling.
      if (
        !isDryRunId(existing.id) &&
        !summary.createdPaths.includes(currentPath) &&
        !summary.existingPaths.includes(currentPath)
      ) {
        summary.existingPaths.push(currentPath);
      }
      continue;
    }

    if (dryRun) {
      const temporaryId = `DRY::${currentPath}`;
      index.set(key, { id: temporaryId, descricao: description, parentId });
      parentId = temporaryId;
      summary.categoryMap[currentPath] = temporaryId;
      if (!summary.wouldCreatePaths.includes(currentPath)) summary.wouldCreatePaths.push(currentPath);
      continue;
    }

    const created = await createCategory(description, parentId, accessToken);
    index.set(key, { id: created.id, descricao: description, parentId });
    parentId = created.id;
    summary.categoryMap[currentPath] = created.id;
    summary.createdPaths.push(currentPath);
    await sleep(REQUEST_DELAY_MS);
  }
}

async function createCategory(descricao, parentId, accessToken) {
  const payload = { descricao };
  if (String(parentId) !== String(ROOT_PARENT_ID)) {
    payload.categoriaPai = { id: Number(parentId) };
  }

  const response = await requestBling('POST', CATEGORIES_ENDPOINT, accessToken, { body: payload });
  const data = response?.data ?? response;
  const id = data?.id ?? response?.id;
  if (!id) throw new Error(`Categoria "${descricao}" criada sem ID na resposta.`);
  return { id };
}

async function requestBling(method, endpoint, accessToken, options = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
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
    });
    const parsed = parseJson(await response.text());
    if (response.ok) return parsed;

    lastError = new Error(`${method} ${endpoint} falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
    if (response.status !== 429 && response.status < 500) throw lastError;
    await sleep(Math.min(30000, 1000 * 2 ** attempt));
  }

  throw lastError ?? new Error(`${method} ${endpoint} falhou.`);
}

function buildCategoryIndex(categories) {
  const index = new Map();
  for (const category of categories) {
    const id = extractId(category);
    const descricao = extractDescription(category);
    if (!id || !descricao) continue;
    index.set(makeKey(extractParentId(category), descricao), {
      id,
      descricao,
      parentId: extractParentId(category),
    });
  }
  return index;
}

function extractArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.categorias)) return response.categorias;
  return [];
}

function flattenCategories(items, inheritedParentId = ROOT_PARENT_ID) {
  const flat = [];
  for (const item of items ?? []) {
    if (!item || typeof item !== 'object') continue;
    const current = { ...item };
    if (extractParentId(current) === ROOT_PARENT_ID && inheritedParentId !== ROOT_PARENT_ID) {
      current.__inheritedParentId = inheritedParentId;
    }
    flat.push(current);
    const children = item.filhos ?? item.subcategorias ?? item.categorias ?? [];
    if (Array.isArray(children) && children.length) {
      flat.push(...flattenCategories(children, extractId(item) ?? inheritedParentId));
    }
  }
  return flat;
}

function dedupeById(categories) {
  const seen = new Set();
  return categories.filter((category) => {
    const signature = extractId(category) ? `id:${extractId(category)}` : JSON.stringify(category);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function extractId(category) {
  return category?.id ?? category?.codigo ?? category?.idCategoria;
}

function extractDescription(category) {
  return category?.descricao ?? category?.nome ?? category?.name;
}

function extractParentId(category) {
  if (category?.__inheritedParentId !== undefined) return category.__inheritedParentId;
  if (category?.categoriaPai?.id !== undefined) return category.categoriaPai.id;
  if (category?.idCategoriaPai !== undefined) return category.idCategoriaPai;
  if (typeof category?.categoriaPai === 'number') return category.categoriaPai;
  return ROOT_PARENT_ID;
}

function normalizePaths(paths) {
  const seen = new Set();
  return paths
    .map((item) => splitPath(item).join(' > '))
    .filter((item) => {
      const key = normalize(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => splitPath(left).length - splitPath(right).length || left.localeCompare(right, 'pt-BR'));
}

function splitPath(value) {
  return String(value)
    .split('>')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function makeKey(parentId, descricao) {
  return `${String(parentId)}::${normalize(descricao)}`;
}

function normalize(value) {
  return String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isDryRunId(value) {
  return String(value).startsWith('DRY::');
}

async function updateCategoryMapFile() {
  let existingMap = {};
  try {
    existingMap = JSON.parse(await fs.readFile(categoryMapFile, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const liveCategoryMap = Object.fromEntries(
    Object.entries(summary.categoryMap).filter(([, id]) => Number.isFinite(Number(id)))
  );
  await fs.writeFile(
    categoryMapFile,
    `${JSON.stringify({ ...existingMap, ...liveCategoryMap }, null, 2)}\n`,
    'utf8'
  );
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function extractBlingError(body) {
  if (!body || typeof body !== 'object') return 'bling_request_failed';
  if (typeof body.error === 'string') return body.error;
  if (body.error && typeof body.error === 'object') {
    return body.error.type ?? body.error.code ?? body.error.message ?? 'bling_request_failed';
  }
  return body.message ?? 'bling_request_failed';
}

function toSafeError(error) {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
