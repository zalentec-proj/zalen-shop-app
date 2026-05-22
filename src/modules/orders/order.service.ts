/**
 * Serviço de pedidos.
 * Por enquanto apenas simulação local.
 * Futuramente: persistir no Supabase e sincronizar com Bling.
 */

import { CreateOrderInput, Order } from './order.types';

function generateOrderNumber(): string {
  return `BD-${Math.floor(100000 + Math.random() * 900000)}`;
}

/**
 * Cria um pedido simulado localmente.
 * NÃO persiste no banco, NÃO envia para Bling.
 * Apenas para demonstração do fluxo de checkout.
 */
export async function createMockOrder(input: CreateOrderInput): Promise<Order> {
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();

  const items = input.items.map((item, idx) => ({
    id: `item-${idx}-${orderId}`,
    storeId: input.storeId,
    orderId,
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.unitPrice * item.quantity,
  }));

  const subtotal = items.reduce((acc, i) => acc + i.total, 0);

  return {
    id: orderId,
    storeId: input.storeId,
    orderNumber: generateOrderNumber(),
    customerId: input.customerId,
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    subtotal,
    shippingTotal: 0,
    discountTotal: 0,
    total: subtotal,
    items,
    createdAt: now,
  };
}
