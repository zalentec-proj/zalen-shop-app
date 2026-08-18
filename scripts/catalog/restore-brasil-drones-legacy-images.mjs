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
const EXPECTED_PRODUCTS = 72;
const EXPECTED_IMAGES = 91;
const BATCH_SIZE = 50;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const APPROVED = process.env.LEGACY_IMAGE_RESTORE_APPROVED === 'true';
const SQL_MODE = process.env.LEGACY_IMAGE_SQL;
const REVIEW_FILE = path.join(process.cwd(), 'saida_bling', 'produtos_bling_revisao.json');
const IMAGE_FILE = path.join(process.cwd(), 'saida_bling', '16_imagens_supabase.json');
const REPORT_FILE = path.join(process.cwd(), 'saida_bling', 'legacy_images_restore_report.json');

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Variável obrigatória ausente: ${names.join(' ou ')}`);
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

function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

function buildPlan() {
  const review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
  const audit = JSON.parse(fs.readFileSync(IMAGE_FILE, 'utf8'));
  const imagesBySku = new Map();

  for (const row of audit.rows ?? []) {
    if (row.status !== 'COPIADA' || !row.supabase_public_url) continue;
    const images = imagesBySku.get(String(row.sku)) ?? [];
    if (!images.includes(row.supabase_public_url)) images.push(row.supabase_public_url);
    imagesBySku.set(String(row.sku), images);
  }

  const desired = review
    .map((row) => ({
      externalId: String(row.bling_id ?? '').trim(),
      name: row.nome_original || row.nome_bling,
      sku: String(row.sku),
      images: imagesBySku.get(String(row.sku)) ?? [],
    }))
    .filter((row) => row.externalId && row.images.length > 0);
  const imageCount = desired.reduce((total, row) => total + row.images.length, 0);

  if (desired.length !== EXPECTED_PRODUCTS || imageCount !== EXPECTED_IMAGES) {
    throw new Error(`Artefato divergente: produtos=${desired.length}, imagens=${imageCount}.`);
  }
  if (
    desired.some((row) =>
      row.images.some(
        (url) =>
          !url.startsWith('https://xtwobxfepsdfjrtducqb.supabase.co/') ||
          !url.includes('/storage/v1/object/public/product-images/')
      )
    )
  ) {
    throw new Error('O plano contém imagem fora do Storage público esperado.');
  }

  return { desired, imageCount };
}

function buildSql(plan) {
  const encoded = Buffer.from(
    JSON.stringify(
      plan.desired.map((row) => ({
        external_id: row.externalId,
        name: row.name,
        images: row.images,
      }))
    ),
    'utf8'
  ).toString('base64');

  return `
begin;

create temporary table desired_legacy_images on commit drop as
select *
from jsonb_to_recordset(
  convert_from(decode('${encoded}', 'base64'), 'utf8')::jsonb
) as desired(external_id text, name text, images jsonb);

do $$
declare matched integer;
begin
  select count(*) into matched
  from desired_legacy_images desired
  join public.stores stores on stores.slug = '${STORE_SLUG}'
  join public.products products
    on products.store_id = stores.id
    and products.external_provider = '${PROVIDER}'
    and products.external_id = desired.external_id;
  if matched <> ${EXPECTED_PRODUCTS} then
    raise exception 'Produtos legados divergentes: %/${EXPECTED_PRODUCTS}', matched;
  end if;
end $$;

delete from public.product_images images
using desired_legacy_images desired, public.stores stores, public.products products
where stores.slug = '${STORE_SLUG}'
  and products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
  and images.store_id = stores.id
  and images.product_id = products.id;

insert into public.product_images (store_id, product_id, variant_id, url, position, alt)
select stores.id, products.id, null, image.url, (image.ordinality - 1)::integer, desired.name
from desired_legacy_images desired
join public.stores stores on stores.slug = '${STORE_SLUG}'
join public.products products
  on products.store_id = stores.id
  and products.external_provider = '${PROVIDER}'
  and products.external_id = desired.external_id
cross join lateral jsonb_array_elements_text(desired.images) with ordinality image(url, ordinality);

