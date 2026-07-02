import 'server-only';

import { getProductById } from '@/modules/catalog/product.service';
import {
  getSuperFreteQuoteConfig,
  SUPERFRETE_PROVIDER_KEY,
} from '@/modules/integrations/superfrete/superfrete.config';
import { quoteSuperFreteShipping } from '@/modules/integrations/superfrete/superfrete.client';
import type {
  SuperFreteQuotePackage,
  SuperFreteQuoteResponseItem,
} from '@/modules/integrations/superfrete/superfrete.types';
import type {
  ShippingMethod,
  ShippingOrigin,
  ShippingQuoteInput,
  ShippingRate,
} from '../shipment.types';

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function toNumber(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDeliveryLabel(input: {
  min?: number;
  max?: number;
  fallback?: number;
}) {
  const min = input.min ?? input.fallback;
  const max = input.max ?? input.fallback ?? min;

  if (!min || !max) {
    return undefined;
  }

  if (min === max) {
    return `${min} dia(s) úteis`;
  }

  return `${min} a ${max} dias úteis`;
}

function sanitizePackage(packages: SuperFreteQuotePackage[] | undefined) {
  const firstPackage = packages?.[0];

  if (!firstPackage) {
    return undefined;
  }

  return {
    format: firstPackage.format,
    price: toNumber(firstPackage.price),
    discount: toNumber(firstPackage.discount),
    insuranceValue: toNumber(firstPackage.insurance_value),
    weight: toNumber(firstPackage.weight),
    height: toNumber(firstPackage.dimensions?.height),
    width: toNumber(firstPackage.dimensions?.width),
    length: toNumber(firstPackage.dimensions?.length),
  };
}

function sanitizeQuote(item: SuperFreteQuoteResponseItem) {
  return {
    id: item.id,
    name: item.name,
    price: toNumber(item.price),
    discount: toNumber(item.discount),
    currency: item.currency,
    deliveryTime: item.delivery_time,
    deliveryRange: item.delivery_range,
    company: item.company
      ? {
          id: item.company.id,
          name: item.company.name,
          picture: item.company.picture,
        }
      : undefined,
    additionalServices: item.additional_services,
    package: sanitizePackage(item.packages),
  };
}

async function resolveProducts(input: ShippingQuoteInput) {
  const products = await Promise.all(
    input.items.map(async (item) => {
      const product = await getProductById(input.storeId, item.productId);

      if (!product) {
        throw new Error('shipping_product_not_found');
      }

      const variant = product.variants.find(
        (candidate) => candidate.id === item.variantId
      );

      if (!variant) {
        throw new Error('shipping_product_variant_not_found');
      }

      if (!product.requiresShipping) {
        return null;
      }

      const physicalData = {
        quantity: item.quantity,
        height: variant.height ?? 0,
        width: variant.width ?? 0,
        length: variant.depth ?? 0,
        weight: variant.weight ?? 0,
      };

      if (
        physicalData.quantity <= 0 ||
        physicalData.height <= 0 ||
        physicalData.width <= 0 ||
        physicalData.length <= 0 ||
        physicalData.weight <= 0
      ) {
        throw new Error('shipping_product_dimensions_missing');
      }

      return physicalData;
    })
  );

  return products.filter((product): product is NonNullable<typeof product> =>
    Boolean(product)
  );
}

export function hasActiveSuperFreteMethod(methods: ShippingMethod[]) {
  return methods.some(
    (method) =>
      method.kind === 'external' &&
      method.providerKey === SUPERFRETE_PROVIDER_KEY &&
      method.status === 'active'
  );
}

export async function calculateSuperFreteRates(input: {
  quote: ShippingQuoteInput;
  origin: ShippingOrigin | null;
  methods: ShippingMethod[];
}): Promise<ShippingRate[]> {
  const method = input.methods.find(
    (candidate) =>
      candidate.kind === 'external' &&
      candidate.providerKey === SUPERFRETE_PROVIDER_KEY &&
      candidate.status === 'active'
  );

  if (!method) {
    return [];
  }

  if (!input.origin || input.origin.status !== 'active') {
    throw new Error('shipping_origin_required');
  }

  const destinationPostalCode = onlyDigits(input.quote.destinationPostalCode);
  const originPostalCode = onlyDigits(input.origin.postalCode);

  if (destinationPostalCode.length !== 8 || originPostalCode.length !== 8) {
    throw new Error('shipping_postal_code_invalid');
  }

  const products = await resolveProducts(input.quote);

  if (products.length === 0) {
    return [];
  }

  const response = await quoteSuperFreteShipping({
    from: {
      postal_code: originPostalCode,
    },
    to: {
      postal_code: destinationPostalCode,
    },
    services: getSuperFreteQuoteConfig().services,
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: 0,
      use_insurance_value: false,
    },
    products,
  });

  const rates = response
    .filter((item) => !item.has_error)
    .map((item): ShippingRate | null => {
      const price = toNumber(item.price);
      const serviceCode = String(item.id ?? '').trim();
      const serviceName = item.name?.trim();

      if (!serviceCode || !serviceName || price < 0) {
        return null;
      }

      const deliveryMinDays = item.delivery_range?.min ?? item.delivery_time;
      const deliveryMaxDays = item.delivery_range?.max ?? item.delivery_time;
      const deliveryTimeLabel = getDeliveryLabel({
        min: deliveryMinDays,
        max: deliveryMaxDays,
        fallback: item.delivery_time,
      });
      const sanitized = sanitizeQuote(item);

      return {
        methodId: method.id,
        kind: 'external',
        providerKey: SUPERFRETE_PROVIDER_KEY,
        serviceCode,
        carrierName: item.company?.name,
        serviceName,
        description: item.company?.name
          ? `${item.company.name} - cotacao SuperFrete`
          : 'Cotacao SuperFrete',
        price: roundCurrency(price),
        deliveryMinDays,
        deliveryMaxDays,
        deliveryTimeLabel,
        rawPayload: {
          quoteOnly: true,
          provider: SUPERFRETE_PROVIDER_KEY,
          deliveryTimeLabel,
          package: sanitized.package,
          superfrete: sanitized,
        },
      };
    })
    .filter((rate): rate is ShippingRate => Boolean(rate));

  if (rates.length === 0) {
    throw new Error('superfrete_no_services');
  }

  return rates;
}
