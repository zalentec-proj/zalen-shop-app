import 'server-only';

import {
  createOptionalAdminClient,
  createOptionalPublicServerClient,
} from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import { listProductsByIdsFromRepository } from './product.repository';
import type { Product } from './product.types';
import type {
  DroneModel,
  DroneModelCatalogLine,
  DroneModelCompatibilityConfidence,
  DroneModelCompatibilitySource,
  DroneModelLine,
  ProductDroneModelLink,
  ProductDroneModelMutationResult,
  ReplaceProductDroneModelsInput,
} from './drone-model.types';

type SupabaseDroneModelClient =
  | NonNullable<ReturnType<typeof createOptionalAdminClient>>
  | NonNullable<ReturnType<typeof createOptionalPublicServerClient>>;

type DroneModelLineRow = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  position: number | null;
  image_url: string | null;
  is_active: boolean | null;
};

type DroneModelRow = {
  id: string;
  store_id: string;
  line_id: string;
  name: string;
  slug: string;
  aliases: string[] | null;
  position: number | null;
  image_url: string | null;
  is_active: boolean | null;
};

type ProductDroneModelLinkRow = {
  store_id: string;
  product_id: string;
  drone_model_id: string;
  source: string | null;
  confidence: string | null;
};

function mapLine(row: DroneModelLineRow): DroneModelLine {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    slug: row.slug,
    position: row.position ?? 0,
    imageUrl: row.image_url ?? undefined,
    isActive: row.is_active ?? true,
  };
}

function mapModel(row: DroneModelRow): DroneModel {
  return {
    id: row.id,
    storeId: row.store_id,
    lineId: row.line_id,
    name: row.name,
    slug: row.slug,
    aliases: row.aliases ?? [],
    position: row.position ?? 0,
    imageUrl: row.image_url ?? undefined,
    isActive: row.is_active ?? true,
  };
}

function isCompatibilitySource(value: string | null): value is DroneModelCompatibilitySource {
  return value === 'seed' || value === 'detected' || value === 'manual' || value === 'import';
}

function isCompatibilityConfidence(
  value: string | null
): value is DroneModelCompatibilityConfidence {
  return value === 'confirmed' || value === 'review';
}

function mapLink(row: ProductDroneModelLinkRow): ProductDroneModelLink {
  return {
    storeId: row.store_id,
    productId: row.product_id,
    droneModelId: row.drone_model_id,
    source: isCompatibilitySource(row.source) ? row.source : 'manual',
    confidence: isCompatibilityConfidence(row.confidence)
      ? row.confidence
      : 'review',
  };
}

function getReadClients(adminOnly = false): SupabaseDroneModelClient[] {
  const admin = createOptionalAdminClient();

  if (adminOnly) {
    return admin ? [admin] : [];
  }

  return [createOptionalPublicServerClient(), admin].filter(
    (client): client is SupabaseDroneModelClient => Boolean(client)
  );
}

function buildCatalog(
  lineRows: DroneModelLineRow[],
  modelRows: DroneModelRow[]
): DroneModelCatalogLine[] {
  const modelsByLineId = new Map<string, DroneModel[]>();

  modelRows.forEach((row) => {
    const models = modelsByLineId.get(row.line_id) ?? [];
    models.push(mapModel(row));
    modelsByLineId.set(row.line_id, models);
  });

  return lineRows
    .map((row) => ({
      ...mapLine(row),
      models: (modelsByLineId.get(row.id) ?? []).sort((left, right) => {
        return left.position - right.position || left.name.localeCompare(right.name, 'pt-BR');
      }),
    }))
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, 'pt-BR'));
}

async function queryCatalog(
  storeId: string,
  options: { adminOnly?: boolean; includeInactive?: boolean } = {}
): Promise<DroneModelCatalogLine[]> {
  const clients = getReadClients(options.adminOnly);

  for (const supabase of clients) {
    let linesQuery = supabase
      .from('drone_model_lines')
      .select('id, store_id, name, slug, position, image_url, is_active')
      .eq('store_id', storeId)
      .order('position', { ascending: true });
    let modelsQuery = supabase
      .from('drone_models')
      .select('id, store_id, line_id, name, slug, aliases, position, image_url, is_active')
      .eq('store_id', storeId)
      .order('position', { ascending: true });

    if (!options.includeInactive) {
      linesQuery = linesQuery.eq('is_active', true);
      modelsQuery = modelsQuery.eq('is_active', true);
    }

    const [{ data: lineData, error: lineError }, { data: modelData, error: modelError }] =
      await Promise.all([linesQuery, modelsQuery]);

    if (!lineError && !modelError && lineData && modelData) {
      return buildCatalog(
        lineData as DroneModelLineRow[],
        modelData as DroneModelRow[]
      );
    }

    logDevOnce('drone-model.repository', 'model catalog query failed', {
      lineError: lineError?.message,
      modelError: modelError?.message,
    });
  }

  return [];
}

