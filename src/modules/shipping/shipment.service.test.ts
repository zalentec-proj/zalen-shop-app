import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getShippingOrigin: vi.fn(),
  getReusableRates: vi.fn(),
  insertQuotes: vi.fn(),
  listShippingMethods: vi.fn(),
  calculateSuperFreteRates: vi.fn(),
  hasActiveSuperFreteMethod: vi.fn(),
  getProductById: vi.fn(),
}));

vi.mock('@/modules/catalog/product.service', () => ({
  getProductById: mocks.getProductById,
}));

vi.mock('./shipment.repository', () => ({
  getShippingOriginFromRepository: mocks.getShippingOrigin,
  getReusableShippingQuoteRatesFromRepository: mocks.getReusableRates,
  getShipmentsByOrderIdFromRepository: vi.fn(),
  insertShippingQuotesInRepository: mocks.insertQuotes,
  listShippingMethodsFromRepository: mocks.listShippingMethods,
  listShipmentsByOrderIdsFromRepository: vi.fn(),
  updateShippingMethodInRepository: vi.fn(),
  upsertShippingOriginInRepository: vi.fn(),
  upsertManualShipmentInRepository: vi.fn(),
  getShippingQuoteFromRepository: vi.fn(),
}));

vi.mock('./providers/superfrete', () => ({
  calculateSuperFreteRates: mocks.calculateSuperFreteRates,
  hasActiveSuperFreteMethod: mocks.hasActiveSuperFreteMethod,
}));

import { quoteShipping } from './shipment.service';

