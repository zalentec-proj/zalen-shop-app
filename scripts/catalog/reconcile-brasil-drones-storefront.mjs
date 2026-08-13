import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true });

const STORE_SLUG = 'brasil-drones';
const PROVIDER = 'bling';
const EXPECTED_PRODUCTS = 599;
const SOURCE_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_produtos.json');
const IMPORT_FILE = path.join(
  process.cwd(),
  'saida_bling',
  'novo_catalogo_resultado_importacao.json'
);
const IMAGES_FILE = path.join(
  process.cwd(),
  'saida_bling',
  'novo_catalogo_imagens_mundrone_supabase.json'
);
const REPORT_FILE = path.join(
  process.cwd(),
  'saida_bling',
  'novo_catalogo_storefront_reconciliacao.json'
);
const DRY_RUN = process.env.DRY_RUN !== 'false';
const APPROVED = process.env.STOREFRONT_CATALOG_SYNC_APPROVED === 'true';
const BATCH_SIZE = 100;
const SQL_BATCH_INDEX = process.env.STOREFRONT_SQL_BATCH_INDEX;
const SQL_BATCH_SIZE = 50;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function chunks(values, size = BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'produto';
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

function assertNoError(result, operation) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.code ?? 'erro'} ${result.error.message}`);
  }
  return result.data ?? [];
}

async function selectAll(queryFactory) {
  const rows = [];
  let from = 0;

  while (true) {
    const result = await queryFactory().range(from, from + 999);
    const page = assertNoError(result, 'consulta paginada');
    rows.push(...page);
    if (page.length < 1000) return rows;
    from += 1000;
  }
}

async function insertBatches(supabase, table, rows) {
  for (const batch of chunks(rows)) {
    assertNoError(await supabase.from(table).insert(batch), `insert ${table}`);
  }
}

async function upsertBatches(supabase, table, rows, onConflict = 'id') {
  for (const batch of chunks(rows)) {
    assertNoError(
      await supabase.from(table).upsert(batch, { onConflict }),
      `upsert ${table}`
    );
  }
}

async function deleteByProductIds(supabase, table, productIds) {
  for (const batch of chunks(productIds)) {
    assertNoError(
      await supabase.from(table).delete().in('product_id', batch),
      `delete ${table}`
    );
  }
}

function buildPlan() {
  const source = readJson(SOURCE_FILE);
  const imported = readJson(IMPORT_FILE);
  const imageAudit = readJson(IMAGES_FILE);
  const products = source.products ?? [];
  const created = imported.created ?? [];

  if (products.length !== EXPECTED_PRODUCTS || created.length !== EXPECTED_PRODUCTS) {
    throw new Error(
      `Invariante violada: catálogo=${products.length}, IDs Bling=${created.length}, esperado=${EXPECTED_PRODUCTS}`
    );
  }
  if ((imported.errors ?? []).length > 0 || imported.status !== 'completed') {
    throw new Error('A importação privada do Bling não está concluída sem erros.');
  }

  const blingIdByCode = new Map(created.map((row) => [String(row.code), String(row.id)]));
  const imagesByCode = new Map(
    (imageAudit.rows ?? [])
      .filter((row) => row.status === 'COPIADO_SUPABASE')
      .map((row) => [
        String(row.code),
        (row.images ?? []).map((image) => image.supabasePublicUrl).filter(Boolean),
      ])
  );
  const desired = products.map((product) => {
    const externalId = blingIdByCode.get(String(product.code));
    if (!externalId) throw new Error(`Produto sem ID Bling confirmado: ${product.code}`);

    return {
      ...product,
      externalId,
      images: imagesByCode.get(String(product.code)) ?? [],
    };
  });
  const uniqueExternalIds = new Set(desired.map((product) => product.externalId));

  if (uniqueExternalIds.size !== EXPECTED_PRODUCTS) {
    throw new Error(`IDs Bling não são únicos: ${uniqueExternalIds.size}/${EXPECTED_PRODUCTS}`);
  }

  return desired;
}

function encodeJsonForSql(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function buildSqlBatch(desired, batchIndex) {
  const batch = desired.slice(
    batchIndex * SQL_BATCH_SIZE,
    (batchIndex + 1) * SQL_BATCH_SIZE
  );
  if (batch.length === 0) throw new Error(`Lote SQL inexistente: ${batchIndex}`);
  const payload = batch.map((product) => ({
    external_id: product.externalId,
    code: String(product.code),
    name: product.name,
    slug: `${slugify(product.name)}-${slugify(String(product.code))}-${product.externalId}`,
    description: product.shortDescription || product.name,
    brand: product.brand || 'DJI',
    status: String(product.situation).toLowerCase() === 'ativo' ? 'active' : 'inactive',
    price: Number(product.price ?? 0),
    stock: Math.max(0, Math.floor(Number(product.stockToImport ?? 0))),
    unit: product.unit || 'UN',
    gtin: product.gtin ? String(product.gtin) : null,
    category_external_id: `bling:${product.categoryId}`,
    compatibility: (product.compatibility ?? []).map((item) => item.slug),
    images: product.images,
  }));
  const encoded = encodeJsonForSql(payload);

  return `
