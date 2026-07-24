import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  AdminVariantPriceSummary,
  CustomerType,
  PriceList,
  ProductVariantPrice,
} from './pricing.types';

type PriceListRow = {
  id: string;
  store_id: string;
  name: string;
  code: string;
  customer_type: string;
  status: string;
  currency: string | null;
  priority: number | null;
  is_default: boolean | null;
  automatic_discount_enabled: boolean | null;
  automatic_discount_percentage: number | string | null;
  promotion_policy: string | null;
  external_provider: string | null;
  external_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProductVariantPriceRow = {
  id: string;
  store_id: string;
  variant_id: string;
  price_list_id: string;
  price: number | string | null;
  promotional_price: number | string | null;
  source: string | null;
  external_provider: string | null;
  external_id: string | null;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

export class PricingPersistenceError extends Error {
  readonly safeReason: string;

  constructor(reason: string, error?: RepositoryError | null) {
    super('pricing_persistence_failed');
    this.name = 'PricingPersistenceError';
    this.safeReason = getSafeRepositoryErrorSignal(error)
      ? `${reason}:${getSafeRepositoryErrorSignal(error)}`
      : reason;
  }
}

const fallbackDate = new Date(0).toISOString();

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCustomerType(value: string | null | undefined): value is CustomerType {
  return value === 'pf' || value === 'pj';
}

function toPromotionPolicy(value: string | null | undefined) {
  if (value === 'stack' || value === 'promotion_only') {
    return value;
  }

  return 'best_price' as const;
}

function getSafeRepositoryErrorSignal(error: RepositoryError | null | undefined) {
  if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
    return 'schema_missing';
  }

  if (error?.code) {
    return error.code;
  }

  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('permission denied')) {
    return 'permission_denied';
  }

  if (text.includes('fetch failed')) {
    return 'fetch_failed';
  }

  return undefined;
}

function isSchemaMissing(error: RepositoryError | null | undefined) {
  return getSafeRepositoryErrorSignal(error) === 'schema_missing';
}

function mapPriceList(row: PriceListRow): PriceList {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    code: row.code,
    customerType: isCustomerType(row.customer_type) ? row.customer_type : 'pf',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    currency: row.currency ?? 'BRL',
    priority: row.priority ?? 0,
    isDefault: row.is_default ?? false,
    automaticDiscountEnabled: row.automatic_discount_enabled ?? false,
    automaticDiscountPercentage: toNumber(
      row.automatic_discount_percentage ?? 10
    ),
    promotionPolicy: toPromotionPolicy(row.promotion_policy),
    externalProvider: row.external_provider ?? undefined,
    externalId: row.external_id ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

export async function updateAutomaticPjDiscountPolicyInRepository(input: {
  storeId: string;
  enabled: boolean;
  percentage: number;
}): Promise<PriceList | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const priceList = await getDefaultPriceListFromRepository({
    storeId: input.storeId,
    customerType: 'pj',
  });

  if (!priceList) {
    throw new PricingPersistenceError('price_list_unavailable');
  }

  const { data, error } = await supabase
    .from('price_lists')
    .update({
      automatic_discount_enabled: input.enabled,
      automatic_discount_percentage: input.percentage,
      promotion_policy: 'best_price',
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', input.storeId)
    .eq('id', priceList.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new PricingPersistenceError('update_automatic_pj_discount', error);
  }

  return mapPriceList(data as PriceListRow);
}

function mapVariantPrice(row: ProductVariantPriceRow): ProductVariantPrice {
  return {
    id: row.id,
    storeId: row.store_id,
    variantId: row.variant_id,
    priceListId: row.price_list_id,
    price: toNumber(row.price),
    promotionalPrice:
      row.promotional_price === null || row.promotional_price === undefined
        ? undefined
        : toNumber(row.promotional_price),
    source: row.source === 'integration' ? 'integration' : 'manual',
    externalProvider: row.external_provider ?? undefined,
    externalId: row.external_id ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function getDefaultPriceListSeed(customerType: CustomerType) {
  return customerType === 'pj'
    ? {
        name: 'PJ empresa',
        code: 'pj_business',
        priority: 20,
      }
    : {
        name: 'PF padrão',
        code: 'pf_default',
        priority: 10,
      };
}

export async function getDefaultPriceListFromRepository(input: {
  storeId: string;
  customerType: CustomerType;
}): Promise<PriceList | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('price_lists')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('customer_type', input.customerType)
    .eq('status', 'active')
    .eq('is_default', true)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      return null;
    }

    throw new PricingPersistenceError('lookup_price_list', error);
  }

  if (data) {
    return mapPriceList(data as PriceListRow);
  }

  const seed = getDefaultPriceListSeed(input.customerType);
  const { data: inserted, error: insertError } = await supabase
    .from('price_lists')
    .insert({
      store_id: input.storeId,
      name: seed.name,
      code: seed.code,
      customer_type: input.customerType,
      is_default: true,
      priority: seed.priority,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    if (isSchemaMissing(insertError)) {
      return null;
    }

    throw new PricingPersistenceError('create_price_list', insertError);
  }

  return mapPriceList(inserted as PriceListRow);
}

export async function getVariantPriceFromRepository(input: {
  storeId: string;
  variantId: string;
  priceListId: string;
}): Promise<ProductVariantPrice | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('product_variant_prices')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('variant_id', input.variantId)
    .eq('price_list_id', input.priceListId)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      return null;
    }

    throw new PricingPersistenceError('lookup_variant_price', error);
  }

  return data ? mapVariantPrice(data as ProductVariantPriceRow) : null;
}

