import crypto from 'node:crypto';
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
const EXPECTED_IMAGES = 1425;
const EXPECTED_PRODUCTS_WITH_IMAGES = 572;
const EXPECTED_COMPATIBILITY_LINKS = 818;
const BATCH_SIZE = 100;
const SQL_BATCH_SIZE = 50;
const SQL_BATCH_INDEX = process.env.STOREFRONT_ASSET_SQL_BATCH_INDEX;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const APPROVED = process.env.STOREFRONT_ASSET_RESTORE_APPROVED === 'true';
const SOURCE_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_produtos.json');
const IMPORT_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_resultado_importacao.json');
const IMAGES_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_imagens_mundrone_supabase.json');
const REPORT_FILE = path.join(process.cwd(), 'saida_bling', 'novo_catalogo_assets_restore.json');

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

function chunks(values, size = BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function assertNoError(result, operation) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.code ?? 'erro'} ${result.error.message}`);
  }
  return result.data ?? [];
}

async function selectAll(queryFactory, operation) {
  const rows = [];
  let from = 0;

  while (true) {
    const page = assertNoError(
      await queryFactory().range(from, from + 999),
      operation
    );
    rows.push(...page);
    if (page.length < 1000) return rows;
    from += 1000;
  }
}

async function selectByProductIds(supabase, table, columns, productIds) {
  const rows = [];
  for (const batch of chunks(productIds)) {
    rows.push(
      ...assertNoError(
        await supabase.from(table).select(columns).in('product_id', batch),
        `buscar ${table}`
      )
    );
  }
  return rows;
}

async function insertBatches(supabase, table, rows) {
  for (const batch of chunks(rows)) {
    assertNoError(await supabase.from(table).insert(batch), `inserir ${table}`);
  }
}

async function upsertBatches(supabase, table, rows, onConflict) {
  for (const batch of chunks(rows)) {
    assertNoError(
      await supabase.from(table).upsert(batch, { onConflict }),
      `atualizar ${table}`
    );
  }
}

async function deleteByIds(supabase, table, ids) {
  for (const batch of chunks(ids)) {
    assertNoError(await supabase.from(table).delete().in('id', batch), `limpar ${table}`);
  }
}

function buildPlan() {
  const source = readJson(SOURCE_FILE);
  const imported = readJson(IMPORT_FILE);
  const imageAudit = readJson(IMAGES_FILE);
  const sourceProducts = source.products ?? [];
  const created = imported.created ?? [];

  if (sourceProducts.length !== EXPECTED_PRODUCTS || created.length !== EXPECTED_PRODUCTS) {
    throw new Error('O catálogo auditado não possui os 599 produtos esperados.');
  }
  if (imported.status !== 'completed' || (imported.errors ?? []).length > 0) {
    throw new Error('A importação auditada do Bling não está concluída sem erros.');
  }

  const externalIdByCode = new Map(
    created.map((row) => [String(row.code), String(row.id)])
  );
  const imagesByCode = new Map(
    (imageAudit.rows ?? [])
      .filter((row) => row.status === 'COPIADO_SUPABASE')
      .map((row) => [
        String(row.code),
        (row.images ?? []).map((image) => image.supabasePublicUrl).filter(Boolean),
      ])
  );
  const desired = sourceProducts.map((product) => {
    const externalId = externalIdByCode.get(String(product.code));
    if (!externalId) throw new Error(`ID Bling ausente para o SKU ${product.code}.`);
    return {
      code: String(product.code),
      externalId,
      name: product.name,
      compatibilitySlugs: (product.compatibility ?? []).map((item) => item.slug),
      images: imagesByCode.get(String(product.code)) ?? [],
    };
  });
  const imageCount = desired.reduce((sum, product) => sum + product.images.length, 0);
  const productsWithImages = desired.filter((product) => product.images.length > 0).length;
  const compatibilityLinks = desired.reduce(
    (sum, product) => sum + product.compatibilitySlugs.length,
    0
  );

  if (
    imageCount !== EXPECTED_IMAGES ||
    productsWithImages !== EXPECTED_PRODUCTS_WITH_IMAGES ||
    compatibilityLinks !== EXPECTED_COMPATIBILITY_LINKS
  ) {
    throw new Error(
      `Artefatos divergentes: imagens=${imageCount}, produtos com imagem=${productsWithImages}, compatibilidades=${compatibilityLinks}.`
    );
  }
  if (
    desired.some((product) =>
      product.images.some(
        (url) =>
          !url.startsWith('https://') ||
          !url.includes('.supabase.co/storage/v1/object/public/product-images/')
      )
    )
  ) {
    throw new Error('O plano contém imagem que não pertence ao storage público permanente.');
  }

  return { desired, imageCount, productsWithImages, compatibilityLinks };
}

function encodeJsonForSql(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function buildSqlBatch(plan, batchIndex) {
  const batch = plan.desired.slice(
    batchIndex * SQL_BATCH_SIZE,
    (batchIndex + 1) * SQL_BATCH_SIZE
  );
  if (batch.length === 0) throw new Error(`Lote SQL inexistente: ${batchIndex}`);

  const expectedImages = batch.reduce((sum, product) => sum + product.images.length, 0);
  const expectedCompatibility = batch.reduce(
    (sum, product) => sum + product.compatibilitySlugs.length,
    0
  );
  const encoded = encodeJsonForSql(
    batch.map((product) => ({
      external_id: product.externalId,
      name: product.name,
      images: product.images,
      compatibility: product.compatibilitySlugs,
    }))
  );

  return `
