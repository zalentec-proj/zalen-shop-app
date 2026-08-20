import 'server-only';

import { createHash } from 'node:crypto';
import { getProductById } from '@/modules/catalog/product.service';
import {
  getShippingOriginFromRepository,
  getShippingQuoteFromRepository,
  getReusableShippingQuoteRatesFromRepository,
  getShipmentsByOrderIdFromRepository,
  insertShippingQuotesInRepository,
  listShippingMethodsFromRepository,
  listShipmentsByOrderIdsFromRepository,
  updateShippingMethodInRepository,
  upsertShippingOriginInRepository,
  upsertManualShipmentInRepository,
} from './shipment.repository';
import {
  calculateSuperFreteRates,
  hasActiveSuperFreteMethod,
} from './providers/superfrete';
import { SUPERFRETE_PROVIDER_KEY } from '@/modules/integrations/superfrete/superfrete.config';
import type {
  Shipment,
  ShippingMethod,
  ShippingOrigin,
  ShippingQuote,
  ShippingQuoteInput,
  ShippingQuoteItem,
  ShippingRate,
  UpdateShippingMethodInput,
  UpsertManualShipmentInput,
  UpsertShippingOriginInput,
} from './shipment.types';

export type {
  Shipment,
  ShipmentStatus,
  ShippingMethod,
  ShippingMethodKind,
  ShippingOrigin,
  ShippingProviderAdapter,
  ShippingQuote,
  ShippingQuoteInput,
  ShippingRate,
} from './shipment.types';

const SHIPPING_QUOTE_TTL_MINUTES = 30;
const SHIPPING_QUOTE_CACHE_MINUTES = 5;

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeItems(items: ShippingQuoteItem[]) {
  return items
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }))
    .sort((first, second) =>
      `${first.productId}:${first.variantId}`.localeCompare(
        `${second.productId}:${second.variantId}`
      )
    );
}

export function getShippingItemsHash(items: ShippingQuoteItem[]) {
  return createHash('sha256')
    .update(JSON.stringify(normalizeItems(items)))
    .digest('hex');
}

function getShippingQuoteCacheKey(
  input: ShippingQuoteInput,
  productFreeShipping: boolean
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        destinationPostalCode: onlyDigits(input.destinationPostalCode),
        itemsHash: getShippingItemsHash(input.items),
        subtotal: roundCurrency(input.subtotal),
        pricingFingerprint: input.pricingFingerprint,
        productFreeShipping,
      })
    )
    .digest('hex');
}

async function areAllShippableItemsFreeShipping(input: ShippingQuoteInput) {
  const productIds = Array.from(
    new Set(input.items.map((item) => item.productId))
  );
  const products = await Promise.all(
    productIds.map((productId) => getProductById(input.storeId, productId))
  );

  if (products.some((product) => !product)) {
    throw new Error('shipping_product_not_found');
  }

  const shippableProducts = products.filter(
    (product): product is NonNullable<typeof product> =>
      Boolean(product?.requiresShipping)
  );

  return (
    shippableProducts.length > 0 &&
    shippableProducts.every((product) => product.freeShipping)
  );
}

function applyProductFreeShipping(
  rates: ShippingRate[],
  productFreeShipping: boolean
) {
  if (!productFreeShipping) {
    return rates;
  }

  return rates.map((rate) => ({
    ...rate,
    price: 0,
    rawPayload: {
      ...(rate.rawPayload ?? {}),
      productFreeShipping: true,
      originalPrice: roundCurrency(rate.price),
    },
  }));
}

function getShippingQuoteCacheCutoff() {
  return new Date(
    Date.now() - SHIPPING_QUOTE_CACHE_MINUTES * 60 * 1000
  ).toISOString();
}

function getQuoteExpiration() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + SHIPPING_QUOTE_TTL_MINUTES);
  return expiresAt.toISOString();
}

function hasActiveOrigin(origin: ShippingOrigin | null) {
  return Boolean(origin && origin.status === 'active');
}

