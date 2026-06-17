import 'server-only';

import {
  droneAccessoriesImage,
  mavic3ProImage,
  mini4ProImage,
} from '@/assets/images';
import {
  createOptionalAdminClient,
  createOptionalClient,
  createOptionalPublicServerClient,
} from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import type {
  Category,
  Product,
  ProductImage,
  ProductStatus,
  ProductSummary,
  ProductVariant,
} from './product.types';
import {
  getMockCategoryBySlug,
  getMockProductBySlug,
  getMockProductSummaries,
  getMockProductsByCategory,
  getMockRelatedProducts,
  mockCategories,
  mockProducts,
  toProductSummary,
} from './product.mock';

export type CatalogDataSource = 'supabase' | 'mock';

export interface CatalogRepositoryResult<T> {
  data: T;
  source: CatalogDataSource;
}

export type CatalogMutationResult =
  | {
      ok: true;
      persisted: boolean;
      source: CatalogDataSource;
    }
  | {
      ok: false;
      persisted: false;
      source: CatalogDataSource;
      error: string;
    };

export interface UpdateProductStatusInput {
  storeId: string;
  productId: string;
  status: ProductStatus;
}

export interface UpdateProductStockInput {
  storeId: string;
  productId: string;
  stock: number;
}

export interface UpsertIntegrationCategoryInput {
  externalId: string;
  name: string;
}

export interface UpsertIntegrationProductInput {
  storeId: string;
  externalProvider: string;
  externalId: string;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  status: ProductStatus;
  requiresShipping?: boolean;
  variant: {
    externalId: string;
    sku?: string;
    price: number;
    promotionalPrice?: number;
    stock: number;
    weight?: number;
    width?: number;
    height?: number;
    depth?: number;
    attributes?: Record<string, string>;
  };
  variants?: Array<{
    externalId: string;
    sku?: string;
    price: number;
    promotionalPrice?: number;
    stock: number;
    weight?: number;
    width?: number;
    height?: number;
    depth?: number;
    attributes?: Record<string, string>;
  }>;
  category?: UpsertIntegrationCategoryInput;
  imageUrl?: string;
}

export interface UpsertIntegrationProductResult {
  action: 'created' | 'updated';
  productId: string;
  categoryLinked: boolean;
  categoryCreated: boolean;
}

type UpsertIntegrationCategoryResult = {
  id: string;
  created: boolean;
  duplicateCategoryIds: string[];
};

type CategoryLookupRow = {
  id: string;
  external_id: string | null;
  slug: string;
  name: string;
};

type SupabaseCatalogClient =
  | NonNullable<ReturnType<typeof createOptionalAdminClient>>
  | NonNullable<Awaited<ReturnType<typeof createOptionalClient>>>
  | NonNullable<ReturnType<typeof createOptionalPublicServerClient>>;

type ProductRow = {
  id: string;
  store_id: string;
  external_provider: string | null;
  external_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  requires_shipping: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProductVariantRow = {
  id: string;
  store_id: string;
  product_id: string;
  external_id: string | null;
  sku: string | null;
  price: number | string | null;
  promotional_price: number | string | null;
  stock: number | null;
  weight: number | string | null;
  width: number | string | null;
  height: number | string | null;
  depth: number | string | null;
  attributes_json: Record<string, string> | null;
  created_at: string | null;
};

type ProductImageRow = {
  id: string;
  store_id: string;
  product_id: string;
  variant_id: string | null;
  url: string;
  position: number | null;
  alt: string | null;
};

type CategoryRow = {
  id: string;
  store_id: string;
  parent_id: string | null;
  external_id: string | null;
  name: string;
  slug: string;
  position: number | null;
};

type ProductCategoryRow = {
  product_id: string;
  category_id: string;
};

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const catalogImageMap: Record<string, string> = {
  'asset:mavic_3_pro': mavic3ProImage,
  'asset:mini_4_pro': mini4ProImage,
  'asset:drone_accessories': droneAccessoriesImage,
};

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveCatalogImageUrl(url: string): string {
  return catalogImageMap[url] ?? url;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    parentId: row.parent_id ?? undefined,
    externalId: row.external_id ?? undefined,
    name: row.name,
    slug: row.slug,
    position: row.position ?? 0,
  };
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    externalId: row.external_id ?? undefined,
    sku: row.sku ?? undefined,
    price: toNumber(row.price) ?? 0,
    promotionalPrice: toNumber(row.promotional_price),
    stock: row.stock ?? 0,
    weight: toNumber(row.weight),
    width: toNumber(row.width),
    height: toNumber(row.height),
    depth: toNumber(row.depth),
    attributes: row.attributes_json ?? {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
  };
}

function mapImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    variantId: row.variant_id ?? undefined,
    url: resolveCatalogImageUrl(row.url),
    position: row.position ?? 0,
    alt: row.alt ?? undefined,
  };
}

function mapProduct(
  row: ProductRow,
  variants: ProductVariant[],
  images: ProductImage[],
  categories: Category[]
): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    externalProvider: row.external_provider ?? undefined,
    externalId: row.external_id ?? undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    status: row.status as ProductStatus,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    requiresShipping: row.requires_shipping ?? true,
    variants,
    images,
    categories,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function getQueryErrorDetails(error: RepositoryError | null) {
  return {
    code: error?.code ?? 'unknown',
    details: toCompactLogText(error?.details),
    hint: toCompactLogText(error?.hint),
    message: error?.message ?? 'query-error',
  };
}

function toCompactLogText(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').slice(0, 220);
}

function toSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'produto';
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getCanonicalCategorySlugs(categoryName: string) {
  const slug = toSlug(categoryName);
  const aliasesBySlug: Record<string, string[]> = {
    drone: ['drones'],
    drones: ['drones'],
    peca: ['pecas'],
    pecas: ['pecas'],
    parte: ['pecas'],
    partes: ['pecas'],
    componente: ['pecas'],
    componentes: ['pecas'],
    helice: ['pecas'],
    helices: ['pecas'],
    acessorio: ['acessorios'],
    acessorios: ['acessorios'],
    bateria: ['baterias'],
    baterias: ['baterias'],
    kit: ['kits-e-combos'],
    kits: ['kits-e-combos'],
    combo: ['kits-e-combos'],
    combos: ['kits-e-combos'],
    'kit-combo': ['kits-e-combos'],
    'kits-combos': ['kits-e-combos'],
    'kits-e-combos': ['kits-e-combos'],
  };

  const singularOrPlural =
    slug.endsWith('s') && slug.length > 3 ? slug.slice(0, -1) : `${slug}s`;

  return uniqueStrings([
    slug,
    ...(aliasesBySlug[slug] ?? []),
    ...(aliasesBySlug[singularOrPlural] ?? []),
  ]);
}

function getPreferredCategoryMatch(
  rows: CategoryLookupRow[],
  candidateSlugs: string[]
) {
  for (const slug of candidateSlugs) {
    const match = rows.find((row) => row.slug === slug);

    if (match) {
      return match;
    }
  }

  return undefined;
}

async function getCatalogReadClients(
  options: { adminOnly?: boolean } = {}
): Promise<SupabaseCatalogClient[]> {
  const adminClient = createOptionalAdminClient();
  const authenticatedClient = options.adminOnly
    ? await createOptionalClient()
    : null;

  return options.adminOnly
    ? [authenticatedClient, adminClient].filter(
        (client): client is SupabaseCatalogClient => Boolean(client)
      )
    : [createOptionalPublicServerClient(), adminClient].filter(
        (client): client is SupabaseCatalogClient => Boolean(client)
      );
}