create temporary table tmp_brasil_drones_catalog_batch on commit drop as
select *
from jsonb_to_recordset(
  convert_from(decode('${encoded}', 'base64'), 'utf8')::jsonb
) as desired(
  external_id text,
  code text,
  name text,
  slug text,
  description text,
  brand text,
  status text,
  price numeric,
  stock integer,
  unit text,
  gtin text,
  category_external_id text,
  compatibility jsonb,
  images jsonb
);

update public.products products
set name = desired.name,
    description = desired.description,
    brand = desired.brand,
    status = desired.status,
    requires_shipping = true,
    free_shipping = false,
    updated_at = now()
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
where products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id;

insert into public.products (
  store_id, external_provider, external_id, name, slug, description, brand,
  status, requires_shipping, free_shipping, created_at, updated_at
)
select
  stores.id, '${PROVIDER}', desired.external_id, desired.name, desired.slug,
  desired.description, desired.brand, desired.status, true, false, now(), now()
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
where not exists (
  select 1 from public.products products
  where products.store_id = stores.id
    and products.external_provider = '${PROVIDER}'
    and products.external_id = desired.external_id
);

update public.product_variants variants
set sku = desired.code,
    price = desired.price,
    promotional_price = null,
    stock = desired.stock,
    attributes_json = coalesce(variants.attributes_json, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object('unidade', desired.unit, 'gtin', desired.gtin))
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
where variants.store_id = stores.id
  and variants.product_id = products.id
  and variants.external_id = desired.external_id;

insert into public.product_variants (
  store_id, product_id, external_id, sku, price, promotional_price, stock,
  attributes_json, created_at
)
select
  stores.id, products.id, desired.external_id, desired.code, desired.price,
  null, desired.stock,
  jsonb_strip_nulls(jsonb_build_object('unidade', desired.unit, 'gtin', desired.gtin)),
  now()
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
where not exists (
  select 1 from public.product_variants variants
  where variants.store_id = stores.id
    and variants.product_id = products.id
    and variants.external_id = desired.external_id
);

delete from public.product_variants variants
using tmp_brasil_drones_catalog_batch desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and variants.store_id = stores.id
  and variants.product_id = products.id
  and variants.external_id is distinct from desired.external_id;

delete from public.product_categories links
using tmp_brasil_drones_catalog_batch desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and links.product_id = products.id;

insert into public.product_categories (product_id, category_id)
select products.id, categories.id
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
join public.categories categories
  on categories.store_id = stores.id
  and categories.external_id = desired.category_external_id
on conflict (product_id, category_id) do nothing;

delete from public.product_drone_models links
using tmp_brasil_drones_catalog_batch desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and links.store_id = stores.id
  and links.product_id = products.id;

insert into public.product_drone_models (
  store_id, product_id, drone_model_id, source, confidence, updated_at
)
select stores.id, products.id, models.id, 'import', 'confirmed', now()
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
cross join lateral jsonb_array_elements_text(desired.compatibility) model_slug
join public.drone_models models
  on models.store_id = stores.id
  and models.slug = model_slug
on conflict (product_id, drone_model_id) do update
set source = excluded.source,
    confidence = excluded.confidence,
    updated_at = now();

delete from public.product_images images
using tmp_brasil_drones_catalog_batch desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and images.store_id = stores.id
  and images.product_id = products.id;

