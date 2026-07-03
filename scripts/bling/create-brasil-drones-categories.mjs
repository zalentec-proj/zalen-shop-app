import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const STORE_ID = '00000000-0000-0000-0000-000000000001';
const PROVIDER_KEY = 'bling';
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const CATEGORIES_ENDPOINT = '/categorias/produtos';
const REQUEST_DELAY_MS = 450;
const PAGE_LIMIT = 100;
const MAX_RETRIES = 3;
const ROOT_PARENT_ID = 0;

const CATEGORY_PATHS = [
  'DJI',
  'DJI > Peças Originais DJI',
  'DJI > Peças Originais DJI > Frames e Carcaças',
  'DJI > Peças Originais DJI > Braços',
  'DJI > Peças Originais DJI > Dobradiças, Eixos e Acabamentos',
  'DJI > Peças Originais DJI > Placas, ESC e Controladoras',
  'DJI > Peças Originais DJI > Gimbals, PTZ e Cabos',
  'DJI > Peças Originais DJI > Câmeras e CMOS',
  'DJI > Peças Originais DJI > Sensores, IMU e GPS',
  'DJI > Peças Originais DJI > Hélices e Rotores',
  'DJI > Peças Originais DJI > Baterias e Tampas',
  'DJI > Acessórios DJI',
  'DJI > Acessórios DJI > Controles Remotos',
  'DJI > Acessórios DJI > Carregadores e Hubs',
  'DJI > Acessórios DJI > Películas e Proteções',
  'DJI > Drones Completos',
  'DJI > Outros a Classificar',
];

const dryRun = !process.argv.includes('--run');
const allowTokenRefresh = process.argv.includes('--allow-token-refresh');
const outputDir = path.join(process.cwd(), 'scripts', 'bling', 'logs');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(
  outputDir,
  `brasil-drones-categories-${dryRun ? 'dry-run' : 'run'}-${timestamp}.log`
);
const mapFile = path.join(
  outputDir,
  `brasil-drones-categories-map-${dryRun ? 'dry-run' : 'run'}-${timestamp}.json`
);

const summary = {
  dryRun,
  storeId: STORE_ID,
  providerKey: PROVIDER_KEY,
  startedAt: new Date().toISOString(),
  finishedAt: undefined,
  totalPaths: 0,
  existing: 0,
  wouldCreate: 0,
  created: 0,
  errors: 0,
  categoryMap: {},
};

await main();

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await log(`Modo: ${dryRun ? 'dry-run' : 'execução real'}`);

  const credentials = await loadBlingCredentials();

  const categoryPaths = normalizeCategoryPaths(CATEGORY_PATHS);
  summary.totalPaths = categoryPaths.length;

  await log(`Categorias planejadas: ${categoryPaths.length}`);
  const tokenState = {
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    didRefresh: false,
    allowRefresh: allowTokenRefresh,
  };

  const existingCategories = await getAllCategories(tokenState);
  await log(`Categorias existentes encontradas no Bling: ${existingCategories.length}`);

  const index = buildCategoryIndex(existingCategories);

  for (const categoryPath of categoryPaths) {
    await ensureCategoryPath(categoryPath, index, tokenState);
  }

  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(mapFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  await log('Resumo final:');
  await log(`- existentes reaproveitadas: ${summary.existing}`);
  await log(`- criariam no dry-run: ${summary.wouldCreate}`);
  await log(`- criadas: ${summary.created}`);
  await log(`- erros: ${summary.errors}`);
  await log(`Mapa: ${mapFile}`);
}

