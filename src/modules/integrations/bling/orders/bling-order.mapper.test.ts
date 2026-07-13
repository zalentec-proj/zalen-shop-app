import { describe, expect, it } from 'vitest';
import type { OrderListItem } from '@/modules/orders/order.types';
import {
  blingHomologationWarning,
  mapOrderToBlingDraft,
  summarizeBlingOrderDraft,
} from './bling-order.mapper';

const order = {
  id: '0d73995d-8810-4b78-b055-c262f5c1a384',
  storeId: 'b161aeff-b271-45cf-b6f9-9301db27931b',
  orderNumber: 'BD-TEST-1001',
  status: 'confirmed',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  subtotal: 100,
  shippingTotal: 15,
  discountTotal: 0,
  total: 115,
  externalErpSyncStatus: 'pending',
  customer: {
    name: 'Comprador de teste',
    email: 'comprador@example.com',
    document: '11144477735',
    customerType: 'pf',
    shippingAddress: {
      street: 'Rua de teste',
      number: '100',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
    },
  },
  items: [
    {
      id: 'item-1',
      storeId: 'b161aeff-b271-45cf-b6f9-9301db27931b',
      orderId: '0d73995d-8810-4b78-b055-c262f5c1a384',
      productId: 'product-1',
      variantId: 'variant-1',
      sku: 'SKU-TESTE-01',
      name: 'Produto de teste',
      quantity: 1,
      unitPrice: 100,
      total: 100,
    },
  ],
  createdAt: '2026-07-13T12:00:00.000Z',
} satisfies OrderListItem;

describe('mapOrderToBlingDraft', () => {
  it('marca um envio de homologação sem alterar o número rastreável da loja', () => {
    const draft = mapOrderToBlingDraft(order, { isHomologation: true });

    expect(draft.payload.numeroLoja).toBe(order.orderNumber);
    expect(draft.payload.observacoesInternas).toContain(blingHomologationWarning);
    expect(summarizeBlingOrderDraft(draft, { isHomologation: true })).toMatchObject({
      testMode: true,
      orderNumber: order.orderNumber,
    });
  });

  it('não adiciona aviso de homologação ao envio operacional', () => {
    const draft = mapOrderToBlingDraft(order);

    expect(draft.payload.observacoesInternas).not.toContain(blingHomologationWarning);
    expect(summarizeBlingOrderDraft(draft)).toMatchObject({ testMode: false });
  });
});
