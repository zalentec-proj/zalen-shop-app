export interface Product {
  id: string;
  catalogProductId?: string;
  variantId?: string;
  sku?: string;
  name: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  image: string;
  images?: string[];
  category: string;
  categorySlug?: string;
  categories?: ProductCategoryRef[];
  description: string;
  specs: {
    label: string;
    value: string;
  }[];
  isBestSeller?: boolean;
  isNew?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductCategoryRef {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface StorefrontCategory extends ProductCategoryRef {
  productCount: number;
  descendantSlugs?: string[];
}

export interface FilterState {
  /** Category slug selected in the storefront catalog. */
  category: string | null;
  minPrice: number;
  maxPrice: number;
}
