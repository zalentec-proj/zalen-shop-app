import type { OrderListItem } from '@/modules/orders/order.types';

export const adminOrderFixture: OrderListItem = {
  id: '0d73995d-8810-4b78-b055-c262f5c1a384',
  storeId: 'b161aeff-b271-45cf-b6f9-9301db27931b',
  orderNumber: 'BD-TEST-1001', status: 'confirmed', paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled',
  subtotal: 100, shippingTotal: 15, discountTotal: 5, productDiscountTotal: 10, total: 110,
  externalErpSyncStatus: 'pending', createdAt: '2026-10-06T12:00:00Z',
  customer: { name: 'Comprador teste', email: 'teste@example.com', phone: '11999998888', document: '11144477735', customerType: 'pf',
    shippingAddress: { recipientName: 'Destinatário teste', street: 'Rua teste', number: '100', complement: 'Sala 2', district: 'Centro', city: 'São Paulo', state: 'SP', postalCode: '01001000', country: 'BR' },
  },
  items: [{ id: 'item-1', storeId: 'b161aeff-b271-45cf-b6f9-9301db27931b', orderId: '0d73995d-8810-4b78-b055-c262f5c1a384', productId: 'product-1', variantId: 'variant-1', sku: 'SKU-TEST-1', name: 'Produto teste', quantity: 1, baseUnitPrice: 110, unitPrice: 100, total: 100, discountPercentage: 10, productDiscountTotal: 10 }],
};
