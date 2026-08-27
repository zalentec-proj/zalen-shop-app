/**
 * Serviço de catálogo.
 * Abstrai a fonte de dados (mock → Supabase → Bling).
 * O storefront nunca chama Bling diretamente — sempre passa por aqui.
 */

import type { Category, Product, ProductSummary } from './product.types';
import {
  getCategoryBySlugFromRepository,
  getProductByIdFromRepository,
  getProductBySlugFromRepository,
  listAdminProductsWithSourceFromRepository,
  listAdminProductsPageFromRepository,
  type AdminProductFilters,
  type CatalogDataSource,
  type CatalogMutationResult,
  type CatalogRepositoryResult,
  type UpdateProductStatusInput,
  type UpdateProductStockInput,
  listCategoriesFromRepository,
  listCategoriesWithSourceFromRepository,
  listCategoryProductsFromRepository,
  listProductsByCategoryFromRepository,
  listProductsFromRepository,
  listProductsWithSourceFromRepository,
  listRelatedProductsFromRepository,
  listStorefrontProductsFromRepository,
  updateProductStatusInRepository,
  updateProductStockInRepository,
} from './product.repository';

/**
 * Lista todos os produtos resumidos.
 * Futuramente: buscar do Supabase com filtros, paginação e cache.
 */
export async function listProducts(storeId: string): Promise<ProductSummary[]> {
  return listProductsFromRepository(storeId);
}

export async function listStorefrontProducts(
  storeId: string
): Promise<Product[]> {
  return listStorefrontProductsFromRepository(storeId);
}

export async function listProductsWithSource(
  storeId: string
): Promise<CatalogRepositoryResult<ProductSummary[]>> {
  return listProductsWithSourceFromRepository(storeId);
}

export async function listAdminProductsWithSource(
  storeId: string
): Promise<CatalogRepositoryResult<ProductSummary[]>> {
  return listAdminProductsWithSourceFromRepository(storeId);
}

export async function listAdminProductsPage(
  storeId: string,
  filters: AdminProductFilters
) {
  return listAdminProductsPageFromRepository(storeId, filters);
}

/**
 * Lista categorias do catálogo.
 */
export async function listCategories(storeId: string): Promise<Category[]> {
  return listCategoriesFromRepository(storeId);
}

export async function listCategoriesWithSource(
  storeId: string
): Promise<CatalogRepositoryResult<Category[]>> {
  return listCategoriesWithSourceFromRepository(storeId);
}

export type { CatalogDataSource };

/**
 * Busca produto completo por slug.
 * Futuramente: buscar do Supabase com variantes e imagens.
 */
export async function getProductBySlug(
  storeId: string,
  slug: string
): Promise<Product | null> {
  return getProductBySlugFromRepository(storeId, slug);
}

/**
 * Busca produto completo por ID.
 */
export async function getProductById(
  storeId: string,
  id: string
): Promise<Product | null> {
  return getProductByIdFromRepository(storeId, id);
}

/**
 * Busca categoria por slug.
 */
export async function getCategoryBySlug(
  storeId: string,
  slug: string
): Promise<Category | null> {
  return getCategoryBySlugFromRepository(storeId, slug);
}

/**
 * Lista produtos completos por categoria.
 */
export async function listCategoryProducts(
  storeId: string,
  categorySlug: string
): Promise<Product[]> {
  return listCategoryProductsFromRepository(storeId, categorySlug);
}

/**
 * Lista produtos resumidos por categoria.
 */
export async function listProductsByCategory(
  storeId: string,
  categorySlug: string
): Promise<ProductSummary[]> {
  if (!categorySlug) {
    return listProductsFromRepository(storeId);
  }

  return listProductsByCategoryFromRepository(storeId, categorySlug);
}

/**
 * Lista produtos relacionados com base na categoria principal.
 */
export async function listRelatedProducts(
  storeId: string,
  productSlug: string,
  limit = 3
): Promise<ProductSummary[]> {
  return listRelatedProductsFromRepository(storeId, productSlug, limit);
}

export async function updateProductStatus(
  input: UpdateProductStatusInput
): Promise<CatalogMutationResult> {
  return updateProductStatusInRepository(input);
}

export async function updateProductStock(
  input: UpdateProductStockInput
): Promise<CatalogMutationResult> {
  return updateProductStockInRepository(input);
}
