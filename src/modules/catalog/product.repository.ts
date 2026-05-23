import 'server-only';

import {
  droneAccessoriesImage,
  mavic3ProImage,
  mini4ProImage,
} from '@/assets/images';
import {
  createOptionalAdminClient,
  isSupabaseAdminConfigured,
} from '@/lib/supabase/server';
import type {
  Category,
  Product,
  ProductImage,
  ProductStatus,
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

const BRASIL_DRONES_STORE_ID = '00000000-0000-0000-0000-000000000001';

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

async function fetchSupabaseProducts(): Promise<Product[] | null> {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', BRASIL_DRONES_STORE_ID)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (productsError || !productRows) {
    return null;
  }

  const productIds = productRows.map((product) => product.id);

  if (productIds.length === 0) {
    return [];
  }

  const [
    { data: variantRows, error: variantsError },
    { data: imageRows, error: imagesError },
    { data: categoryRows, error: categoriesError },
    { data: productCategoryRows, error: productCategoriesError },
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('product_images')
      .select('*')
      .in('product_id', productIds)
      .order('position', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('store_id', BRASIL_DRONES_STORE_ID)
      .order('position', { ascending: true }),
    supabase
      .from('product_categories')
      .select('product_id, category_id')
      .in('product_id', productIds),
  ]);

  if (
    variantsError ||
    imagesError ||
    categoriesError ||
    productCategoriesError ||
    !variantRows ||
    !imageRows ||
    !categoryRows ||
    !productCategoryRows
  ) {
    return null;
  }

  const categoriesById = new Map(
    (categoryRows as CategoryRow[]).map((row) => [row.id, mapCategory(row)])
  );
  const variantsByProductId = new Map<string, ProductVariant[]>();
  const imagesByProductId = new Map<string, ProductImage[]>();
  const categoryIdsByProductId = new Map<string, string[]>();

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
    const categoryIds = categoryIdsByProductId.get(row.product_id) ?? [];
    categoryIds.push(row.category_id);
    categoryIdsByProductId.set(row.product_id, categoryIds);
  });

  return (productRows as ProductRow[]).map((productRow) => {
    const categories = (categoryIdsByProductId.get(productRow.id) ?? [])
      .map((categoryId) => categoriesById.get(categoryId))
      .filter((category): category is Category => Boolean(category));

    return mapProduct(
      productRow,
      variantsByProductId.get(productRow.id) ?? [],
      imagesByProductId.get(productRow.id) ?? [],
      categories
    );
  });
}

async function fetchSupabaseCategories(): Promise<Category[] | null> {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', BRASIL_DRONES_STORE_ID)
    .order('position', { ascending: true });

  if (error || !data) {
    return null;
  }

  return (data as CategoryRow[]).map(mapCategory);
}

export async function listProductsFromRepository() {
  const supabaseProducts = await fetchSupabaseProducts();

  if (supabaseProducts) {
    return supabaseProducts.map(toProductSummary);
  }

  return getMockProductSummaries();
}

export async function listCategoriesFromRepository(): Promise<Category[]> {
  return (await fetchSupabaseCategories()) ?? mockCategories;
}

export async function getProductBySlugFromRepository(
  slug: string
): Promise<Product | null> {
  const supabaseProducts = await fetchSupabaseProducts();

  if (supabaseProducts) {
    return supabaseProducts.find((product) => product.slug === slug) ?? null;
  }

  return getMockProductBySlug(slug) ?? null;
}

export async function getProductByIdFromRepository(
  id: string
): Promise<Product | null> {
  const supabaseProducts = await fetchSupabaseProducts();

  if (supabaseProducts) {
    return supabaseProducts.find((product) => product.id === id) ?? null;
  }

  return mockProducts.find((product) => product.id === id) ?? null;
}

export async function getCategoryBySlugFromRepository(
  slug: string
): Promise<Category | null> {
  const supabaseCategories = await fetchSupabaseCategories();

  if (supabaseCategories) {
    return supabaseCategories.find((category) => category.slug === slug) ?? null;
  }

  return getMockCategoryBySlug(slug) ?? null;
}

export async function listCategoryProductsFromRepository(
  categorySlug: string
): Promise<Product[]> {
  const supabaseProducts = await fetchSupabaseProducts();

  if (supabaseProducts) {
    return supabaseProducts.filter((product) =>
      product.categories.some((category) => category.slug === categorySlug)
    );
  }

  return getMockProductsByCategory(categorySlug);
}

export async function listProductsByCategoryFromRepository(
  categorySlug: string
) {
  const products = await listCategoryProductsFromRepository(categorySlug);
  return products.map(toProductSummary);
}

export async function listRelatedProductsFromRepository(
  productSlug: string,
  limit = 3
) {
  const supabaseProducts = await fetchSupabaseProducts();

  if (supabaseProducts) {
    const product = supabaseProducts.find((item) => item.slug === productSlug);

    if (!product) {
      return [];
    }

    const categorySlugs = new Set(
      product.categories.map((category) => category.slug)
    );

    return supabaseProducts
      .filter(
        (candidate) =>
          candidate.slug !== product.slug &&
          candidate.categories.some((category) =>
            categorySlugs.has(category.slug)
          )
      )
      .slice(0, limit)
      .map(toProductSummary);
  }

  return getMockRelatedProducts(productSlug, limit).map(toProductSummary);
}