async function mapSupabaseProductsWithRelations(
  supabase: SupabaseCatalogClient,
  storeId: string,
  productRows: ProductRow[]
): Promise<{ data: Product[] | null; error: RepositoryError | null }> {
  const productIds = productRows.map((product) => product.id);

  if (productIds.length === 0) {
    return { data: [], error: null };
  }

  const [
    { data: variantRows, error: variantsError },
    { data: imageRows, error: imagesError },
    { data: productCategoryRows, error: productCategoriesError },
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select('*')
      .eq('store_id', storeId)
      .in('product_id', productIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('product_images')
      .select('*')
      .eq('store_id', storeId)
      .in('product_id', productIds)
      .order('position', { ascending: true }),
    supabase
      .from('product_categories')
      .select('product_id, category_id')
      .in('product_id', productIds),
  ]);

  if (
    variantsError ||
    imagesError ||
    productCategoriesError ||
    !variantRows ||
    !imageRows ||
    !productCategoryRows
  ) {
    return {
      data: null,
      error: variantsError ?? imagesError ?? productCategoriesError ?? null,
    };
  }

  const categoryIds = Array.from(
    new Set(
      (productCategoryRows as ProductCategoryRow[]).map((row) => row.category_id)
    )
  );

  let categoryRows: CategoryRow[] = [];

  if (categoryIds.length > 0) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .in('id', categoryIds)
      .order('position', { ascending: true });

    if (error || !data) {
      return { data: null, error };
    }

    categoryRows = data as CategoryRow[];
  }

  const categoriesById = new Map(
    categoryRows.map((row) => [row.id, mapCategory(row)])
  );
  const variantsByProductId = new Map<string, ProductVariant[]>();
  const imagesByProductId = new Map<string, ProductImage[]>();
  const categoryIdsByProductId = new Map<string, Set<string>>();

  (variantRows as ProductVariantRow[]).forEach((row) => {
    const variants = variantsByProductId.get(row.product_id) ?? [];
    variants.push(mapVariant(row));
    variantsByProductId.set(row.product_id, variants);
  });

  (imageRows as ProductImageRow[]).forEach((row) => {
    const images = imagesByProductId.get(row.product_id) ?? [];
    images.push(mapImage(row));
    imagesByProductId.set(row.product_id, images);
  });

  (productCategoryRows as ProductCategoryRow[]).forEach((row) => {
    const categoryIdsForProduct =
      categoryIdsByProductId.get(row.product_id) ?? new Set<string>();
    categoryIdsForProduct.add(row.category_id);
    categoryIdsByProductId.set(row.product_id, categoryIdsForProduct);
  });

  const products = productRows.map((productRow) => {
    const categories = Array.from(categoryIdsByProductId.get(productRow.id) ?? [])
      .map((categoryId) => categoriesById.get(categoryId))
      .filter((category): category is Category => Boolean(category))
      .sort((left, right) => left.position - right.position);

    return mapProduct(
      productRow,
      variantsByProductId.get(productRow.id) ?? [],
      imagesByProductId.get(productRow.id) ?? [],
      categories
    );
  });

  return { data: products, error: null };
}

async function fetchSupabaseProducts(
  storeId: string,
  options: { adminOnly?: boolean; includeInactive?: boolean } = {}
): Promise<Product[] | null> {
  const clients = await getCatalogReadClients(options);

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return null;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    let productsQuery = supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId);

    if (!options.includeInactive) {
      productsQuery = productsQuery.eq('status', 'active');
    }

    const { data: productRows, error: productsError } =
      await productsQuery.order('created_at', { ascending: true });

    if (productsError || !productRows) {
      lastError = productsError;
      continue;
    }

    const productsResult = await mapSupabaseProductsWithRelations(
      supabase,
      storeId,
      productRows as ProductRow[]
    );

    if (!productsResult.data) {
      lastError = productsResult.error;
      continue;
    }

    logDevOnce('catalog.repository', 'using supabase data', {
      products: productsResult.data.length,
    });

    return productsResult.data;
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'products-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return null;
}

async function fetchSupabaseProductsByIds(
  storeId: string,
  productIds: string[],
  options: { limit?: number; includeInactive?: boolean } = {}
): Promise<Product[] | undefined> {
  const uniqueProductIds = Array.from(new Set(productIds));

  if (uniqueProductIds.length === 0) {
    return [];
  }

  const clients = await getCatalogReadClients();

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return undefined;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    let productsQuery = supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .in('id', uniqueProductIds);

    if (!options.includeInactive) {
      productsQuery = productsQuery.eq('status', 'active');
    }

    productsQuery = productsQuery.order('created_at', { ascending: true });

    if (options.limit) {
      productsQuery = productsQuery.limit(options.limit);
    }

    const { data: productRows, error: productsError } = await productsQuery;

    if (productsError || !productRows) {
      lastError = productsError;
      continue;
    }

    const productsResult = await mapSupabaseProductsWithRelations(
      supabase,
      storeId,
      productRows as ProductRow[]
    );

    if (!productsResult.data) {
      lastError = productsResult.error;
      continue;
    }

    return productsResult.data;
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'products-by-ids-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return undefined;
}

