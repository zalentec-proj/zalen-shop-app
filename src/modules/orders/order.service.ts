/**
 * Serviço de pedidos.
 * Regras de negócio ficam aqui: o frontend nunca define preço ou total.
 */

import { z } from 'zod';
import { getProductById } from '../catalog/product.service';
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderListItem,
} from './order.types';
import {
  type OrderDataSource,
  type OrderRepositoryResult,
  listMockOrdersFromRepository,
  listOrdersFromRepository,
  listOrdersWithSourceFromRepository,
  saveOrderToRepository,
} from './order.repository';

const createOrderInputSchema = z.object({
  storeId: z.string().trim().min(1),
  customerId: z.string().trim().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        variantId: z.string().trim().min(1),
        sku: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1),
});

function generateOrderNumber(): string {
  return `BD-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function listOrders(storeId: string): Promise<OrderListItem[]> {
  return listOrdersFromRepository(storeId);
}

export async function listOrdersWithSource(
  storeId: string
): Promise<
  OrderRepositoryResult<OrderListItem[]>
> {
  return listOrdersWithSourceFromRepository(storeId);
}

export async function listMockOrders(storeId: string): Promise<OrderListItem[]> {
  return listMockOrdersFromRepository(storeId);
}

export type { OrderDataSource };

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const parsed = createOrderInputSchema.parse(input);
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();

  const resolvedItems = await Promise.all(
    parsed.items.map(async (item) => {
      const product = await getProductById(parsed.storeId, item.productId);

      if (!product) {
        throw new Error('Product not found for order item.');
      }

      const variant = product.variants.find(
        (candidate) => candidate.id === item.variantId
      );

      if (!variant) {
        throw new Error('Product variant not found for order item.');
      }

      const unitPrice = variant.promotionalPrice ?? variant.price;

      return {
        id: crypto.randomUUID(),
        storeId: product.storeId,
        orderId,
        productId: product.id,
        variantId: variant.id,
        sku: variant.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
      } satisfies OrderItem;
    })
  );

  const storeId = resolvedItems[0]?.storeId ?? parsed.storeId;

  if (resolvedItems.some((item) => item.storeId !== storeId)) {
    throw new Error('Order contains products from different stores.');
  }

  const items = resolvedItems.map((item) => ({ ...item, storeId }));
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const shippingTotal = 0;
  const discountTotal = 0;

  const order: Order = {
    id: orderId,
    storeId,
    orderNumber: generateOrderNumber(),
    customerId: parsed.customerId,
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    subtotal,
    shippingTotal,
    discountTotal,
    total: subtotal + shippingTotal - discountTotal,
    items,
    createdAt: now,
  };

  return saveOrderToRepository(order);
}

export async function createMockOrder(input: CreateOrderInput): Promise<Order> {
  return createOrder(input);
}
