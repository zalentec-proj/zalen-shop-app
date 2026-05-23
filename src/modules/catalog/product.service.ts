/**
 * Serviço de catálogo.
 * Abstrai a fonte de dados (mock → Supabase → Bling).
 * O storefront nunca chama Bling diretamente — sempre passa por aqui.
 */

import { Category, Product, ProductSummary } from './product.types';
import {
  getCategoryBySlugFromRepository,
  getProductByIdFromRepository,
  getProductBySlugFromRepository,
  listCategoriesFromRepository,
  listCategoryProductsFromRepository,
  listProductsByCategoryFromRepository,
  listProductsFromRepository,
  listRelatedProductsFromRepository,
} from './product.repository';

/**
 * Lista todos os produtos resumidos.
 * Futuramente: buscar do Supabase com filtros, paginação e cache.
 */
export async function listProducts(): Promise<ProductSummary[]> {
  return listProductsFromRepository();
}

/**
 * Lista categorias do catálogo.
 */
export async function listCategories(): Promise<Category[]> {
  return listCategoriesFromRepository();
}

/**
 * Busca produto completo por slug.
 * Futuramente: buscar do Supabase com variantes e imagens.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return getProductBySlugFromRepository(slug);
}

/**
 * Busca produto completo por ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  return getProductByIdFromRepository(id);
}

/**
 * Busca categoria por slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return getCategoryBySlugFromRepository(slug);
}

/**
 * Lista produtos completos por categoria.
 */
export async function listCategoryProducts(categorySlug: string): Promise<Product[]> {
  return listCategoryProductsFromRepository(categorySlug);
}

/**
 * Lista produtos resumidos por categoria.
 */
export async function listProductsByCategory(
  categorySlug: string
): Promise<ProductSummary[]> {
  if (!categorySlug) {
    return listProductsFromRepository();
  }

  return listProductsByCategoryFromRepository(categorySlug);
}

/**
 * Lista produtos relacionados com base na categoria principal.
 */
export async function listRelatedProducts(
  productSlug: string,
  limit = 3
): Promise<ProductSummary[]> {
  return listRelatedProductsFromRepository(productSlug, limit);
}
