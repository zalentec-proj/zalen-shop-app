import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveCheckoutPricing: vi.fn(),
  upsertCheckoutCustomer: vi.fn(),
  saveOrderToRepository: vi.fn(),
}));

vi.mock('./order.repository', () => ({
  getOrderByIdFromRepository: vi.fn(),
  getOrderByIdForCustomerFromRepository: vi.fn(),
  listOrdersByCustomerIdFromRepository: vi.fn(),
  listMockOrdersFromRepository: vi.fn(),
  listOrdersFromRepository: vi.fn(),
  listOrdersWithSourceFromRepository: vi.fn(),
  saveOrderToRepository: mocks.saveOrderToRepository,
  updateOrderExternalErpStateInRepository: vi.fn(),
  updateOrderFulfillmentStateInRepository: vi.fn(),
}));

vi.mock('../customers/customer.service', () => ({
  upsertCheckoutCustomer: mocks.upsertCheckoutCustomer,
}));

vi.mock('../integrations/bling/orders/bling-order-send.service', () => ({
  tryAutoSendOrderToBling: vi.fn(),
}));

vi.mock('../pricing/pricing.service', () => ({
  getCustomerTypeFromDocument: () => 'pf',
  resolveCheckoutPricing: mocks.resolveCheckoutPricing,
}));

vi.mock('../shipping/shipment.service', () => ({
  validateShippingQuoteForCheckout: vi.fn(),
}));

import { createOrder } from './order.service';

describe('createOrder guest persistence', () => {
  beforeEach(() => {
    mocks.resolveCheckoutPricing.mockResolvedValue({
      customerType: 'pf',
      items: [
        {
          storeId: 'store-1',
          productId: 'product-1',
          variantId: 'variant-1',
          sku: 'SKU-1',
          name: 'Produto teste',
          quantity: 1,
          baseUnitPrice: 100,
          baseTotal: 100,
          unitPrice: 100,
          total: 100,
          discountPercentage: 0,
          productDiscountTotal: 0,
          priceSource: 'catalog',
          customerType: 'pf',
          usedFallbackPrice: false,
        },
      ],
      catalogSubtotal: 100,
      subtotal: 100,
      productSavingsTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      pricingFingerprint: 'pricing-1',
      total: 100,
    });
    mocks.saveOrderToRepository.mockImplementation(async (order) => order);
  });

  it('saves the immutable order snapshot without changing a customer profile', async () => {
    const order = await createOrder({
      storeId: 'store-1',
      persistCustomer: false,
      sendToErp: false,
      customer: {
        name: 'Cliente Convidado',
        email: 'cliente@example.com',
        phone: '11999999999',
        document: '52998224725',
      },
      items: [
        {
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 1,
        },
      ],
    });

    expect(mocks.upsertCheckoutCustomer).not.toHaveBeenCalled();
    expect(order.customerId).toBeUndefined();
    expect(order.customer?.email).toBe('cliente@example.com');
    expect(mocks.saveOrderToRepository).toHaveBeenCalledOnce();
  });
});