async function queryLinks(
  storeId: string,
  productIds: string[],
  adminOnly = false
): Promise<ProductDroneModelLink[]> {
  const uniqueProductIds = Array.from(new Set(productIds));
  if (uniqueProductIds.length === 0) return [];

  const clients = getReadClients(adminOnly);

  for (const supabase of clients) {
    const { data, error } = await supabase
      .from('product_drone_models')
      .select('store_id, product_id, drone_model_id, source, confidence')
      .eq('store_id', storeId)
      .in('product_id', uniqueProductIds);

    if (!error && data) {
      return (data as ProductDroneModelLinkRow[]).map(mapLink);
    }

    logDevOnce('drone-model.repository', 'product model links query failed', {
      error: error?.message,
    });
  }

  return [];
}

async function queryProductIdsByModelIds(
  storeId: string,
  modelIds: string[]
): Promise<string[]> {
  const uniqueModelIds = Array.from(new Set(modelIds));
  if (uniqueModelIds.length === 0) return [];

  const clients = getReadClients();

  for (const supabase of clients) {
    const { data, error } = await supabase
      .from('product_drone_models')
      .select('product_id')
      .eq('store_id', storeId)
      .eq('confidence', 'confirmed')
      .in('drone_model_id', uniqueModelIds);

    if (!error && data) {
      return Array.from(new Set(data.map((row) => row.product_id as string)));
    }

    logDevOnce('drone-model.repository', 'model product query failed', {
      error: error?.message,
    });
  }

  return [];
}

export async function listDroneModelCatalogFromRepository(
  storeId: string,
  options: { adminOnly?: boolean; includeInactive?: boolean } = {}
) {
  return queryCatalog(storeId, options);
}

export async function getDroneModelFromRepository(storeId: string, slug: string) {
  const catalog = await queryCatalog(storeId);

  for (const line of catalog) {
    const model = line.models.find((item) => item.slug === slug);
    if (model) return { line, model };
  }

  return null;
}

export async function getDroneModelLineFromRepository(storeId: string, slug: string) {
  const catalog = await queryCatalog(storeId);
  return catalog.find((line) => line.slug === slug) ?? null;
}

export async function listProductsForDroneModelFromRepository(
  storeId: string,
  modelId: string
): Promise<Product[]> {
  const productIds = await queryProductIdsByModelIds(storeId, [modelId]);
  return listProductsByIdsFromRepository(storeId, productIds);
}

export async function listProductsForDroneModelLineFromRepository(
  storeId: string,
  lineId: string
): Promise<Product[]> {
  const catalog = await queryCatalog(storeId);
  const line = catalog.find((item) => item.id === lineId);
  if (!line) return [];

  const productIds = await queryProductIdsByModelIds(
    storeId,
    line.models.map((model) => model.id)
  );
  return listProductsByIdsFromRepository(storeId, productIds);
}

export async function listProductDroneModelLinksFromRepository(
  storeId: string,
  productIds: string[]
) {
  return queryLinks(storeId, productIds, true);
}

export async function replaceProductDroneModelsInRepository(
  input: ReplaceProductDroneModelsInput
): Promise<ProductDroneModelMutationResult> {
  const supabase = createOptionalAdminClient();
  if (!supabase) {
    return { ok: false, error: 'supabase-admin-not-configured' };
  }

  const modelIds = Array.from(new Set(input.modelIds));
  const [{ data: product, error: productError }, { data: models, error: modelsError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id')
        .eq('store_id', input.storeId)
        .eq('id', input.productId)
        .maybeSingle(),
      modelIds.length > 0
        ? supabase
            .from('drone_models')
            .select('id')
            .eq('store_id', input.storeId)
            .in('id', modelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (productError || !product || modelsError || (models?.length ?? 0) !== modelIds.length) {
    return { ok: false, error: 'invalid-product-or-model-scope' };
  }

  const { data: previousLinks, error: previousLinksError } = await supabase
    .from('product_drone_models')
    .select('store_id, product_id, drone_model_id, source, confidence')
    .eq('store_id', input.storeId)
    .eq('product_id', input.productId);

  if (previousLinksError) {
    return { ok: false, error: 'compatibility-read-failed' };
  }

  const { error: deleteError } = await supabase
    .from('product_drone_models')
    .delete()
    .eq('store_id', input.storeId)
    .eq('product_id', input.productId);

  if (deleteError) {
    return { ok: false, error: 'compatibility-delete-failed' };
  }

  if (modelIds.length === 0) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from('product_drone_models').insert(
    modelIds.map((droneModelId) => ({
      store_id: input.storeId,
      product_id: input.productId,
      drone_model_id: droneModelId,
      source: input.source,
      confidence: input.confidence,
    }))
  );

  if (!insertError) {
    return { ok: true };
  }

  if (previousLinks && previousLinks.length > 0) {
    await supabase.from('product_drone_models').insert(previousLinks);
  }

  return { ok: false, error: 'compatibility-save-failed' };
}
