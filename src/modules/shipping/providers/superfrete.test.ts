import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
  quoteSuperFreteShipping: vi.fn(),
}));

vi.mock('@/modules/catalog/product.service', () => ({
  getProductById: mocks.getProductById,
}));

vi.mock('@/modules/integrations/superfrete/superfrete.client', () => ({
  quoteSuperFreteShipping: mocks.quoteSuperFreteShipping,
}));

vi.mock('@/modules/integrations/superfrete/superfrete.config', () => ({
  getSuperFreteQuoteConfig: () => ({ services: '1' }),
  SUPERFRETE_PROVIDER_KEY: 'superfrete',
}));

import { calculateSuperFreteRates } from './superfrete';

const method = {
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

describe('SuperFrete pricing', () => {
  beforeEach(() => {
    mocks.getProductById.mockResolvedValue({
      requiresShipping: true,
      variants: [
        {
          id: 'variant-1',
          height: 10,
          width: 12,
          depth: 16,
          weight: 0.15,
        },
      ],
    });
  });

  it('charges the final provider price without subtracting the informational discount twice', async () => {
    mocks.quoteSuperFreteShipping.mockResolvedValue([
      {
        id: 1,
        name: 'PAC',
        price: '20.00',
        discount: '10.00',
        currency: 'BRL',
        delivery_time: 5,
        company: {
          id: 1,
          name: 'Correios',
        },
      },
    ]);

    await expect(
      calculateSuperFreteRates({
        quote: {
          storeId: 'store-1',
          subtotal: 449,
          destinationPostalCode: '01310100',
          items: [
            {
              productId: 'product-1',
              variantId: 'variant-1',
              quantity: 1,
            },
          ],
        },
        origin,
        methods: [method],
      })
    ).resolves.toMatchObject([
      {
        price: 20,
        rawPayload: {
          superfrete: {
            price: 20,
            discount: 10,
          },
        },
      },
    ]);
  });

  it('classifies provider dimension errors without exposing its raw response', async () => {
    mocks.quoteSuperFreteShipping.mockResolvedValue([
      {
        has_error: true,
        error: 'A largura do pacote excede o limite aceito.',
      },
    ]);

    await expect(
      calculateSuperFreteRates({
        quote: {
          storeId: 'store-1',
          subtotal: 449,
          destinationPostalCode: '01310100',
          items: [{ productId: 'product-1', variantId: 'variant-1', quantity: 1 }],
        },
        origin,
        methods: [method],
      })
    ).rejects.toThrow('shipping_product_out_of_limits');
  });
});
