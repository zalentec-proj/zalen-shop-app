/**
 * Tipos do módulo de catálogo.
 * Fonte de verdade para produtos, variantes e categorias.
 */

export type ProductStatus = 'active' | 'inactive' | 'draft';

export interface ProductVariant {
  id: string;
  storeId: string;
  productId: string;
  externalId?: string;
  sku?: string;
  price: number;
  promotionalPrice?: number;
  stock: number;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  attributes: Record<string, string>;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  storeId: string;
  productId: string;
  variantId?: string;
  url: string;
  position: number;
  alt?: string;
}

export interface Category {
  id: string;
  storeId: string;
  parentId?: string;
  externalId?: string;
  name: string;
  slug: string;
  position: number;
}

export interface Product {
  id: string;
  storeId: string;
  externalProvider?: string;
  externalId?: string;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  status: ProductStatus;
  seoTitle?: string;
  seoDescription?: string;
  requiresShipping: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  categories: Category[];
  /** Campos de apresentação — virão do ERP/Supabase futuramente */
  specs?: { label: string; value: string }[];
  rating?: number;
  reviewsCount?: number;
  isBestSeller?: boolean;
  isNew?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** Produto simplificado para listagens */
export interface ProductSummary {
  id: string;
  variantId?: string;
  sku?: string;
  externalProvider?: string;
  externalId?: string;
  name: string;
  slug: string;
  brand?: string;
  status: ProductStatus;
  price: number;
  promotionalPrice?: number;
  stock: number;
  imageUrl?: string;
  categories: ProductCategorySummary[];
  rating?: number;
  reviewsCount?: number;
  isBestSeller?: boolean;
  isNew?: boolean;
}