async function fetchSupabaseProductById(
  storeId: string,
  productId: string,
  options: { includeInactive?: boolean } = {}
): Promise<Product | null | undefined> {
  const clients = await getCatalogReadClients();

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return undefined;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    let productQuery = supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', productId);

    if (!options.includeInactive) {
      productQuery = productQuery.eq('status', 'active');
    }

    const { data: productRow, error } = await productQuery.maybeSingle();

    if (error) {
      lastError = error;
      continue;
    }

    if (!productRow) {
      return null;
    }

    const productsResult = await mapSupabaseProductsWithRelations(
      supabase,
      storeId,
      [productRow as ProductRow]
    );

    if (!productsResult.data) {
      lastError = productsResult.error;
      continue;
    }

    return productsResult.data[0] ?? null;
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'product-by-id-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return undefined;
}

async function fetchSupabaseProductBySlug(
  storeId: string,
  slug: string
): Promise<Product | null | undefined> {
  const clients = await getCatalogReadClients();

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return undefined;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data: productRow, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      lastError = error;
      continue;
    }

    if (!productRow) {
      return null;
    }

    const productsResult = await mapSupabaseProductsWithRelations(
      supabase,
      storeId,
      [productRow as ProductRow]
    );

    if (!productsResult.data) {
      lastError = productsResult.error;
      continue;
    }

    return productsResult.data[0] ?? null;
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'product-by-slug-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return undefined;
}

async function fetchSupabaseProductsByCategorySlug(
  storeId: string,
  categorySlug: string
): Promise<Product[] | undefined> {
  const clients = await getCatalogReadClients();

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return undefined;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data: categoryRow, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', categorySlug)
      .maybeSingle();

    if (categoryError) {
      lastError = categoryError;
      continue;
    }

    if (!categoryRow) {
      return [];
    }

    const { data: productCategoryRows, error: productCategoriesError } =
      await supabase
        .from('product_categories')
        .select('product_id, category_id')
        .eq('category_id', (categoryRow as CategoryRow).id);

    if (productCategoriesError || !productCategoryRows) {
      lastError = productCategoriesError;
      continue;
    }

    const productIds = (productCategoryRows as ProductCategoryRow[]).map(
      (row) => row.product_id
    );
    const products = await fetchSupabaseProductsByIds(storeId, productIds);

    if (products !== undefined) {
      return products;
    }
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'products-by-category-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return undefined;
}