begin;

create temporary table desired_storefront_assets on commit drop as
select *
from jsonb_to_recordset(
  convert_from(decode('${encoded}', 'base64'), 'utf8')::jsonb
) as desired(external_id text, name text, images jsonb, compatibility jsonb);

do $$
declare matched integer;
begin
  select count(*) into matched
  from desired_storefront_assets desired
  join public.stores stores on stores.slug = '${STORE_SLUG}'
  join public.products products
    on products.store_id = stores.id
    and products.external_provider = '${PROVIDER}'
    and products.external_id = desired.external_id;
  if matched <> ${batch.length} then
    raise exception 'Produtos do lote divergentes: %/${batch.length}', matched;
  end if;
end $$;

delete from public.product_images images
using desired_storefront_assets desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and images.store_id = stores.id
  and images.product_id = products.id;

insert into public.product_images (store_id, product_id, variant_id, url, position, alt)
select stores.id, products.id, null, image.url, (image.ordinality - 1)::integer, desired.name
from desired_storefront_assets desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
cross join lateral jsonb_array_elements_text(desired.images) with ordinality image(url, ordinality);

delete from public.product_drone_models links
using desired_storefront_assets desired, public.stores stores, public.products products
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
from desired_storefront_assets desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
cross join lateral jsonb_array_elements_text(desired.compatibility) model_slug
join public.drone_models models
  on models.store_id = stores.id
  and models.slug = model_slug;

do $$
declare image_count integer;
declare compatibility_count integer;
begin
  select count(*) into image_count
  from public.product_images images
  join public.products products on products.id = images.product_id
  join public.stores stores on stores.id = products.store_id
  join desired_storefront_assets desired on desired.external_id = products.external_id
  where stores.slug = '${STORE_SLUG}' and products.external_provider = '${PROVIDER}';

  select count(*) into compatibility_count
  from public.product_drone_models links
  join public.products products on products.id = links.product_id
  join public.stores stores on stores.id = products.store_id
  join desired_storefront_assets desired on desired.external_id = products.external_id
  where stores.slug = '${STORE_SLUG}' and products.external_provider = '${PROVIDER}';

  if image_count <> ${expectedImages} or compatibility_count <> ${expectedCompatibility} then
    raise exception 'Validação do lote falhou: imagens=%/${expectedImages}, compatibilidades=%/${expectedCompatibility}', image_count, compatibility_count;
  end if;
end $$;

commit;
`;
}

function buildSqlVerification(plan) {
  const encoded = encodeJsonForSql(plan.desired.map((product) => product.externalId));
  return `
with desired as (
  select jsonb_array_elements_text(
    convert_from(decode('${encoded}', 'base64'), 'utf8')::jsonb
  ) as external_id
), target_products as (
  select products.id
  from desired
  join public.stores stores on stores.slug = '${STORE_SLUG}'
  join public.products products
    on products.store_id = stores.id
    and products.external_provider = '${PROVIDER}'
    and products.external_id = desired.external_id
)
select
  (select count(*) from target_products) as products,
  (select count(*) from public.product_images images join target_products target on target.id = images.product_id) as images,
  (select count(distinct images.product_id) from public.product_images images join target_products target on target.id = images.product_id) as products_with_images,
  (select count(*) from public.product_drone_models links join target_products target on target.id = links.product_id) as compatibility_links,
  (select count(*) from public.product_images images join target_products target on target.id = images.product_id where images.url not like 'https://%.supabase.co/storage/v1/object/public/product-images/%') as non_permanent_images;
