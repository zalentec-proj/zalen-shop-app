import type { OrderListItem } from '@/modules/orders/order.types';
import type { BlingOrderDraft } from './bling-order.types';

export function mapOrderToBlingDraft(order: OrderListItem): BlingOrderDraft {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: {
      name: order.customer?.name ?? order.customerName,
      email: order.customer?.email ?? order.customerEmail,
      phone: order.customer?.phone,
      document: order.customer?.document,
    },
    shippingAddress: order.customer?.shippingAddress,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    totals: {
      subtotal: order.subtotal,
      shipping: order.shippingTotal,
      discount: order.discountTotal,
      total: order.total,
    },
  };
}

export function summarizeBlingOrderDraft(draft: BlingOrderDraft) {
  return {
    orderId: draft.orderId,
    orderNumber: draft.orderNumber,
    customerPresent: Boolean(draft.customer.name && draft.customer.email),
    documentPresent: Boolean(draft.customer.document),
    phonePresent: Boolean(draft.customer.phone),
    addressPresent: Boolean(
      draft.shippingAddress?.postalCode ||
        draft.shippingAddress?.city ||
        draft.shippingAddress?.state
    ),
    itemCount: draft.items.length,
    total: draft.totals.total,
  };
}