do $$
declare image_count integer;
declare invalid_count integer;
begin
  select count(*), count(*) filter (
    where images.url not like 'https://xtwobxfepsdfjrtducqb.supabase.co/storage/v1/object/public/product-images/%'
  )
  into image_count, invalid_count
  from public.product_images images
  join public.products products on products.id = images.product_id
  join public.stores stores on stores.id = products.store_id
  join desired_legacy_images desired on desired.external_id = products.external_id
  where stores.slug = '${STORE_SLUG}' and products.external_provider = '${PROVIDER}';

  if image_count <> ${EXPECTED_IMAGES} or invalid_count <> 0 then
    raise exception 'Validação das imagens falhou: imagens=%/${EXPECTED_IMAGES}, inválidas=%', image_count, invalid_count;
  end if;
end $$;

commit;
`;
}

async function selectImages(supabase, storeId, productIds) {
  const rows = [];
  for (const productIdsBatch of chunks(productIds)) {
    rows.push(
      ...assertNoError(
        await supabase
          .from('product_images')
          .select('id, product_id, url')
          .eq('store_id', storeId)
          .in('product_id', productIdsBatch),
        'buscar imagens atuais'
      )
    );
  }
  return rows;
}

async function insertImages(supabase, rows) {
  for (const batch of chunks(rows)) {
    assertNoError(await supabase.from('product_images').insert(batch), 'inserir imagens permanentes');
  }
}

async function deleteImages(supabase, ids) {
  for (const batch of chunks(ids)) {
    assertNoError(await supabase.from('product_images').delete().in('id', batch), 'remover referências antigas');
  }
}

async function main() {
  const plan = buildPlan();
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const store = assertNoError(
    await supabase.from('stores').select('id').eq('slug', STORE_SLUG).single(),
    'buscar loja'
  );
  const externalIds = plan.desired.map((row) => row.externalId);
  const products = [];

  for (const externalIdBatch of chunks(externalIds)) {
    products.push(
      ...assertNoError(
        await supabase
          .from('products')
          .select('id, external_id, name')
          .eq('store_id', store.id)
          .eq('external_provider', PROVIDER)
          .in('external_id', externalIdBatch),
        'buscar produtos legados'
      )
    );
  }

  const productByExternalId = new Map(products.map((row) => [String(row.external_id), row]));
  const missing = plan.desired.filter((row) => !productByExternalId.has(row.externalId));
  if (missing.length > 0 || products.length !== EXPECTED_PRODUCTS) {
    throw new Error(`Produtos divergentes no catálogo: encontrados=${products.length}, ausentes=${missing.length}.`);
  }

  const productIds = products.map((row) => row.id);
  const previousImages = await selectImages(supabase, store.id, productIds);
  const baseReport = {
    status: DRY_RUN ? 'dry-run' : 'running',
    scope: 'somente product_images dos 72 produtos legados auditados da Brasil Drones',
    products: plan.desired.length,
    desiredImages: plan.imageCount,
    previousImages: previousImages.length,
    previousTemporaryImages: previousImages.filter((row) =>
      row.url.includes('orgbling.s3.amazonaws.com')
    ).length,
    untouched: ['products', 'product_variants', 'prices', 'stock', 'orders', 'categories'],
  };

  if (DRY_RUN) {
    const report = { ...baseReport, finishedAt: new Date().toISOString() };
    writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!APPROVED) {
    throw new Error('Execução real exige LEGACY_IMAGE_RESTORE_APPROVED=true.');
  }

  const desiredRows = plan.desired.flatMap((row) => {
    const productId = productByExternalId.get(row.externalId).id;
    return row.images.map((url, position) => ({
      id: crypto.randomUUID(),
      store_id: store.id,
      product_id: productId,
      variant_id: null,
      url,
      position,
      alt: row.name,
    }));
  });

  // Primeiro cria o conjunto permanente; só depois remove as referências
  // anteriores. Assim, uma falha intermediária nunca deixa o produto sem foto.
  await insertImages(supabase, desiredRows);
  await deleteImages(
    supabase,
    previousImages.map((row) => row.id)
  );

  const verifiedImages = await selectImages(supabase, store.id, productIds);
  if (
    verifiedImages.length !== EXPECTED_IMAGES ||
    verifiedImages.some(
      (row) =>
        !row.url.startsWith('https://xtwobxfepsdfjrtducqb.supabase.co/') ||
        !row.url.includes('/storage/v1/object/public/product-images/')
    )
  ) {
    throw new Error(`Verificação final divergente: imagens=${verifiedImages.length}.`);
  }

  const report = {
    ...baseReport,
    status: 'completed',
    verifiedImages: verifiedImages.length,
    finishedAt: new Date().toISOString(),
  };
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

const operation = SQL_MODE === 'apply'
  ? Promise.resolve().then(() => console.log(buildSql(buildPlan())))
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