`;
}

async function main() {
  const plan = buildPlan();
  const baseReport = {
    status: DRY_RUN ? 'dry-run' : 'running',
    scope: 'somente product_images e product_drone_models da loja Brasil Drones',
    products: plan.desired.length,
    images: plan.imageCount,
    productsWithImages: plan.productsWithImages,
    compatibilityLinks: plan.compatibilityLinks,
    untouched: ['products', 'product_variants', 'prices', 'stock', 'orders', 'categories'],
  };

  if (DRY_RUN) {
    writeReport({ ...baseReport, finishedAt: new Date().toISOString() });
    console.log(JSON.stringify(baseReport, null, 2));
    return;
  }
  if (!APPROVED) {
    throw new Error('Execução real exige STOREFRONT_ASSET_RESTORE_APPROVED=true.');
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
  const products = await selectAll(
    () =>
      supabase
        .from('products')
        .select('id, external_id, name')
        .eq('store_id', store.id)
        .eq('external_provider', PROVIDER),
    'buscar produtos Bling'
  );
  const productByExternalId = new Map(
    products.map((product) => [String(product.external_id), product])
  );
  const missingProducts = plan.desired.filter(
    (product) => !productByExternalId.has(product.externalId)
  );
  if (missingProducts.length > 0) {
    throw new Error(`Produtos ausentes no catálogo atual: ${missingProducts.length}.`);
  }

  const models = assertNoError(
    await supabase.from('drone_models').select('id, slug').eq('store_id', store.id),
    'buscar modelos'
  );
  const modelBySlug = new Map(models.map((model) => [model.slug, model.id]));
  const missingModelSlugs = [
    ...new Set(
      plan.desired
        .flatMap((product) => product.compatibilitySlugs)
        .filter((slug) => !modelBySlug.has(slug))
    ),
  ];
  if (missingModelSlugs.length > 0) {
    throw new Error(`Modelos ausentes: ${missingModelSlugs.join(', ')}.`);
  }

  const productIds = plan.desired.map(
    (product) => productByExternalId.get(product.externalId).id
  );
  const previousImages = await selectByProductIds(
    supabase,
    'product_images',
    'id, product_id, url',
    productIds
  );
  const previousCompatibility = await selectByProductIds(
    supabase,
    'product_drone_models',
    'product_id, drone_model_id',
    productIds
  );
  const now = new Date().toISOString();
  const desiredImages = plan.desired.flatMap((product) => {
    const productId = productByExternalId.get(product.externalId).id;
    return product.images.map((url, position) => ({
      id: crypto.randomUUID(),
      store_id: store.id,
      product_id: productId,
      variant_id: null,
      url,
      position,
      alt: product.name,
    }));
  });
  const desiredCompatibility = plan.desired.flatMap((product) => {
    const productId = productByExternalId.get(product.externalId).id;
    return product.compatibilitySlugs.map((slug) => ({
      store_id: store.id,
      product_id: productId,
      drone_model_id: modelBySlug.get(slug),
      source: 'import',
      confidence: 'confirmed',
      updated_at: now,
    }));
  });

  // Insere o conjunto permanente antes de remover as referências temporárias.
  await insertBatches(supabase, 'product_images', desiredImages);
  await deleteByIds(
    supabase,
    'product_images',
    previousImages.map((image) => image.id)
  );
  await upsertBatches(
    supabase,
    'product_drone_models',
    desiredCompatibility,
    'product_id,drone_model_id'
  );

  const desiredCompatibilityKeys = new Set(
    desiredCompatibility.map(
      (link) => `${link.product_id}:${link.drone_model_id}`
    )
  );
  const staleCompatibility = previousCompatibility.filter(
    (link) =>
      !desiredCompatibilityKeys.has(`${link.product_id}:${link.drone_model_id}`)
  );
  for (const link of staleCompatibility) {
    assertNoError(
      await supabase
        .from('product_drone_models')
        .delete()
        .eq('product_id', link.product_id)
        .eq('drone_model_id', link.drone_model_id),
      'limpar compatibilidade antiga'
    );
  }

  const verifiedImages = await selectByProductIds(
    supabase,
    'product_images',
    'id, product_id, url',
    productIds
  );
  const verifiedCompatibility = await selectByProductIds(
    supabase,
    'product_drone_models',
    'product_id, drone_model_id',
    productIds
  );
  if (
    verifiedImages.length !== EXPECTED_IMAGES ||
    verifiedCompatibility.length !== EXPECTED_COMPATIBILITY_LINKS ||
    verifiedImages.some((image) => !image.url.includes('.supabase.co/storage/'))
  ) {
    throw new Error(
      `Verificação final divergente: imagens=${verifiedImages.length}, compatibilidades=${verifiedCompatibility.length}.`
    );
  }

  const report = {
    ...baseReport,
    status: 'completed',
    previousImages: previousImages.length,
    previousCompatibilityLinks: previousCompatibility.length,
    staleCompatibilityRemoved: staleCompatibility.length,
    verifiedImages: verifiedImages.length,
    verifiedCompatibilityLinks: verifiedCompatibility.length,
    finishedAt: new Date().toISOString(),
  };
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

const operation = SQL_BATCH_INDEX === 'verify'
  ? Promise.resolve().then(() => console.log(buildSqlVerification(buildPlan())))
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