function getNativeRate(input: {
  method: ShippingMethod;
  subtotal: number;
  origin: ShippingOrigin | null;
}): ShippingRate | null {
  if (input.method.status !== 'active') {
    return null;
  }

  if (input.method.kind === 'external') {
    return null;
  }

  if (input.method.kind === 'pickup' && !hasActiveOrigin(input.origin)) {
    return null;
  }

  const isFree =
    typeof input.method.freeOverSubtotal === 'number' &&
    input.subtotal >= input.method.freeOverSubtotal;
  const price = input.method.kind === 'pickup' || isFree ? 0 : input.method.price;

  return {
    methodId: input.method.id,
    kind: input.method.kind,
    providerKey: input.method.providerKey,
    serviceCode: input.method.serviceCode,
    carrierName:
      input.method.kind === 'pickup' ? input.origin?.senderName : undefined,
    serviceName: input.method.name,
    description: input.method.description,
    price: roundCurrency(price),
    deliveryMinDays: input.method.minDeliveryDays,
    deliveryMaxDays: input.method.maxDeliveryDays,
  };
}

function calculateNativeRatesFromConfiguration(input: {
  quote: ShippingQuoteInput;
  origin: ShippingOrigin | null;
  methods: ShippingMethod[];
}) {
  return input.methods
    .map((method) =>
      getNativeRate({
        method,
        subtotal: input.quote.subtotal,
        origin: input.origin,
      })
    )
    .filter((rate): rate is ShippingRate => Boolean(rate));
}

async function getShippingCalculationConfiguration(storeId: string) {
  const [origin, methods] = await Promise.all([
    getShippingOriginFromRepository(storeId),
    listShippingMethodsFromRepository(storeId),
  ]);

  return {
    origin,
    methods,
  };
}

async function calculateNativeRates(input: ShippingQuoteInput) {
  const configuration = await getShippingCalculationConfiguration(input.storeId);

  return calculateNativeRatesFromConfiguration({
    quote: input,
    ...configuration,
  });
}

async function calculateShippingRates(
  input: ShippingQuoteInput,
  options: { requiredProviderKey?: string } = {}
) {
  const configuration = await getShippingCalculationConfiguration(input.storeId);
  const hasSuperFrete = hasActiveSuperFreteMethod(configuration.methods);
  const nativeRates = calculateNativeRatesFromConfiguration({
    quote: input,
    ...configuration,
  });

  if (!hasSuperFrete) {
    return nativeRates;
  }

  try {
    const superFreteRates = await calculateSuperFreteRates({
      quote: input,
      ...configuration,
    });

    if (superFreteRates.length > 0) {
      return superFreteRates;
    }
  } catch (error) {
    if (options.requiredProviderKey === SUPERFRETE_PROVIDER_KEY) {
      throw error;
    }

    if (nativeRates.length === 0) {
      throw error;
    }
  }

  // The external quote is preferred, but an active native option must keep
  // checkout available when the carrier has no coverage or is unavailable.
  return nativeRates;
}

async function getCachedShippingRates(
  input: ShippingQuoteInput,
  cacheKey: string
) {
  return getReusableShippingQuoteRatesFromRepository({
    storeId: input.storeId,
    cacheKey,
    minimumCreatedAt: getShippingQuoteCacheCutoff(),
  });
}

async function quoteAndPersistShippingRates(input: {
  quote: ShippingQuoteInput;
  calculate: (quote: ShippingQuoteInput) => Promise<ShippingRate[]>;
  productFreeShipping: boolean;
  bypassCache?: boolean;
}) {
  const destinationPostalCode = onlyDigits(input.quote.destinationPostalCode);
  const normalizedQuote = {
    ...input.quote,
    destinationPostalCode,
  };
  const cacheKey = getShippingQuoteCacheKey(
    normalizedQuote,
    input.productFreeShipping
  );
  const cachedRates = input.bypassCache
    ? []
    : await getCachedShippingRates(normalizedQuote, cacheKey);

  if (cachedRates.length > 0) {
    return cachedRates;
  }

  const rates = applyProductFreeShipping(
    await input.calculate(normalizedQuote),
    input.productFreeShipping
  );

  if (rates.length === 0) {
    return [];
  }

  return insertShippingQuotesInRepository({
    storeId: normalizedQuote.storeId,
    destinationPostalCode,
    itemsHash: getShippingItemsHash(normalizedQuote.items),
    cacheKey,
    pricingFingerprint: normalizedQuote.pricingFingerprint,
    expiresAt: getQuoteExpiration(),
    rates,
  });
}

