/**
 * Serviço de catálogo.
 * Abstrai a fonte de dados (mock → Supabase → Bling).
 * O storefront nunca chama Bling diretamente — sempre passa por aqui.
 */

import { Product, ProductSummary } from './product.types';
import {
  getMockProductBySlug,
  getMockProductSummaries,
  mockProducts,
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
 * Lista produtos por categoria.
 */
export async function listProductsByCategory(
  categorySlug: string
): Promise<ProductSummary[]> {
  // TODO: substituir por query Supabase com join product_categories
  const all = getMockProductSummaries();
  if (!categorySlug) return all;
  return all.filter((p) =>
    p.categories.some(
      (c) => c.toLowerCase() === categorySlug.toLowerCase()
    )
  );
}
