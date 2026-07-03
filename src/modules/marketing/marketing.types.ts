import type { Order } from '@/modules/orders/order.types';

export const marketingProviderKeys = [
  'google_tag_manager',
  'ga4',
  'google_ads',
  'google_merchant_center',
  'meta_pixel',
  'meta_conversions_api',
] as const;

export type MarketingProviderKey = (typeof marketingProviderKeys)[number];

export type MarketingConsent = {
  analytics?: boolean;
  marketing?: boolean;
  adStorage?: boolean;
  adUserData?: boolean;
  adPersonalization?: boolean;
};

export type MarketingContext = {
  consent?: MarketingConsent;
  landingPage?: string;
  pageUrl?: string;
  referrer?: string;
  utm?: Record<string, string>;
  clickIds?: {
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    fbp?: string;
    fbc?: string;
  };
  capturedAt?: string;
};

export type MarketingItemPayload = {
  itemId: string;
  itemName: string;
  sku?: string;
  quantity: number;
  price: number;
};

export type MarketingEventPayload = {
  storeId: string;
  providerKey: MarketingProviderKey;
  eventName: string;
  eventId: string;
  occurredAt: string;
  source: 'browser' | 'server' | 'manual';
  pageUrl?: string;
  referrer?: string;
  currency?: string;
  value?: number;
  shipping?: number;
  orderId?: string;
  orderNumber?: string;
  items?: MarketingItemPayload[];
  marketingContext?: MarketingContext;
  consent?: MarketingConsent;
  hashedUserData?: {
    emailSha256?: string;
    phoneSha256?: string;
  };
};

export type StoreMarketingSettings = {
  google_tag_manager: {
    enabled: boolean;
    containerId?: string;
  };
  ga4: {
    enabled: boolean;
    measurementId?: string;
    debugMode?: boolean;
  };
  google_ads: {
    enabled: boolean;
    conversionId?: string;
    purchaseConversionLabel?: string;
    enhancedConversionsEnabled?: boolean;
  };
  google_merchant_center: {
    enabled: boolean;
    verificationToken?: string;
    defaultGoogleProductCategory?: string;
  };
  meta_pixel: {
    enabled: boolean;
    pixelId?: string;
  };
  meta_conversions_api: {
    enabled: boolean;
    testEventCode?: string;
    hasToken?: boolean;
  };
};

export type MarketingRuntimeConfig = {
  storeId: string;
  storeName: string;
  gtm?: StoreMarketingSettings['google_tag_manager'];
  ga4?: StoreMarketingSettings['ga4'];
  googleAds?: StoreMarketingSettings['google_ads'];
  merchantCenter?: StoreMarketingSettings['google_merchant_center'];
  metaPixel?: StoreMarketingSettings['meta_pixel'];
};

export type MarketingAdminEvent = {
  id: string;
  providerKey: MarketingProviderKey;
  eventName: string;
  eventId: string;
  source: string;
  status: string;
  orderNumber?: string;
  value?: number;
  currency?: string;
  occurredAt: string;
  processedAt?: string;
  errorMessage?: string;
};

export type MarketingAdminState = {
  settings: StoreMarketingSettings;
  recentEvents: MarketingAdminEvent[];
  encryptionReady: boolean;
};

export type PurchaseDispatchInput = {
  storeId: string;
  order: Order;
  pageUrl?: string;
  referrer?: string;
};