export async function listAdminVariantPriceSummariesFromRepository(
  storeId: string
): Promise<AdminVariantPriceSummary[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data: priceListRows, error: priceListError } = await supabase
    .from('price_lists')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active');

  if (priceListError || !priceListRows) {
    return [];
  }

  const priceLists = (priceListRows as PriceListRow[]).map(mapPriceList);
  const priceListById = new Map(priceLists.map((priceList) => [priceList.id, priceList]));

  const { data: priceRows, error: priceError } = await supabase
    .from('product_variant_prices')
    .select('*')
    .eq('store_id', storeId);

  if (priceError || !priceRows) {
    return [];
  }

  return (priceRows as ProductVariantPriceRow[])
    .map(mapVariantPrice)
    .flatMap((price): AdminVariantPriceSummary[] => {
      const priceList = priceListById.get(price.priceListId);

      if (!priceList) {
        return [];
      }

      return [{
        variantId: price.variantId,
        priceListId: price.priceListId,
        priceListName: priceList.name,
        customerType: priceList.customerType,
        price: price.price,
        promotionalPrice: price.promotionalPrice,
        effectivePrice: price.promotionalPrice ?? price.price,
        source: price.source,
        updatedAt: price.updatedAt,
      }];
    });
}

export async function upsertVariantPriceForCustomerTypeInRepository(input: {
  storeId: string;
  variantId: string;
  customerType: CustomerType;
  price: number;
}): Promise<AdminVariantPriceSummary | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const priceList = await getDefaultPriceListFromRepository({
    storeId: input.storeId,
    customerType: input.customerType,
  });

  if (!priceList) {
    throw new PricingPersistenceError('price_list_unavailable');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('product_variant_prices')
    .upsert(
      {
        store_id: input.storeId,
        variant_id: input.variantId,
        price_list_id: priceList.id,
        price: input.price,
        promotional_price: null,
        source: 'manual',
        updated_at: now,
      },
      {
        onConflict: 'store_id,variant_id,price_list_id',
      }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new PricingPersistenceError('upsert_variant_price', error);
  }

  const price = mapVariantPrice(data as ProductVariantPriceRow);

  return {
    variantId: price.variantId,
    priceListId: price.priceListId,
    priceListName: priceList.name,
    customerType: priceList.customerType,
    price: price.price,
    promotionalPrice: price.promotionalPrice,
    effectivePrice: price.promotionalPrice ?? price.price,
    source: price.source,
    updatedAt: price.updatedAt,
  };
}
