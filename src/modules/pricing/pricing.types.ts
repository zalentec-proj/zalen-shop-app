export type CustomerType = 'pf' | 'pj';

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
  usedFallback: boolean;
}

export interface CheckoutPricingItem {
  productId: string;
  variantId: string;
  storeId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
}
