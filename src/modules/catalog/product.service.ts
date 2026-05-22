/**
 * Serviço de catálogo.
 * Abstrai a fonte de dados (mock → Supabase → Bling).
 * O storefront nunca chama Bling diretamente — sempre passa por aqui.
 */

import { Category, Product, ProductSummary } from './product.types';
import {
  getMockCategoryBySlug,
  getMockProductBySlug,
  getMockProductSummaries,
  mockProducts,
  mockCategories,
  getMockProductsByCategory,
  getMockRelatedProducts,
  toProductSummary,
} from './product.mock';

/**
 * Lista todos os produtos resumidos.
 * Futuramente: buscar do Supabase com filtros, paginação e cache.
 */
export async function listProducts(): Promise<ProductSummary[]> {
  // TODO: substituir por query Supabase quando disponível
  return getMockProductSummaries();
}

/**
 * Lista categorias do catálogo.
 */
export async function listCategories(): Promise<Category[]> {
  return mockCategories;
}

/**
 * Busca produto completo por slug.
 * Futuramente: buscar do Supabase com variantes e imagens.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  // TODO: substituir por query Supabase quando disponível
  return getMockProductBySlug(slug) ?? null;
}

/**
 * Busca produto completo por ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  // TODO: substituir por query Supabase quando disponível
  return mockProducts.find((p) => p.id === id) ?? null;
}

/**
 * Busca categoria por slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return getMockCategoryBySlug(slug) ?? null;
}

/**
 * Lista produtos completos por categoria.
 */
export async function listCategoryProducts(categorySlug: string): Promise<Product[]> {
  return getMockProductsByCategory(categorySlug);
}

/**
 * Lista produtos resumidos por categoria.
 */
export async function listProductsByCategory(
  categorySlug: string
): Promise<ProductSummary[]> {
  // TODO: substituir por query Supabase com join product_categories
  const all = getMockProductSummaries();
  if (!categorySlug) return all;
  return all.filter((p) =>
    p.categories.some((category) => category.slug === categorySlug)
  );
}

/**
 * Lista produtos relacionados com base na categoria principal.
 */
export async function listRelatedProducts(
  productSlug: string,
  limit = 3
): Promise<ProductSummary[]> {
  return getMockRelatedProducts(productSlug, limit).map(toProductSummary);
}