async function loadBlingCredentials() {
  if (process.env.BLING_AUTH_CODE) {
    await log('Trocando authorization code temporário por token Bling.');
    return exchangeAuthorizationCode();
  }

  if (process.env.BLING_ACCESS_TOKEN) {
    await log('Access token Bling carregado de BLING_ACCESS_TOKEN.');
    return {
      accessToken: process.env.BLING_ACCESS_TOKEN,
      refreshToken: process.env.BLING_REFRESH_TOKEN ?? 'not-used',
    };
  }

  const encryptionSecret = requiredEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY');
  const integration = await loadConnectedBlingIntegration();
  const credentials = decryptIntegrationCredentials(
    integration.credentials_encrypted,
    encryptionSecret
  );

  if (
    credentials.provider !== PROVIDER_KEY ||
    !credentials.accessToken ||
    !credentials.refreshToken
  ) {
    throw new Error('Credenciais Bling inválidas ou incompletas.');
  }

  return credentials;
}

async function exchangeAuthorizationCode() {
  const clientId = requiredEnv('BLING_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CLIENT_SECRET');
  const code = requiredEnv('BLING_AUTH_CODE');
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  });
  const parsed = parseJson(await response.text());

  if (!response.ok) {
    const safeError = extractBlingError(parsed) ?? 'oauth_exchange_failed';
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${safeError}`);
  }

  const accessToken = parsed?.access_token ?? parsed?.accessToken;
  const refreshToken = parsed?.refresh_token ?? parsed?.refreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error('Troca OAuth Bling não retornou tokens válidos.');
  }

  return { accessToken, refreshToken };
}

async function loadConnectedBlingIntegration() {
  if (process.env.BLING_CREDENTIALS_ENCRYPTED) {
    await log('Credencial Bling carregada de BLING_CREDENTIALS_ENCRYPTED.');
    return {
      credentials_encrypted: process.env.BLING_CREDENTIALS_ENCRYPTED,
    };
  }

  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? requiredEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('store_integrations')
    .select('environment, status, credentials_encrypted')
    .eq('store_id', STORE_ID)
    .eq('provider_key', PROVIDER_KEY)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao consultar integração Bling: ${error.message}`);
  }

  if (!data?.credentials_encrypted) {
    throw new Error('Integração Bling conectada não encontrada para Brasil Drones.');
  }

  return data;
}

function decryptIntegrationCredentials(encryptedPayload, secret) {
  const [version, iv, tag, encrypted] = String(encryptedPayload).split(':');

  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Formato de credencial criptografada não suportado.');
  }

  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

async function ensureCategoryPath(fullPath, index, tokenState) {
  const parts = splitPath(fullPath);
  let parentId = ROOT_PARENT_ID;
  const built = [];

  for (const part of parts) {
    built.push(part);
    const currentPath = built.join(' > ');
    const key = makeKey(parentId, part);
    const existing = index.get(key);

    if (existing) {
      parentId = existing.id;
      summary.existing += 1;
      summary.categoryMap[currentPath] = existing.id;
      await log(`EXISTE: ${currentPath} -> ID ${existing.id}`);
      continue;
    }

    if (dryRun) {
      const dryId = `DRY::${currentPath}`;
      index.set(key, { id: dryId, descricao: part, parentId });
      parentId = dryId;
      summary.wouldCreate += 1;
      summary.categoryMap[currentPath] = dryId;
      await log(`CRIARIA: ${currentPath}`);
      continue;
    }

    const created = await createCategory(part, parentId, tokenState);
    index.set(key, { id: created.id, descricao: part, parentId });
    parentId = created.id;
    summary.created += 1;
    summary.categoryMap[currentPath] = created.id;
    await log(`CRIADA: ${currentPath} -> ID ${created.id}`);
    await sleep(REQUEST_DELAY_MS);
  }
}

