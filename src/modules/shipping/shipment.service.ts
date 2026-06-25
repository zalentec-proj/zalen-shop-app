import 'server-only';

import { createHash } from 'node:crypto';
import {
  getShippingOriginFromRepository,
  getShippingQuoteFromRepository,
  getShipmentsByOrderIdFromRepository,
  insertShippingQuotesInRepository,
  listShippingMethodsFromRepository,
  listShipmentsByOrderIdsFromRepository,
  updateShippingMethodInRepository,
  upsertShippingOriginInRepository,
  upsertManualShipmentInRepository,
} from './shipment.repository';
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

async function calculateNativeRates(input: ShippingQuoteInput) {
  const [origin, methods] = await Promise.all([
    getShippingOriginFromRepository(input.storeId),
    listShippingMethodsFromRepository(input.storeId),
  ]);

  return methods
    .map((method) =>
      getNativeRate({
        method,
        subtotal: input.subtotal,
        origin,
      })
    )
    .filter((rate): rate is ShippingRate => Boolean(rate));
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
  input: ShippingQuoteInput
): Promise<ShippingRate[]> {
  const destinationPostalCode = onlyDigits(input.destinationPostalCode);
  const rates = await calculateNativeRates({
    ...input,
    destinationPostalCode,
  });

  if (rates.length === 0) {
    return [];
  }

  return insertShippingQuotesInRepository({
    storeId: input.storeId,
    destinationPostalCode,
    itemsHash: getShippingItemsHash(input.items),
    expiresAt: getQuoteExpiration(),
    rates,
  });
}

export async function validateShippingQuoteForCheckout(input: {
  storeId: string;
  quoteId: string;
  subtotal: number;
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

  const currentRates = await calculateNativeRates({
    storeId: input.storeId,
    subtotal: input.subtotal,
    destinationPostalCode: input.destinationPostalCode,
    items: input.items,
  });
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
