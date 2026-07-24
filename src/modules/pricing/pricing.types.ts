export type CustomerType = 'pf' | 'pj';
export type PromotionPolicy = 'best_price' | 'stack' | 'promotion_only';
export type PriceSource =
  | 'catalog'
  | 'variant_override'
  | 'automatic_discount';

export interface PriceList {
  id: string;
  storeId: string;
  name: string;
  code: string;
  customerType: CustomerType;
  status: 'active' | 'inactive';
  currency: string;
  priority: number;
  isDefault: boolean;
  automaticDiscountEnabled: boolean;
  automaticDiscountPercentage: number;
  promotionPolicy: PromotionPolicy;
  externalProvider?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantPrice {
  id: string;
  storeId: string;
  variantId: string;
  priceListId: string;
  price: number;
  promotionalPrice?: number;
  source: 'manual' | 'integration';
  externalProvider?: string;
  externalId?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVariantPriceSummary {
  variantId: string;
  priceListId: string;
  priceListName: string;
  customerType: CustomerType;
  price: number;
  promotionalPrice?: number;
  effectivePrice: number;
  source: 'manual' | 'integration';
  updatedAt: string;
}

export interface ResolvedVariantPrice {
  customerType: CustomerType;
  priceListId?: string;
  priceListName?: string;
  unitPrice: number;
  baseUnitPrice: number;
  discountPercentage: number;
  productDiscountAmount: number;
  priceSource: PriceSource;
  usedFallback: boolean;
}

export interface CheckoutPricingItem {
  productId: string;
  variantId: string;
  storeId: string;
  sku?: string;
  name: string;
  quantity: number;
  baseUnitPrice: number;
  baseTotal: number;
  unitPrice: number;
  total: number;
  discountPercentage: number;
  productDiscountTotal: number;
  priceSource: PriceSource;
  priceListId?: string;
  priceListName?: string;
  customerType: CustomerType;
  usedFallbackPrice: boolean;
}

export interface CheckoutPricingResult {
  customerType: CustomerType;
  priceListId?: string;
  priceListName?: string;
  items: CheckoutPricingItem[];
  catalogSubtotal: number;
  subtotal: number;
  productSavingsTotal: number;
  shippingTotal: number;
  discountTotal: number;
  pricingFingerprint: string;
  total: number;
}