async function getAllCategories(tokenState) {
  const all = [];

  for (let page = 1; page <= 1000; page += 1) {
    const response = await requestBling('GET', CATEGORIES_ENDPOINT, tokenState, {
      query: { pagina: page, limite: PAGE_LIMIT },
    });
    const items = extractArray(response);
    all.push(...flattenCategories(items));

    if (!items.length || items.length < PAGE_LIMIT) {
      break;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return dedupeById(all);
}

async function createCategory(description, parentId, tokenState) {
  const payload = { descricao: description };

  if (String(parentId) !== String(ROOT_PARENT_ID)) {
    payload.categoriaPai = { id: Number(parentId) };
  }

  const response = await requestBling('POST', CATEGORIES_ENDPOINT, tokenState, {
    body: payload,
  });
  const data = response?.data ?? response;
  const id = data?.id ?? response?.id;

  if (!id) {
    throw new Error('Categoria criada, mas a resposta não trouxe ID.');
  }

  return { id };
}

async function requestBling(method, endpoint, tokenState, options = {}, retriedAuth = false) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenState.accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const parsed = parseJson(text);

    if (response.ok) {
      return parsed;
    }

    const safeError = extractBlingError(parsed) ?? 'bling_request_failed';

    if (response.status === 401 && !retriedAuth) {
      if (!tokenState.allowRefresh) {
        throw new Error(
          'Access token Bling expirado. Reconecte o Bling antes de executar o script.'
        );
      }

      await refreshAccessToken(tokenState);
      return requestBling(method, endpoint, tokenState, options, true);
    }

    lastError = new Error(`${method} ${endpoint} falhou: HTTP ${response.status} ${safeError}`);

    if (response.status !== 429 && response.status < 500) {
      throw lastError;
    }

    const delay = Math.min(30000, 1000 * 2 ** attempt);
    await log(`Tentativa ${attempt + 1} falhou (${response.status}). Nova tentativa em ${delay}ms.`);
    await sleep(delay);
  }

  throw lastError;
}

async function refreshAccessToken(tokenState) {
  if (tokenState.didRefresh) {
    throw new Error('Refresh token Bling já foi tentado nesta execução.');
  }

  const clientId = requiredEnv('BLING_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CLIENT_SECRET');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenState.refreshToken,
  });
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body,
  });
  const parsed = parseJson(await response.text());

  if (!response.ok) {
    throw new Error(`Refresh token Bling falhou: HTTP ${response.status}`);
  }

  const accessToken = parsed?.access_token ?? parsed?.accessToken;
  const refreshToken = parsed?.refresh_token ?? parsed?.refreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error('Refresh token Bling não retornou tokens válidos.');
  }

  tokenState.accessToken = accessToken;
  tokenState.refreshToken = refreshToken;
  tokenState.didRefresh = true;
  await log('Access token Bling renovado em memória para esta execução.');
}

function buildCategoryIndex(categories) {
  const index = new Map();

  for (const category of categories) {
    const id = extractId(category);
    const descricao = extractDescription(category);
    const parentId = extractParentId(category);

    if (!id || !descricao) {
      continue;
    }

    index.set(makeKey(parentId, descricao), { id, descricao, parentId });
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
  const result = [];

  for (const item of items ?? []) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const current = { ...item };

    if (extractParentId(current) === ROOT_PARENT_ID && inheritedParentId !== ROOT_PARENT_ID) {
      current.__inheritedParentId = inheritedParentId;
    }

    result.push(current);

    const children = item.filhos ?? item.subcategorias ?? item.categorias ?? [];

    if (Array.isArray(children) && children.length) {
      result.push(...flattenCategories(children, extractId(item) ?? inheritedParentId));
    }
  }

  return result;
}

function dedupeById(categories) {
  const seen = new Set();
  const result = [];

  for (const category of categories) {
    const id = extractId(category);
    const signature = id ? `id:${id}` : JSON.stringify(category);

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    result.push(category);
  }

  return result;
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

function normalizeCategoryPaths(paths) {
  const seen = new Set();

  return paths
    .map((item) => splitPath(item).join(' > '))
    .filter(Boolean)
    .filter((item) => {
      const key = normalize(item);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((a, b) => splitPath(a).length - splitPath(b).length || a.localeCompare(b, 'pt-BR'));
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
  return String(value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractBlingError(body) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  if (typeof body.error === 'string') {
    return body.error;
  }

  if (body.error && typeof body.error === 'object') {
    return body.error.type ?? body.error.code ?? body.error.message;
  }

  return body.message;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável ${name} não configurada.`);
  }

  return value;
}

async function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  await fs.appendFile(logFile, `${line}\n`, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