const origin = {
  id: 'origin-1',
  storeId: 'store-1',
  senderName: 'Brasil Drones',
  postalCode: '85801210',
  street: 'Rua Teste',
  number: '1',
  district: 'Centro',
  city: 'Cascavel',
  state: 'PR',
  country: 'BR',
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const externalMethod = {
  id: 'superfrete-method',
  storeId: 'store-1',
  kind: 'external' as const,
  providerKey: 'superfrete',
  serviceCode: 'superfrete-quote',
  name: 'SuperFrete',
  status: 'active' as const,
  sortOrder: 1,
  price: 0,
  settings: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const nativeMethod = {
  id: 'fixed-method',
  storeId: 'store-1',
  kind: 'fixed' as const,
  serviceCode: 'fixed-standard',
  name: 'Entrega Brasil Drones',
  status: 'active' as const,
  sortOrder: 2,
  price: 49.9,
  minDeliveryDays: 3,
  maxDeliveryDays: 7,
  settings: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const input = {
  storeId: 'store-1',
  subtotal: 51.8,
  destinationPostalCode: '01310-100',
  items: [
    {
      productId: 'product-1',
      variantId: 'variant-1',
      quantity: 1,
    },
  ],
};

describe('shipping quote fallback', () => {
  beforeEach(() => {
    mocks.getShippingOrigin.mockResolvedValue(origin);
    mocks.getReusableRates.mockResolvedValue([]);
    mocks.listShippingMethods.mockResolvedValue([externalMethod, nativeMethod]);
    mocks.hasActiveSuperFreteMethod.mockReturnValue(true);
    mocks.insertQuotes.mockImplementation(async ({ rates }) => rates);
    mocks.getProductById.mockResolvedValue({
      requiresShipping: true,
      freeShipping: false,
    });
  });

  it('prefers SuperFrete rates when the carrier responds', async () => {
    mocks.calculateSuperFreteRates.mockResolvedValue([
      {
        methodId: externalMethod.id,
        kind: 'external',
        providerKey: 'superfrete',
        serviceCode: '1',
        serviceName: 'PAC',
        price: 18.5,
      },
    ]);

    await expect(quoteShipping(input)).resolves.toMatchObject([
      {
        methodId: externalMethod.id,
        serviceName: 'PAC',
      },
    ]);
  });

  it.each([
    ['returns no available services', () => Promise.resolve([])],
    ['fails to quote', () => Promise.reject(new Error('superfrete_quote_failed'))],
  ])('uses an active native method when SuperFrete %s', async (_scenario, quote) => {
    mocks.calculateSuperFreteRates.mockImplementation(quote);

    await expect(quoteShipping(input)).resolves.toMatchObject([
      {
        methodId: nativeMethod.id,
        kind: 'fixed',
        serviceName: 'Entrega Brasil Drones',
        price: 49.9,
      },
    ]);
  });

  it('preserves the external error when no native method can serve checkout', async () => {
    mocks.listShippingMethods.mockResolvedValue([externalMethod]);
    mocks.calculateSuperFreteRates.mockRejectedValue(
      new Error('superfrete_quote_failed')
    );

    await expect(quoteShipping(input)).rejects.toThrow(
      'superfrete_quote_failed'
    );
  });

  it('keeps carrier and delivery data but charges zero when every shippable item has free shipping', async () => {
    mocks.getProductById.mockResolvedValue({
      requiresShipping: true,
      freeShipping: true,
    });
    mocks.calculateSuperFreteRates.mockResolvedValue([
      {
        methodId: externalMethod.id,
        kind: 'external',
        providerKey: 'superfrete',
        serviceCode: '1',
        serviceName: 'PAC',
        carrierName: 'Correios',
        price: 18.5,
        deliveryMinDays: 5,
      },
    ]);

    await expect(quoteShipping(input)).resolves.toMatchObject([
      {
        methodId: externalMethod.id,
        serviceName: 'PAC',
        carrierName: 'Correios',
        price: 0,
        deliveryMinDays: 5,
        rawPayload: {
          productFreeShipping: true,
          originalPrice: 18.5,
        },
      },
    ]);
  });

  it('does not grant free shipping to a mixed cart', async () => {
    mocks.getProductById.mockImplementation(async (_storeId, productId) => ({
      requiresShipping: true,
      freeShipping: productId === 'product-1',
    }));
    mocks.calculateSuperFreteRates.mockResolvedValue([
      {
        methodId: externalMethod.id,
        kind: 'external',
        providerKey: 'superfrete',
        serviceCode: '1',
        serviceName: 'PAC',
        price: 18.5,
      },
    ]);

    await expect(
      quoteShipping({
        ...input,
        items: [
          ...input.items,
          {
            productId: 'product-2',
            variantId: 'variant-2',
            quantity: 1,
          },
        ],
      })
    ).resolves.toMatchObject([{ price: 18.5 }]);
  });

  it('partitions the quote cache when product free-shipping eligibility changes', async () => {
    mocks.calculateSuperFreteRates.mockResolvedValue([
      {
        methodId: externalMethod.id,
        kind: 'external',
        providerKey: 'superfrete',
        serviceCode: '1',
        serviceName: 'PAC',
        price: 18.5,
      },
    ]);

    await quoteShipping(input);
    const paidCacheKey = mocks.getReusableRates.mock.calls[0][0].cacheKey;

    mocks.getProductById.mockResolvedValue({
      requiresShipping: true,
      freeShipping: true,
    });
    await quoteShipping(input);
    const freeCacheKey = mocks.getReusableRates.mock.calls[1][0].cacheKey;

    expect(freeCacheKey).not.toBe(paidCacheKey);
  });

  it('partitions the quote cache when the pricing policy changes', async () => {
    mocks.calculateSuperFreteRates.mockResolvedValue([
      {
        methodId: externalMethod.id,
        kind: 'external',
        providerKey: 'superfrete',
        serviceCode: '1',
        serviceName: 'PAC',
        price: 18.5,
      },
    ]);

    await quoteShipping({
      ...input,
      pricingFingerprint: 'pj-discount-10',
    });
    const firstCacheKey = mocks.getReusableRates.mock.calls[0][0].cacheKey;

    await quoteShipping({
      ...input,
      pricingFingerprint: 'pj-discount-15',
    });
    const secondCacheKey = mocks.getReusableRates.mock.calls[1][0].cacheKey;

    expect(secondCacheKey).not.toBe(firstCacheKey);
  });
});