export async function getShippingConfiguration(storeId: string): Promise<{
  origin: ShippingOrigin | null;
  methods: ShippingMethod[];
}> {
  const [origin, methods] = await Promise.all([
    getShippingOriginFromRepository(storeId),
    listShippingMethodsFromRepository(storeId),
  ]);

  return {
    origin,
    methods,
  };
}

export async function upsertShippingOrigin(
  input: UpsertShippingOriginInput
): Promise<ShippingOrigin | null> {
  return upsertShippingOriginInRepository(input);
}

export async function updateShippingMethod(
  input: UpdateShippingMethodInput
): Promise<ShippingMethod | null> {
  return updateShippingMethodInRepository(input);
}

export async function quoteNativeShipping(
  input: ShippingQuoteInput,
  options: { bypassCache?: boolean } = {}
): Promise<ShippingRate[]> {
  const productFreeShipping = await areAllShippableItemsFreeShipping(input);

  return quoteAndPersistShippingRates({
    quote: input,
    calculate: calculateNativeRates,
    productFreeShipping,
    bypassCache: options.bypassCache,
  });
}

export async function quoteShipping(
  input: ShippingQuoteInput,
  options: { bypassCache?: boolean } = {}
): Promise<ShippingRate[]> {
  const productFreeShipping = await areAllShippableItemsFreeShipping(input);

  return quoteAndPersistShippingRates({
    quote: input,
    calculate: calculateShippingRates,
    productFreeShipping,
    bypassCache: options.bypassCache,
  });
}

export async function validateShippingQuoteForCheckout(input: {
  storeId: string;
  quoteId: string;
  subtotal: number;
  pricingFingerprint?: string;
  destinationPostalCode: string;
  items: ShippingQuoteItem[];
}): Promise<ShippingQuote> {
  const quote = await getShippingQuoteFromRepository({
    storeId: input.storeId,
    quoteId: input.quoteId,
  });

  if (!quote) {
    throw new Error('shipping_quote_not_found');
  }

  if (new Date(quote.expiresAt).getTime() <= Date.now()) {
    throw new Error('shipping_quote_expired');
  }

  if (quote.itemsHash !== getShippingItemsHash(input.items)) {
    throw new Error('shipping_quote_items_changed');
  }

  if (quote.destinationPostalCode !== onlyDigits(input.destinationPostalCode)) {
    throw new Error('shipping_quote_address_changed');
  }

  if (
    input.pricingFingerprint &&
    quote.rawPayload.pricingFingerprint !== input.pricingFingerprint
  ) {
    throw new Error('shipping_quote_pricing_changed');
  }

  const currentQuoteInput = {
    storeId: input.storeId,
    subtotal: input.subtotal,
    pricingFingerprint: input.pricingFingerprint,
    destinationPostalCode: input.destinationPostalCode,
    items: input.items,
  };
  const productFreeShipping = await areAllShippableItemsFreeShipping(
    currentQuoteInput
  );
  const currentRates = applyProductFreeShipping(
    await calculateShippingRates(currentQuoteInput, {
      requiredProviderKey: quote.providerKey,
    }),
    productFreeShipping
  );
  const matchingRate = currentRates.find(
    (rate) =>
      rate.methodId === quote.methodId &&
      rate.serviceCode === quote.serviceCode &&
      rate.providerKey === quote.providerKey
  );

  if (!matchingRate || roundCurrency(matchingRate.price) !== quote.price) {
    throw new Error('shipping_quote_stale');
  }

  return quote;
}

export const validateShippingQuote = validateShippingQuoteForCheckout;

export async function listShipmentsByOrderIds(input: {
  storeId: string;
  orderIds: string[];
}): Promise<Shipment[]> {
  return listShipmentsByOrderIdsFromRepository(input);
}

export async function getShipmentsByOrderId(input: {
  storeId: string;
  orderId: string;
}): Promise<Shipment[]> {
  return getShipmentsByOrderIdFromRepository(input);
}

export async function upsertManualShipment(
  input: UpsertManualShipmentInput
): Promise<Shipment | null> {
  return upsertManualShipmentInRepository(input);
}
