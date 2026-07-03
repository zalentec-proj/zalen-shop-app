import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
loadEnvFiles();
const OUT = path.join(ROOT, 'saida_bling');
const EXISTING_MAP = path.join(
  ROOT,
  'scripts',
  'bling',
  'logs',
  'brasil-drones-categories-map-run-2026-07-02T19-30-24-727Z.json'
);
const OUT_MAP = path.join(OUT, 'category-map.json');
const BASE_URL = 'https://api.bling.com.br/Api/v3';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

const EXPECTED = [
  'DJI',
  'DJI > Drones Completos',
  'DJI > Peças Originais DJI',
  'DJI > Peças Originais DJI > Frames e Carcaças',
  'DJI > Peças Originais DJI > Dobradiças Eixos e Acabamentos',
  'DJI > Peças Originais DJI > Braços',
  'DJI > Peças Originais DJI > Gimbals PTZ e Cabos',
  'DJI > Peças Originais DJI > Placas ESC e Controladoras',
  'DJI > Peças Originais DJI > Câmeras e CMOS',
  'DJI > Peças Originais DJI > Sensores IMU e GPS',
  'DJI > Peças Originais DJI > Hélices e Rotores',
  'DJI > Peças Originais DJI > Controles Remotos',
  'DJI > Peças Originais DJI > Carregadores e Hubs',
  'DJI > Peças Originais DJI > Películas e Proteções',
  'DJI > Peças Originais DJI > Baterias e Tampas',
  'DJI > Outros a Classificar',
];

const ALIASES = new Map([
  ['DJI > Peças Originais DJI > Controles Remotos', 'DJI > Acessórios DJI > Controles Remotos'],
  ['DJI > Peças Originais DJI > Carregadores e Hubs', 'DJI > Acessórios DJI > Carregadores e Hubs'],
  ['DJI > Peças Originais DJI > Películas e Proteções', 'DJI > Acessórios DJI > Películas e Proteções'],
  ['DJI > Peças Originais DJI > Dobradiças Eixos e Acabamentos', 'DJI > Peças Originais DJI > Dobradiças, Eixos e Acabamentos'],
  ['DJI > Peças Originais DJI > Gimbals PTZ e Cabos', 'DJI > Peças Originais DJI > Gimbals, PTZ e Cabos'],
  ['DJI > Peças Originais DJI > Placas ESC e Controladoras', 'DJI > Peças Originais DJI > Placas, ESC e Controladoras'],
  ['DJI > Peças Originais DJI > Sensores IMU e GPS', 'DJI > Peças Originais DJI > Sensores, IMU e GPS'],
]);

await main();

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const localMap = await loadLocalMap();
  const resolved = resolveExpected(localMap);
  const missing = EXPECTED.filter((item) => !resolved[item]);

  const result = {
    dryRun: DRY_RUN,
    checkedAt: new Date().toISOString(),
    existing: EXPECTED.length - missing.length,
    missing: missing.length,
    wouldCreate: DRY_RUN ? missing : 0,
    created: 0,
    categories: resolved,
    missingPaths: missing,
    notes: [],
  };

  if (missing.length && DRY_RUN) {
    result.notes.push('Dry-run: categorias faltantes não foram criadas.');
  }

  if (missing.length && !DRY_RUN) {
    const token = process.env.BLING_ACCESS_TOKEN;
    if (!token) {
      throw new Error('BLING_ACCESS_TOKEN obrigatório para criar categorias.');
    }
    const apiMap = await loadApiCategoryMap(token);
    const merged = { ...localMap, ...apiMap };
    const created = await ensureMissingCategories(token, merged);
    const finalMap = resolveExpected({ ...merged, ...created });
    result.created = Object.keys(created).length;
    result.categories = finalMap;
    result.missingPaths = EXPECTED.filter((item) => !finalMap[item]);
    result.missing = result.missingPaths.length;
  }

  await fs.writeFile(OUT_MAP, `${JSON.stringify(result.categories, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(OUT, 'categorias-dry-run.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify(result, null, 2));
}

async function loadLocalMap() {
  const candidates = [OUT_MAP, EXISTING_MAP];
  const merged = {};
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      Object.assign(merged, parsed.categoryMap ?? parsed);
    } catch {}
  }
  return merged;
}

function resolveExpected(source) {
  const normalized = new Map(Object.entries(source).map(([key, value]) => [normalize(key), value]));
  const output = {};
  for (const pathName of EXPECTED) {
    output[pathName] = normalized.get(normalize(pathName)) ?? null;
    if (!output[pathName] && ALIASES.has(pathName)) {
      output[pathName] = normalized.get(normalize(ALIASES.get(pathName))) ?? null;
    }
  }
  return output;
}

async function loadApiCategoryMap(token) {
  const response = await bling(token, 'GET', '/categorias/produtos');
  const map = {};
  flattenCategories(response.data ?? response.categorias ?? [], '', map);
  return map;
}

async function ensureMissingCategories(token, existingMap) {
  const created = {};
  const current = { ...existingMap };
  for (const fullPath of EXPECTED) {
    if (resolveExpected(current)[fullPath]) continue;
    const parts = fullPath.split(' > ');
    let parentPath = '';
    let parentId = 0;
    for (const part of parts) {
      const partPath = parentPath ? `${parentPath} > ${part}` : part;
      const resolved = resolveExpected(current);
      if (resolved[partPath]) {
        parentId = resolved[partPath];
        parentPath = partPath;
        continue;
      }
      const body = { descricao: part };
      if (parentId) body.categoriaPai = { id: Number(parentId) };
      const response = await bling(token, 'POST', '/categorias/produtos', body);
      const id = response.data?.id ?? response.id;
      if (!id) throw new Error(`Categoria criada sem ID: ${partPath}`);
      current[partPath] = id;
      created[partPath] = id;
      parentId = id;
      parentPath = partPath;
    }
  }
  return created;
}

function flattenCategories(items, parentPath, map) {
  for (const item of items) {
    const name = item.descricao ?? item.nome;
    const id = item.id;
    if (!name || !id) continue;
    const fullPath = parentPath ? `${parentPath} > ${name}` : name;
    map[fullPath] = id;
    const children = item.filhos ?? item.subcategorias ?? item.categorias ?? [];
    flattenCategories(children, fullPath, map);
  }
}

async function bling(token, method, endpoint, body) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Bling ${method} ${endpoint} falhou: HTTP ${response.status}`);
  }
  return parsed;
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
