import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });
// This reconciliation must use the Supabase project linked to this checkout,
// rather than a stale parent-process credential from another local project.
dotenv.config({ path: '.env.local', quiet: true, override: true });

const STORE_SLUG = 'brasil-drones';
const PROVIDER = 'bling';
const OUTPUT_DIR = path.join(process.cwd(), 'saida_bling');
const SOURCE_FILE = path.join(OUTPUT_DIR, 'bling_dimensoes_correcao_resultado.json');
const RESULT_FILE = path.join(OUTPUT_DIR, 'bling_dimensoes_storefront_resultado.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';

await main();

async function main() {
  if (!DRY_RUN && process.env.BRASIL_DRONES_STOREFRONT_DIMENSION_SYNC_APPROVED !== 'true') {
    throw new Error(
      'Reconciliação bloqueada: defina BRASIL_DRONES_STOREFRONT_DIMENSION_SYNC_APPROVED=true.'
    );
  }

  const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
  const corrections = validateSource(source);
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const store = await requireOne(
    supabase.from('stores').select('id, slug').eq('slug', STORE_SLUG).single(),
    'buscar loja Brasil Drones'
  );
  const externalIds = corrections.map((item) => String(item.id));
  const products = await requireData(
    supabase
      .from('products')
      .select('id, external_id, status')
      .eq('store_id', store.id)
      .eq('external_provider', PROVIDER)
      .eq('status', 'active')
      .in('external_id', externalIds),
    'buscar produtos ativos espelhados'
  );
  const productByExternalId = mapUnique(products, 'external_id', 'produtos ativos espelhados');
  const missingProducts = externalIds.filter((id) => !productByExternalId.has(id));
  if (missingProducts.length) {
    throw new Error(
      `Reconciliação bloqueada: ${missingProducts.length} produto(s) não estão ativos no catálogo Zalen.`
    );
  }

  const productIds = products.map((product) => product.id);
  const variants = await requireData(
    supabase
      .from('product_variants')
      .select('id, product_id, external_id, weight, width, height, depth')
      .eq('store_id', store.id)
      .in('product_id', productIds),
    'buscar variantes espelhadas'
  );
  const variantByProductId = mapUnique(variants, 'product_id', 'variantes espelhadas');
  const plan = corrections.map((correction) => {
    const product = productByExternalId.get(String(correction.id));
    const variant = variantByProductId.get(product.id);
    if (!variant) throw new Error(`Produto ${correction.id} não tem variante no catálogo Zalen.`);
    return buildPlanItem(correction, product, variant);
  });

  const stale = plan.filter((item) => item.status === 'stale');
  if (stale.length) {
    await writeResult({
      status: 'blocked_stale_catalog_data',
      generatedAt: new Date().toISOString(),
      summary: { candidates: plan.length, stale: stale.length },
      stale,
    });
    throw new Error(
      `Reconciliação bloqueada: ${stale.length} variante(s) não correspondem ao valor previamente auditado.`
    );
  }

  if (DRY_RUN) {
    const result = {
      status: 'dry_run_completed',
      generatedAt: new Date().toISOString(),
      source: SOURCE_FILE,
      summary: {
        candidates: plan.length,
        ready: plan.filter((item) => item.status === 'ready').length,
        alreadyCorrect: plan.filter((item) => item.status === 'already_correct').length,
        stale: 0,
        expiredQuotesPlanned: true,
      },
      plan,
    };
    await writeResult(result);
    console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
    return;
  }

  const updated = [];
  const alreadyCorrect = [];
  const errors = [];
  for (const item of plan) {
    if (item.status === 'already_correct') {
      alreadyCorrect.push(item);
      continue;
    }
    try {
      await requireData(
        supabase
          .from('product_variants')
          .update({ width: item.target.width, height: item.target.height, depth: item.target.depth })
          .eq('id', item.variantId)
          .eq('store_id', store.id)
          .eq('width', item.before.width)
          .eq('height', item.before.height)
          .eq('depth', item.before.depth)
          .select('id, weight, width, height, depth')
          .single(),
        `atualizar variante ${item.sku ?? item.externalId}`
      );
      updated.push(item);
    } catch (error) {
      errors.push({ ...item, error: safeError(error) });
    }
  }

  const verification = await requireData(
    supabase
      .from('product_variants')
      .select('id, product_id, weight, width, height, depth')
      .eq('store_id', store.id)
      .in(
        'id',
        plan.map((item) => item.variantId)
      ),
    'verificar variantes corrigidas'
  );
  const verificationById = new Map(verification.map((row) => [row.id, row]));
  const verificationErrors = plan.flatMap((item) => {
    const row = verificationById.get(item.variantId);
    return row && samePhysicalData(row, item) ? [] : [{ ...item, actual: row ?? null }];
  });

  let expiredQuotes = 0;
  if (!errors.length && !verificationErrors.length) {
    const now = new Date().toISOString();
    const quoteResult = await supabase
      .from('shipping_quotes')
      .update({ expires_at: now, updated_at: now })
      .eq('store_id', store.id)
      .gt('expires_at', now)
      .select('id');
    if (quoteResult.error) throw new Error(`expirar cotações abertas: ${quoteResult.error.message}`);
    expiredQuotes = quoteResult.data?.length ?? 0;
  }

  const result = {
    status: errors.length || verificationErrors.length ? 'completed_with_errors' : 'completed',
    generatedAt: new Date().toISOString(),
    source: SOURCE_FILE,
    policy: {
      store: STORE_SLUG,
      provider: PROVIDER,
      changedFields: ['product_variants.width', 'product_variants.height', 'product_variants.depth'],
      preservedFields: ['product_variants.weight', 'preço', 'estoque', 'produto Bling'],
      expiredOnlyOpenShippingQuotes: true,
    },
    summary: {
      candidates: plan.length,
      updated: updated.length,
      alreadyCorrect: alreadyCorrect.length,
      errors: errors.length,
      verificationErrors: verificationErrors.length,
      expiredQuotes,
    },
    updated,
    alreadyCorrect,
    errors,
    verificationErrors,
  };
  await writeResult(result);
  console.log(JSON.stringify({ status: result.status, ...result.summary }, null, 2));
  if (errors.length || verificationErrors.length) process.exitCode = 1;
}

function validateSource(source) {
  if (source?.status !== 'completed' || source?.summary?.updated !== 98) {
    throw new Error('Resultado Bling incompleto; a reconciliação não será executada.');
  }
  const rows = source.updated ?? [];
  if (rows.length !== 98) throw new Error('Resultado Bling inválido: a lista de 98 produtos não está íntegra.');
  const ids = new Set(rows.map((row) => String(row.id)));
  if (ids.size !== rows.length) throw new Error('Resultado Bling inválido: IDs duplicados.');
  for (const row of rows) {
    if (
      row?.before?.unit !== 0 ||
      row?.after?.unit !== 1 ||
      !sameNumber(row.before.width, row.after.width) ||
      !sameNumber(row.before.height, row.after.height) ||
      !sameNumber(row.before.depth, row.after.depth) ||
      !sameNumber(row.before.pesoBruto, row.after.pesoBruto) ||
      !sameNumber(row.before.pesoLiquido, row.after.pesoLiquido)
    ) {
      throw new Error(`Resultado Bling inválido no produto ${row?.id ?? 'desconhecido'}.`);
    }
  }
  return rows;
}

function buildPlanItem(correction, product, variant) {
  const before = numberSnapshot(variant);
  const target = {
    width: Number(correction.after.width),
    height: Number(correction.after.height),
    depth: Number(correction.after.depth),
    weight: before.weight,
  };
  const inflated = {
    width: Number(correction.before.width) * 100,
    height: Number(correction.before.height) * 100,
    depth: Number(correction.before.depth) * 100,
  };
  const alreadyCorrect =
    sameNumber(before.width, target.width) &&
    sameNumber(before.height, target.height) &&
    sameNumber(before.depth, target.depth);
  const isExpectedPreviousSync =
    sameNumber(before.width, inflated.width) &&
    sameNumber(before.height, inflated.height) &&
    sameNumber(before.depth, inflated.depth);

  return {
    externalId: String(correction.id),
    sku: correction.sku ?? null,
    name: correction.name ?? null,
    productId: product.id,
    variantId: variant.id,
    before,
    target,
    status: alreadyCorrect ? 'already_correct' : isExpectedPreviousSync ? 'ready' : 'stale',
  };
}

function samePhysicalData(actual, item) {
  return (
    sameNumber(actual.weight, item.before.weight) &&
    sameNumber(actual.width, item.target.width) &&
    sameNumber(actual.height, item.target.height) &&
    sameNumber(actual.depth, item.target.depth)
  );
}

function numberSnapshot(row) {
  return {
    weight: toNumber(row.weight),
    width: toNumber(row.width),
    height: toNumber(row.height),
    depth: toNumber(row.depth),
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameNumber(left, right) {
  return left === right || (left !== null && right !== null && Number(left) === Number(right));
}

function mapUnique(rows, field, label) {
  const result = new Map();
  for (const row of rows) {
    const key = String(row[field]);
    if (result.has(key)) throw new Error(`${label} possuem chave duplicada: ${key}.`);
    result.set(key, row);
  }
  return result;
}

async function requireOne(query, operation) {
  const { data, error } = await query;
  if (error || !data) throw new Error(`${operation}: ${error?.message ?? 'registro não encontrado'}`);
  return data;
}

async function requireData(query, operation) {
  const { data, error } = await query;
  if (error) throw new Error(`${operation}: ${error.message}`);
  return data ?? [];
}

async function writeResult(result) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function safeError(error) {
  return String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, ' ').slice(0, 240);
}