async function fetchSupabaseRelatedProducts(
  storeId: string,
  productSlug: string,
  limit: number
): Promise<ProductSummary[] | undefined> {
  const clients = await getCatalogReadClients();

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return undefined;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data: productRow, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('slug', productSlug)
      .maybeSingle();

    if (productError) {
      lastError = productError;
      continue;
    }

    if (!productRow) {
      return [];
    }

    const { data: productCategoryRows, error: productCategoriesError } =
      await supabase
        .from('product_categories')
        .select('product_id, category_id')
        .eq('product_id', (productRow as ProductRow).id);

    if (productCategoriesError || !productCategoryRows) {
      lastError = productCategoriesError;
      continue;
    }

    const categoryIds = Array.from(
      new Set(
        (productCategoryRows as ProductCategoryRow[]).map(
          (row) => row.category_id
        )
      )
    );

    if (categoryIds.length === 0) {
      return [];
    }

    const { data: relatedProductCategoryRows, error: relatedError } =
      await supabase
        .from('product_categories')
        .select('product_id, category_id')
        .in('category_id', categoryIds);

    if (relatedError || !relatedProductCategoryRows) {
      lastError = relatedError;
      continue;
    }

    const relatedProductIds = Array.from(
      new Set(
        (relatedProductCategoryRows as ProductCategoryRow[])
          .map((row) => row.product_id)
          .filter((productId) => productId !== (productRow as ProductRow).id)
      )
    );
    const relatedProducts = await fetchSupabaseProductsByIds(
      storeId,
      relatedProductIds,
      { limit }
    );

    if (relatedProducts !== undefined) {
      return relatedProducts.map(toProductSummary);
    }
  }

  logDevOnce('catalog.repository', 'using mock data', {
    reason: 'related-products-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return undefined;
}

async function fetchSupabaseCategories(storeId: string): Promise<Category[] | null> {
  const clients = [
    createOptionalAdminClient(),
    createOptionalPublicServerClient(),
  ].filter((client): client is SupabaseCatalogClient => Boolean(client));

  if (clients.length === 0) {
    logDevOnce('catalog.repository', 'using mock categories', {
      reason: 'supabase-env-missing',
    });
    return null;
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .order('position', { ascending: true });

    if (error || !data) {
      lastError = error;
      continue;
    }

    const categories = (data as CategoryRow[]).map(mapCategory);

    logDevOnce('catalog.repository', 'using supabase categories', {
      categories: categories.length,
    });

    return categories;
  }

  logDevOnce('catalog.repository', 'using mock categories', {
    reason: 'categories-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return null;
}

async function createUniqueProductSlug(
  supabase: SupabaseCatalogClient,
  input: {
    storeId: string;
    baseSlug: string;
    externalProvider: string;
    externalId: string;
    currentProductId?: string;
  }
) {
  const normalizedBase = toSlug(input.baseSlug);
  const candidates = [
    normalizedBase,
    `${normalizedBase}-${toSlug(input.externalProvider)}-${toSlug(input.externalId)}`,
  ];

  for (let index = 2; index <= 20; index += 1) {
    candidates.push(`${normalizedBase}-${index}`);
  }

  for (const candidate of candidates) {
    const query = supabase
      .from('products')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('slug', candidate)
      .limit(1);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error('Unable to validate product slug.');
    }

    if (!data || data.id === input.currentProductId) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}

async function createUniqueCategorySlug(
  supabase: SupabaseCatalogClient,
  storeId: string,
  categoryName: string,
  currentCategoryId?: string
) {
  const normalizedBase = toSlug(categoryName);
  const candidates = [normalizedBase];

  for (let index = 2; index <= 20; index += 1) {
    candidates.push(`${normalizedBase}-${index}`);
  }

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('store_id', storeId)
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error('Unable to validate category slug.');
    }

    if (!data || data.id === currentCategoryId) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}

async function upsertIntegrationCategory(
  supabase: SupabaseCatalogClient,
  storeId: string,
  category: UpsertIntegrationCategoryInput
): Promise<UpsertIntegrationCategoryResult> {
  const candidateSlugs = getCanonicalCategorySlugs(category.name);
  const { data: existingBySlugRows, error: existingBySlugError } = await supabase
    .from('categories')
    .select('id, external_id, slug, name')
    .eq('store_id', storeId)
    .in('slug', candidateSlugs);

  if (existingBySlugError) {
    throw new Error('Unable to query integration category by slug.');
  }

  const existingBySlug = getPreferredCategoryMatch(
    (existingBySlugRows as CategoryLookupRow[] | null) ?? [],
    candidateSlugs
  );

  const { data: existing, error: existingError } = await supabase
    .from('categories')
    .select('id, external_id, slug, name')
    .eq('store_id', storeId)
    .eq('external_id', category.externalId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error('Unable to query integration category.');
  }

  const hasExternalIdConflict =
    Boolean(existingBySlug?.external_id) &&
    existingBySlug?.external_id !== category.externalId;

  if (hasExternalIdConflict && existing) {
    const { error } = await supabase
      .from('categories')
      .update({ name: category.name })
      .eq('store_id', storeId)
      .eq('id', existing.id);

    if (error) {
      throw new Error('Unable to update integration category.');
    }

    return {
      id: existing.id as string,
      created: false,
      duplicateCategoryIds: [],
    };
  }

  if (existingBySlug && !hasExternalIdConflict) {
    const shouldAttachExternalId =
      !existingBySlug.external_id || existingBySlug.external_id === category.externalId;

    if (shouldAttachExternalId) {
      const { error } = await supabase
        .from('categories')
        .update({ external_id: category.externalId })
        .eq('store_id', storeId)
        .eq('id', existingBySlug.id);

      if (error) {
        throw new Error('Unable to update integration category by slug.');
      }
    }

    return {
      id: existingBySlug.id as string,
      created: false,
      duplicateCategoryIds:
        existing && existing.id !== existingBySlug.id ? [existing.id as string] : [],
    };
  }

  if (existing) {
    const { error } = await supabase
      .from('categories')
      .update({ name: category.name })
      .eq('store_id', storeId)
      .eq('id', existing.id);

    if (error) {
      throw new Error('Unable to update integration category.');
    }

    return {
      id: existing.id as string,
      created: false,
      duplicateCategoryIds: [],
    };
  }

  const uniqueSlug = await createUniqueCategorySlug(supabase, storeId, category.name);
  const { data, error } = await supabase
    .from('categories')
    .insert({
      store_id: storeId,
      external_id: category.externalId,
      name: category.name,
      slug: uniqueSlug,
      position: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Unable to create integration category.');
  }

  return {
    id: data.id as string,
    created: true,
    duplicateCategoryIds: [],
  };
}

export async function listProductsFromRepository(storeId: string) {
  return (await listProductsWithSourceFromRepository(storeId)).data;
}

export async function listStorefrontProductsFromRepository(
  storeId: string
): Promise<Product[]> {
  const supabaseProducts = await fetchSupabaseProducts(storeId);

  if (supabaseProducts) {
    return supabaseProducts;
  }

  return mockProducts;
}

export async function listProductsWithSourceFromRepository(
  storeId: string
): Promise<
  CatalogRepositoryResult<ProductSummary[]>
> {
  const supabaseProducts = await fetchSupabaseProducts(storeId);

  if (supabaseProducts) {
    return {
      data: supabaseProducts.map(toProductSummary),
      source: 'supabase',
    };
  }

  return {
    data: getMockProductSummaries(),
    source: 'mock',
  };
}

export async function listAdminProductsWithSourceFromRepository(
  storeId: string
): Promise<
  CatalogRepositoryResult<ProductSummary[]>
> {
  const supabaseProducts = await fetchSupabaseProducts(storeId, {
    adminOnly: true,
    includeInactive: true,
  });

  if (supabaseProducts) {
    return {
      data: supabaseProducts.map(toProductSummary),
      source: 'supabase',
    };
  }

  return {
    data: mockProducts.map(toProductSummary),
    source: 'mock',
  };
}

export async function listCategoriesFromRepository(
  storeId: string
): Promise<Category[]> {
  return (await listCategoriesWithSourceFromRepository(storeId)).data;
}

export async function listCategoriesWithSourceFromRepository(
  storeId: string
): Promise<
  CatalogRepositoryResult<Category[]>
> {
  const supabaseCategories = await fetchSupabaseCategories(storeId);

  if (supabaseCategories) {
    return {
      data: supabaseCategories,
      source: 'supabase',
    };
  }

  return {
    data: mockCategories,
    source: 'mock',
  };
}

export async function getProductBySlugFromRepository(
  storeId: string,
  slug: string
): Promise<Product | null> {
  const supabaseProduct = await fetchSupabaseProductBySlug(storeId, slug);

  if (supabaseProduct !== undefined) {
    return supabaseProduct;
  }

  return getMockProductBySlug(slug) ?? null;
}

export async function getProductByIdFromRepository(
  storeId: string,
  id: string
): Promise<Product | null> {
  const supabaseProduct = await fetchSupabaseProductById(storeId, id);

  if (supabaseProduct !== undefined) {
    return supabaseProduct;
  }

  return mockProducts.find((product) => product.id === id) ?? null;
}

export async function getCategoryBySlugFromRepository(
  storeId: string,
  slug: string
): Promise<Category | null> {
  const supabaseCategories = await fetchSupabaseCategories(storeId);

  if (supabaseCategories) {
    return supabaseCategories.find((category) => category.slug === slug) ?? null;
  }

  return getMockCategoryBySlug(slug) ?? null;
}

export async function listCategoryProductsFromRepository(
  storeId: string,
  categorySlug: string
): Promise<Product[]> {
  const supabaseProducts = await fetchSupabaseProductsByCategorySlug(
    storeId,
    categorySlug
  );

  if (supabaseProducts !== undefined) {
    return supabaseProducts;
  }

  return getMockProductsByCategory(categorySlug);
}

export async function listProductsByCategoryFromRepository(
  storeId: string,
  categorySlug: string
) {
  const products = await listCategoryProductsFromRepository(storeId, categorySlug);
  return products.map(toProductSummary);
}

export async function listRelatedProductsFromRepository(
  storeId: string,
  productSlug: string,
  limit = 3
) {
  const supabaseProducts = await fetchSupabaseRelatedProducts(
    storeId,
    productSlug,
    limit
  );

  if (supabaseProducts !== undefined) {
    return supabaseProducts;
  }

  return getMockRelatedProducts(productSlug, limit).map(toProductSummary);
}

export async function updateProductStatusInRepository(
  input: UpdateProductStatusInput
): Promise<CatalogMutationResult> {
  const clients = [
    await createOptionalClient(),
    createOptionalAdminClient(),
  ].filter((client): client is SupabaseCatalogClient => Boolean(client));

  if (clients.length === 0) {
    return {
      ok: false,
      persisted: false,
      source: 'mock',
      error: 'supabase-admin-not-configured',
    };
  }

  for (const supabase of clients) {
    const { data, error } = await supabase
      .from('products')
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq('store_id', input.storeId)
      .eq('id', input.productId)
      .select('id')
      .maybeSingle();

    if (!error && data) {
      return {
        ok: true,
        persisted: true,
        source: 'supabase',
      };
    }
  }

  return {
    ok: false,
    persisted: false,
    source: 'supabase',
    error: 'product-status-update-failed',
  };
}

export async function updateProductStockInRepository(
  input: UpdateProductStockInput
): Promise<CatalogMutationResult> {
  const clients = [
    await createOptionalClient(),
    createOptionalAdminClient(),
  ].filter((client): client is SupabaseCatalogClient => Boolean(client));

  if (clients.length === 0) {
    return {
      ok: false,
      persisted: false,
      source: 'mock',
      error: 'supabase-admin-not-configured',
    };
  }

  for (const supabase of clients) {
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('product_id', input.productId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (variantError || !variant) {
      continue;
    }

    const { data, error } = await supabase
      .from('product_variants')
      .update({ stock: input.stock })
      .eq('store_id', input.storeId)
      .eq('id', variant.id)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      continue;
    }

    await supabase
      .from('products')
      .update({ updated_at: new Date().toISOString() })
      .eq('store_id', input.storeId)
      .eq('id', input.productId);

    return {
      ok: true,
      persisted: true,
      source: 'supabase',
    };
  }

  return {
    ok: false,
    persisted: false,
    source: 'supabase',
    error: 'product-stock-update-failed',
  };
}

export async function upsertIntegrationProductInRepository(
  input: UpsertIntegrationProductInput
): Promise<UpsertIntegrationProductResult> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const now = new Date().toISOString();
  const { data: existingProduct, error: existingProductError } = await supabase
    .from('products')
    .select('id, slug')
    .eq('store_id', input.storeId)
    .eq('external_provider', input.externalProvider)
    .eq('external_id', input.externalId)
    .limit(1)
    .maybeSingle();

  if (existingProductError) {
    throw new Error('Unable to query integration product.');
  }

  const slug = await createUniqueProductSlug(supabase, {
    storeId: input.storeId,
    baseSlug: input.slug,
    externalProvider: input.externalProvider,
    externalId: input.externalId,
    currentProductId: existingProduct?.id as string | undefined,
  });

  const productPayload = {
    store_id: input.storeId,
    external_provider: input.externalProvider,
    external_id: input.externalId,
    name: input.name,
    slug,
    description: input.description ?? null,
    brand: input.brand ?? null,
    status: input.status,
    requires_shipping: input.requiresShipping ?? true,
    updated_at: now,
  };

  let productId: string;
  let action: UpsertIntegrationProductResult['action'];

  if (existingProduct) {
    const { data, error } = await supabase
      .from('products')
      .update(productPayload)
      .eq('store_id', input.storeId)
      .eq('id', existingProduct.id)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Unable to update integration product.');
    }

    productId = data.id as string;
    action = 'updated';
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productPayload,
        created_at: now,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Unable to create integration product.');
    }

    productId = data.id as string;
    action = 'created';
  }

  const variants = input.variants?.length ? input.variants : [input.variant];
  const variantExternalIds = variants.map((variant) => variant.externalId);

  for (const variant of variants) {
    const { data: existingVariant, error: existingVariantError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('product_id', productId)
      .eq('external_id', variant.externalId)
      .limit(1)
      .maybeSingle();

    if (existingVariantError) {
      throw new Error('Unable to query integration product variant.');
    }

    const variantPayload = {
      store_id: input.storeId,
      product_id: productId,
      external_id: variant.externalId,
      sku: variant.sku ?? null,
      price: variant.price,
      promotional_price: variant.promotionalPrice ?? null,
      stock: variant.stock,
      weight: variant.weight ?? null,
      width: variant.width ?? null,
      height: variant.height ?? null,
      depth: variant.depth ?? null,
      attributes_json: variant.attributes ?? {},
    };

    if (existingVariant) {
      const { error } = await supabase
        .from('product_variants')
        .update(variantPayload)
        .eq('store_id', input.storeId)
        .eq('id', existingVariant.id);

      if (error) {
        throw new Error('Unable to update integration product variant.');
      }
    } else {
      const { error } = await supabase.from('product_variants').insert({
        ...variantPayload,
        created_at: now,
      });

      if (error) {
        throw new Error('Unable to create integration product variant.');
      }
    }
  }

  if (variantExternalIds.length > 0) {
    const { data: syncedVariantRows, error: syncedVariantsError } = await supabase
      .from('product_variants')
      .select('id, external_id')
      .eq('store_id', input.storeId)
      .eq('product_id', productId)
      .not('external_id', 'is', null);

    if (syncedVariantsError) {
      throw new Error('Unable to query stale integration product variants.');
    }

    const staleVariantIds = (syncedVariantRows as Array<{
      id: string;
      external_id: string | null;
    }> | null ?? [])
      .filter((row) => row.external_id && !variantExternalIds.includes(row.external_id))
      .map((row) => row.id);

    if (staleVariantIds.length > 0) {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('store_id', input.storeId)
        .eq('product_id', productId)
        .in('id', staleVariantIds);

      if (error) {
        throw new Error('Unable to remove stale integration product variants.');
      }
    }
  } else {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('store_id', input.storeId)
      .eq('product_id', productId)
      .not('external_id', 'is', null);

    if (error) {
      throw new Error('Unable to remove stale integration product variants.');
    }
  }

  if (input.imageUrl) {
    const { data: existingImage, error: existingImageError } = await supabase
      .from('product_images')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('product_id', productId)
      .eq('url', input.imageUrl)
      .limit(1)
      .maybeSingle();

    if (existingImageError) {
      throw new Error('Unable to query integration product image.');
    }

    if (!existingImage) {
      const { error } = await supabase.from('product_images').insert({
        store_id: input.storeId,
        product_id: productId,
        url: input.imageUrl,
        position: 0,
        alt: input.name,
      });

      if (error) {
        throw new Error('Unable to create integration product image.');
      }
    }
  }

  let categoryLinked = false;
  let categoryCreated = false;

  if (input.category) {
    const category = await upsertIntegrationCategory(
      supabase,
      input.storeId,
      input.category
    );

    const { error } = await supabase.from('product_categories').upsert({
      product_id: productId,
      category_id: category.id,
    });

    if (error) {
      throw new Error('Unable to link integration product category.');
    }

    if (category.duplicateCategoryIds.length > 0) {
      const { error: unlinkError } = await supabase
        .from('product_categories')
        .delete()
        .eq('product_id', productId)
        .in('category_id', category.duplicateCategoryIds);

      if (unlinkError) {
        throw new Error('Unable to unlink duplicate integration category.');
      }

      for (const duplicateCategoryId of category.duplicateCategoryIds) {
        const { data: remainingLinks, error: linksError } = await supabase
          .from('product_categories')
          .select('product_id')
          .eq('category_id', duplicateCategoryId)
          .limit(1);

        if (linksError) {
          throw new Error('Unable to inspect duplicate integration category.');
        }

        if (remainingLinks.length === 0) {
          const { error: deleteCategoryError } = await supabase
            .from('categories')
            .delete()
            .eq('store_id', input.storeId)
            .eq('id', duplicateCategoryId)
            .eq('external_id', input.category.externalId);

          if (deleteCategoryError) {
            throw new Error('Unable to delete duplicate integration category.');
          }
        }
      }
    }

    categoryLinked = true;
    categoryCreated = category.created;
  }

  return {
    action,
    productId,
    categoryLinked,
    categoryCreated,
  };
}
