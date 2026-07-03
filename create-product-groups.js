import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const PRODUCTS_FILE = path.join(OUT, 'produtos_bling_revisao.json');
const DRY_FILE = path.join(OUT, '11_grupos_produtos_dry_run.json');
const RESULT_FILE = path.join(OUT, '12_resultado_grupos_produtos.json');
const MAP_FILE = path.join(OUT, 'product-group-map.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const GROUPS_APPROVED =
  String(process.env.GROUPS_APPROVED ?? process.env.UPDATE_APPROVED ?? 'false').toLowerCase() ===
  'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_GROUP_DELAY_MS ?? 700);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const products = JSON.parse(await fs.readFile(PRODUCTS_FILE, 'utf8'));
  const candidates = products.filter((product) => product.bling_id);
  const desiredGroups = buildDesiredGroups(candidates);
  const assignments = candidates.map((product) => ({
    sku: product.sku,
    bling_id: product.bling_id,
    linha_ods: product.linha_ods,
    group_name: groupNameFor(product),
    categoria_path: product.categoria_path,
  }));

  const result = {
    status: DRY_RUN || !GROUPS_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    groupsApproved: GROUPS_APPROVED,
    startedAt,
    finishedAt: null,
    totalProdutosComBlingId: candidates.length,
    gruposPlanejados: desiredGroups.length,
    vinculacoesPlanejadas: assignments.length,
    parentGroup: 'DJI',
    groups: [],
    assignments: [],
    errors: [],
    sources: ['https://developer.bling.com.br/referencia'],
  };

  await fs.writeFile(
    DRY_FILE,
    `${JSON.stringify({ dryRun: true, parentGroup: 'DJI', desiredGroups, assignments }, null, 2)}\n`,
    'utf8'
  );

  if (DRY_RUN || !GROUPS_APPROVED) {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const token = await loadAccessToken();
  if (!token) {
    throw new Error('BLING_ACCESS_TOKEN ou BLING_AUTH_CODE obrigatório para criar grupos.');
  }

  const existing = await listGroups(token);
  const map = new Map();
  for (const group of existing) {
    const parentName = group.grupoProdutoPai?.nome ?? '';
    map.set(groupKey(group.nome, parentName), group);
  }

  const parent = await ensureGroup(token, map, 'DJI', null, result);
  for (const groupName of desiredGroups) {
    await ensureGroup(token, map, groupName, parent, result);
  }

  const groupMap = Object.fromEntries(
    [...map.values()]
      .filter((group) => group.nome === 'DJI' || group.grupoProdutoPai?.id === parent.id)
      .map((group) => [group.nome, group])
  );
  await fs.writeFile(MAP_FILE, `${JSON.stringify(groupMap, null, 2)}\n`, 'utf8');

  for (const item of assignments) {
    await sleep(REQUEST_DELAY_MS);
    const group = map.get(groupKey(item.group_name, 'DJI'));
    if (!group?.id) {
      const error = `grupo_nao_resolvido:${item.group_name}`;
      result.assignments.push({ ...item, status: 'ERRO_GRUPO', error });
      result.errors.push({ scope: 'vinculo', sku: item.sku, error });
      continue;
    }
    try {
      await bling(token, 'PATCH', `/produtos/${item.bling_id}`, {
        marca: 'DJI',
        tributacao: {
          grupoProduto: { id: Number(group.id) },
        },
      });
      result.assignments.push({
        ...item,
        grupoProdutoId: group.id,
        status: 'VINCULADO',
      });
    } catch (error) {
      result.assignments.push({ ...item, grupoProdutoId: group.id, status: 'ERRO_API', error: safeError(error) });
      result.errors.push({ scope: 'vinculo', sku: item.sku, error: safeError(error) });
    }
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
}

function buildDesiredGroups(products) {
  return [...new Set(products.map(groupNameFor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function groupNameFor(product) {
  const leaf = String(product.categoria_path ?? '').split('>').map((part) => part.trim()).filter(Boolean).at(-1);
  return leaf || 'Outros a Classificar';
}

async function ensureGroup(token, map, name, parent, result) {
  const parentName = parent?.nome ?? '';
  const key = groupKey(name, parentName);
  const existing = map.get(key);
  if (existing) {
    result.groups.push({ nome: name, id: existing.id, parent: parentName || null, status: 'EXISTENTE' });
    return existing;
  }

  await sleep(REQUEST_DELAY_MS);
  const body = parent?.id ? { nome: name, grupoProdutoPai: { id: Number(parent.id) } } : { nome: name };
  const response = await bling(token, 'POST', '/grupos-produtos', body);
  const id = response?.data?.id;
  if (!id) {
    throw new Error(`Grupo criado sem ID na resposta: ${name}`);
  }
  const created = { id, nome: name, grupoProdutoPai: parent?.id ? { id: parent.id, nome: parent.nome } : undefined };
  map.set(key, created);
  result.groups.push({ nome: name, id, parent: parentName || null, status: 'CRIADO' });
  return created;
}

async function listGroups(token) {
  const groups = [];
  let pagina = 1;
  while (pagina <= 20) {
    const response = await bling(token, 'GET', '/grupos-produtos', undefined, { pagina, limite: 100 });
    const data = response.data ?? [];
    groups.push(...data);
    if (data.length < 100) break;
    pagina += 1;
    await sleep(REQUEST_DELAY_MS);
  }
  return groups;
}

function groupKey(name, parentName = '') {
  return `${normalize(name)}|${normalize(parentName)}`;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function loadAccessToken() {
  if (process.env.BLING_ACCESS_TOKEN) return process.env.BLING_ACCESS_TOKEN;
  if (!process.env.BLING_AUTH_CODE) return undefined;
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('BLING_CLIENT_ID e BLING_CLIENT_SECRET obrigatórios para trocar BLING_AUTH_CODE.');
  }
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: process.env.BLING_AUTH_CODE }),
    signal: AbortSignal.timeout(20000),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.access_token) {
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }
  return parsed.access_token;
}

async function bling(token, method, endpoint, body, query = {}) {
  const url = new URL(`${BLING_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`HTTP ${response.status} ${extractBlingError(parsed)}`);
  return parsed;
}

async function appendReport(result) {
  const text = await fs.readFile(REPORT_FILE, 'utf8').catch(() => '');
  const summary = summarize(result);
  const section = [
    '',
    '## Grupos de produto Bling',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZAÇÃO REAL'}`,
    `- Grupo pai: ${result.parentGroup}`,
    `- Grupos criados: ${summary.gruposCriados}`,
    `- Grupos existentes: ${summary.gruposExistentes}`,
    `- Produtos vinculados: ${summary.produtosVinculados}`,
    `- Vínculos com erro: ${summary.vinculosErro}`,
    `- Erros totais: ${summary.errors}`,
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    gruposCriados: result.groups.filter((item) => item.status === 'CRIADO').length,
    gruposExistentes: result.groups.filter((item) => item.status === 'EXISTENTE').length,
    produtosVinculados: result.assignments.filter((item) => item.status === 'VINCULADO').length,
    vinculosErro: result.assignments.filter((item) => item.status !== 'VINCULADO').length,
    errors: result.errors.length,
  };
}

function safeError(error) {
  if (error instanceof Error) return error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  return 'unknown_error';
}

function extractBlingError(body) {
  return body?.error?.type ?? body?.error?.message ?? body?.error ?? 'bling_request_failed';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