insert into public.product_images (store_id, product_id, variant_id, url, position, alt)
select stores.id, products.id, null, image.url, (image.ordinality - 1)::integer, desired.name
from tmp_brasil_drones_catalog_batch desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
cross join lateral jsonb_array_elements_text(desired.images) with ordinality image(url, ordinality);
`;
}

function buildSqlFinalize(desired) {
  const encoded = encodeJsonForSql(desired.map((product) => product.externalId));
  return `
with desired as (
  select jsonb_array_elements_text(
    convert_from(decode('${encoded}', 'base64'), 'utf8')::jsonb
  ) as external_id
), target_store as (
  select id from public.stores where slug = '${STORE_SLUG}'
)
update public.products products
set status = 'inactive', updated_at = now()
where products.store_id = (select id from target_store)
  and products.external_provider = '${PROVIDER}'
  and not exists (
    select 1 from desired where desired.external_id = products.external_id
  );
`;
}

async function main() {
  const desired = buildPlan();
  const planned = {
    status: DRY_RUN ? 'dry-run' : 'running',
    source: 'artefatos auditados do app privado Bling Brasil Drones',
    credentialsPolicy: 'nenhuma credencial Bling global; escrita somente no Supabase da loja',
    products: desired.length,
    stock: desired.reduce((sum, product) => sum + Number(product.stockToImport ?? 0), 0),
    categoryLinks: desired.length,
    compatibilityLinks: desired.reduce(
      (sum, product) => sum + (product.compatibility?.length ?? 0),
      0
    ),
    productsWithImages: desired.filter((product) => product.images.length > 0).length,
    images: desired.reduce((sum, product) => sum + product.images.length, 0),
  };

  if (DRY_RUN) {
    writeReport({ ...planned, finishedAt: new Date().toISOString() });
    console.log(JSON.stringify(planned, null, 2));
    return;
  }
  if (!APPROVED) {
    throw new Error('Execução real exige STOREFRONT_CATALOG_SYNC_APPROVED=true.');
  }

  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const store = assertNoError(
    await supabase.from('stores').select('id').eq('slug', STORE_SLUG).single(),
    'buscar loja'
  );
  const storeId = store.id;
  const existingProducts = await selectAll(() =>
    supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('external_provider', PROVIDER)
  );
  const existingByExternalId = new Map(
    existingProducts.map((product) => [String(product.external_id), product])
  );
  const takenSlugs = new Set(existingProducts.map((product) => product.slug));
  const now = new Date().toISOString();
  const updateRows = [];
  const insertRows = [];

  for (const product of desired) {
    const existing = existingByExternalId.get(product.externalId);
    let slug = existing?.slug;

    if (!slug) {
      const base = `${slugify(product.name)}-${slugify(String(product.code))}`;
      slug = base;
      let suffix = 2;
      while (takenSlugs.has(slug)) slug = `${base}-${suffix++}`;
      takenSlugs.add(slug);
    }

    const payload = {
      store_id: storeId,
      external_provider: PROVIDER,
      external_id: product.externalId,
      name: product.name,
      slug,
      description: product.shortDescription || product.name,
      brand: product.brand || 'DJI',
      status: String(product.situation).toLowerCase() === 'ativo' ? 'active' : 'inactive',
      requires_shipping: true,
      free_shipping: false,
      updated_at: now,
    };

    if (existing) updateRows.push({ ...payload, id: existing.id });
    else insertRows.push({ ...payload, created_at: now });
  }

  await upsertBatches(supabase, 'products', updateRows);
  await insertBatches(supabase, 'products', insertRows);

  const synchronizedProducts = await selectAll(() =>
    supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('external_provider', PROVIDER)
  );
  const productByExternalId = new Map(
    synchronizedProducts.map((product) => [String(product.external_id), product])
  );
  const desiredProductIds = desired.map((product) => productByExternalId.get(product.externalId)?.id);
  if (desiredProductIds.some((id) => !id)) throw new Error('Nem todos os produtos foram persistidos.');

  const variants = await selectAll(() =>
    supabase.from('product_variants').select('*').eq('store_id', storeId)
  );
  const variantByProductId = new Map(variants.map((variant) => [variant.product_id, variant]));
  const variantUpdates = [];
  const variantInserts = [];

  for (const product of desired) {
    const productId = productByExternalId.get(product.externalId).id;
    const existingVariant = variantByProductId.get(productId);
    const attributes = {
      ...(existingVariant?.attributes_json ?? {}),
      unidade: product.unit || 'UN',
      ...(product.gtin ? { gtin: String(product.gtin) } : {}),
    };
    const payload = {
      store_id: storeId,
      product_id: productId,
      external_id: product.externalId,
      sku: String(product.code),
      price: Number(product.price ?? 0),
      promotional_price: null,
      stock: Math.max(0, Math.floor(Number(product.stockToImport ?? 0))),
      weight: existingVariant?.weight ?? null,
      width: existingVariant?.width ?? null,
      height: existingVariant?.height ?? null,
      depth: existingVariant?.depth ?? null,
      attributes_json: attributes,
    };

    if (existingVariant) variantUpdates.push({ ...payload, id: existingVariant.id });
    else variantInserts.push({ ...payload, created_at: now });
  }

  await upsertBatches(supabase, 'product_variants', variantUpdates);
  await insertBatches(supabase, 'product_variants', variantInserts);

  const categories = assertNoError(
    await supabase.from('categories').select('id, external_id').eq('store_id', storeId),
    'buscar categorias'
  );
  const categoryByExternalId = new Map(
    categories.map((category) => [category.external_id, category.id])
  );
  const categoryLinks = desired.map((product) => {
    const categoryId = categoryByExternalId.get(`bling:${product.categoryId}`);
    if (!categoryId) throw new Error(`Categoria Bling ausente no espelho: ${product.categoryId}`);
    return {
      product_id: productByExternalId.get(product.externalId).id,
      category_id: categoryId,
    };
  });

  await deleteByProductIds(supabase, 'product_categories', desiredProductIds);
  await insertBatches(supabase, 'product_categories', categoryLinks);

  const models = assertNoError(
    await supabase.from('drone_models').select('id, slug').eq('store_id', storeId),
    'buscar modelos'
  );
  const modelBySlug = new Map(models.map((model) => [model.slug, model.id]));
  const compatibilityLinks = desired.flatMap((product) =>
    (product.compatibility ?? []).map((compatibility) => {
      const droneModelId = modelBySlug.get(compatibility.slug);
      if (!droneModelId) throw new Error(`Modelo ausente no Supabase: ${compatibility.slug}`);
      return {
        store_id: storeId,
        product_id: productByExternalId.get(product.externalId).id,
        drone_model_id: droneModelId,
        source: 'import',
        confidence: 'confirmed',
        updated_at: now,
      };
    })
  );

  await deleteByProductIds(supabase, 'product_drone_models', desiredProductIds);
  await upsertBatches(
    supabase,
    'product_drone_models',
    compatibilityLinks,
    'product_id,drone_model_id'
  );

  const imageRows = desired.flatMap((product) =>
    product.images.map((url, position) => ({
      store_id: storeId,
      product_id: productByExternalId.get(product.externalId).id,
      variant_id: null,
      url,
      position,
      alt: product.name,
    }))
  );
  await deleteByProductIds(supabase, 'product_images', desiredProductIds);
  await insertBatches(supabase, 'product_images', imageRows);

  const desiredExternalIds = new Set(desired.map((product) => product.externalId));
  const staleIds = synchronizedProducts
    .filter((product) => !desiredExternalIds.has(String(product.external_id)))
    .map((product) => product.id);
  for (const batch of chunks(staleIds)) {
    assertNoError(
      await supabase
        .from('products')
        .update({ status: 'inactive', updated_at: now })
        .in('id', batch)
        .eq('store_id', storeId),
      'inativar produtos antigos'
    );
  }

  const report = {
    ...planned,
    status: 'completed',
    storeId,
    productsCreated: insertRows.length,
    productsUpdated: updateRows.length,
    staleProductsInactivated: staleIds.length,
    finishedAt: new Date().toISOString(),
  };
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

const operation = SQL_BATCH_INDEX === 'finalize'
  ? Promise.resolve().then(() => console.log(buildSqlFinalize(buildPlan())))
  : /^\d+$/.test(SQL_BATCH_INDEX ?? '')
    ? Promise.resolve().then(() =>
        console.log(buildSqlBatch(buildPlan(), Number(SQL_BATCH_INDEX)))
      )
    : main();

operation.catch((error) => {
  const report = {
    status: 'error',
    message: error instanceof Error ? error.message : 'erro desconhecido',
    finishedAt: new Date().toISOString(),
  };
  writeReport(report);
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
});
