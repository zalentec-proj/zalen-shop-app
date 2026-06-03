import 'server-only';

import {
  createOptionalAdminClient,
  createOptionalClient,
  isSupabaseAdminConfigured,
} from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import { getMockProductBySlug } from '../catalog/product.mock';
import type {
  FulfillmentStatus,
  Order,
  OrderItem,
  OrderListItem,
  OrderStatus,
  PaymentStatus,
} from './order.types';

const MOCK_STORE_ID = 'brasil-drones-store-001';
const BRASIL_DRONES_STORE_ID = '00000000-0000-0000-0000-000000000001';

export type OrderDataSource = 'supabase' | 'mock';

export interface OrderRepositoryResult<T> {
  data: T;
  source: OrderDataSource;
}

type SupabaseOrderClient =
  | NonNullable<ReturnType<typeof createOptionalAdminClient>>
  | NonNullable<Awaited<ReturnType<typeof createOptionalClient>>>;

type OrderRow = {
  id: string;
  store_id: string | null;
  order_number: string;
  customer_id: string | null;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  subtotal: number | string | null;
  shipping_total: number | string | null;
  discount_total: number | string | null;
  total: number | string | null;
  external_erp_provider: string | null;
  external_erp_id: string | null;
  created_at: string | null;
};

type OrderItemRow = {
  id: string;
  store_id: string | null;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unit_price: number | string | null;
  total: number | string | null;
};

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQueryErrorDetails(error: RepositoryError | null) {
  return {
    code: error?.code ?? 'unknown',
    details: toCompactLogText(error?.details),
    hint: toCompactLogText(error?.hint),
    message: error?.message ?? 'query-error',
  };
}

function toCompactLogText(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').slice(0, 220);
}

function toNullableUuid(value: string | undefined): string | null {
  return value && uuidPattern.test(value) ? value : null;
}

function toOrderStatus(value: string | null | undefined): OrderStatus {
  const allowed: OrderStatus[] = [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ];

  return allowed.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : 'pending';
}

function toPaymentStatus(value: string | null | undefined): PaymentStatus {
  const allowed: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

  return allowed.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : 'pending';
}

function toFulfillmentStatus(
  value: string | null | undefined
): FulfillmentStatus {
  const allowed: FulfillmentStatus[] = [
    'unfulfilled',
    'partial',
    'fulfilled',
    'returned',
  ];

  return allowed.includes(value as FulfillmentStatus)
    ? (value as FulfillmentStatus)
    : 'unfulfilled';
}

function buildMockOrderItem(
  orderId: string,
  productSlug: string,
  quantity: number
): OrderItem {
  const product = getMockProductBySlug(productSlug);

  if (!product) {
    throw new Error(`Mock product not found for order item: ${productSlug}`);
  }

  const variant = product.variants[0];

  if (!variant) {
    throw new Error(`Mock product has no variant: ${productSlug}`);
  }

  return {
    id: `${orderId}-${variant.id}`,
    storeId: MOCK_STORE_ID,
    orderId,
    productId: product.id,
    variantId: variant.id,
    sku: variant.sku,
    name: product.name,
    quantity,
    unitPrice: variant.price,
    total: variant.price * quantity,
  };
}

function buildMockOrder(
  input: Omit<OrderListItem, 'storeId' | 'subtotal' | 'total' | 'items'> & {
    itemBlueprints: Array<{ productSlug: string; quantity: number }>;
    shippingTotal: number;
    discountTotal: number;
  }
): OrderListItem {
  const items = input.itemBlueprints.map((blueprint) =>
    buildMockOrderItem(input.id, blueprint.productSlug, blueprint.quantity)
  );
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const total = subtotal + input.shippingTotal - input.discountTotal;

  return {
    id: input.id,
    storeId: MOCK_STORE_ID,
    orderNumber: input.orderNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    salesChannel: input.salesChannel,
    status: input.status,
    paymentStatus: input.paymentStatus,
    fulfillmentStatus: input.fulfillmentStatus,
    subtotal,
    shippingTotal: input.shippingTotal,
    discountTotal: input.discountTotal,
    total,
    externalErpProvider: input.externalErpProvider,
    externalErpId: input.externalErpId,
    items,
    createdAt: input.createdAt,
  };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    storeId: row.store_id ?? BRASIL_DRONES_STORE_ID,
    orderId: row.order_id,
    productId: row.product_id ?? '',
    variantId: row.variant_id ?? '',
    sku: row.sku ?? undefined,
    name: row.name,
    quantity: row.quantity,
    unitPrice: toNumber(row.unit_price),
    total: toNumber(row.total),
  };
}

function mapOrder(row: OrderRow, items: OrderItem[]): OrderListItem {
  return {
    id: row.id,
    storeId: row.store_id ?? BRASIL_DRONES_STORE_ID,
    orderNumber: row.order_number,
    customerId: row.customer_id ?? undefined,
    status: toOrderStatus(row.status),
    paymentStatus: toPaymentStatus(row.payment_status),
    fulfillmentStatus: toFulfillmentStatus(row.fulfillment_status),
    subtotal: toNumber(row.subtotal),
    shippingTotal: toNumber(row.shipping_total),
    discountTotal: toNumber(row.discount_total),
    total: toNumber(row.total),
    externalErpProvider: row.external_erp_provider ?? undefined,
    externalErpId: row.external_erp_id ?? undefined,
    salesChannel: 'Loja online',
    items,
    createdAt: row.created_at ?? new Date(0).toISOString(),
  };
}

export async function listMockOrdersFromRepository(): Promise<OrderListItem[]> {
  return [
    buildMockOrder({
      id: 'order-1001',
      orderNumber: 'BD-482931',
      customerId: 'customer-1',
      customerName: 'Carlos Mendes',
      customerEmail: 'carlos.mendes@exemplo.com',
      salesChannel: 'Loja online',
      status: 'processing',
      paymentStatus: 'paid',
      fulfillmentStatus: 'partial',
      shippingTotal: 0,
      discountTotal: 0,
      externalErpProvider: 'bling',
      externalErpId: 'BL-88421',
      createdAt: '2026-05-22T09:15:00.000Z',
      itemBlueprints: [
        { productSlug: 'dji-mavic-3-pro', quantity: 1 },
        { productSlug: 'case-impermeavel', quantity: 1 },
      ],
    }),
    buildMockOrder({
      id: 'order-1002',
      orderNumber: 'BD-482947',
      customerId: 'customer-2',
      customerName: 'Fernanda Lima',
      customerEmail: 'fernanda.lima@exemplo.com',
      salesChannel: 'WhatsApp',
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      shippingTotal: 49.9,
      discountTotal: 0,
      createdAt: '2026-05-22T11:42:00.000Z',
      itemBlueprints: [{ productSlug: 'dji-mini-4-pro', quantity: 1 }],
    }),
    buildMockOrder({
      id: 'order-1003',
      orderNumber: 'BD-482955',
      customerId: 'customer-3',
      customerName: 'Rafael Sousa',
      customerEmail: 'rafael.sousa@exemplo.com',
      salesChannel: 'Loja online',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      shippingTotal: 35,
      discountTotal: 120,
      externalErpProvider: 'bling',
      externalErpId: 'BL-88439',
      createdAt: '2026-05-21T16:08:00.000Z',
      itemBlueprints: [{ productSlug: 'dji-air-3-fly-more', quantity: 1 }],
    }),
    buildMockOrder({
      id: 'order-1004',
      orderNumber: 'BD-482972',
      customerId: 'customer-4',
      customerName: 'Patricia Rocha',
      customerEmail: 'patricia.rocha@exemplo.com',
      salesChannel: 'Marketplace',
      status: 'confirmed',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      shippingTotal: 24.9,
      discountTotal: 0,
      createdAt: '2026-05-21T13:20:00.000Z',
      itemBlueprints: [
        { productSlug: 'bateria-dji-mini-3-pro', quantity: 2 },
        { productSlug: 'helices-dji-air-3', quantity: 1 },
      ],
    }),
    buildMockOrder({
      id: 'order-1005',
      orderNumber: 'BD-483004',
      customerId: 'customer-5',
      customerName: 'Luciano Barros',
      customerEmail: 'luciano.barros@exemplo.com',
      salesChannel: 'Loja online',
      status: 'delivered',
      paymentStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      shippingTotal: 0,
      discountTotal: 59,
      externalErpProvider: 'bling',
      externalErpId: 'BL-88474',
      createdAt: '2026-05-20T10:05:00.000Z',
      itemBlueprints: [
        { productSlug: 'case-impermeavel', quantity: 1 },
        { productSlug: 'bateria-dji-mini-3-pro', quantity: 1 },
      ],
    }),
  ];
}

export async function listOrdersFromRepository(): Promise<OrderListItem[]> {
  return (await listOrdersWithSourceFromRepository()).data;
}

export async function listOrdersWithSourceFromRepository(): Promise<
  OrderRepositoryResult<OrderListItem[]>
> {
  const clients = [
    createOptionalAdminClient(),
    await createOptionalClient(),
  ].filter((client): client is SupabaseOrderClient => Boolean(client));

  if (clients.length === 0) {
    logDevOnce('order.repository', 'using mock data', {
      reason: 'supabase-env-missing',
    });
    return {
      data: await listMockOrdersFromRepository(),
      source: 'mock',
    };
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', BRASIL_DRONES_STORE_ID)
      .order('created_at', { ascending: false });

    if (ordersError || !orderRows) {
      lastError = ordersError;
      continue;
    }

    const orderIds = orderRows.map((order) => order.id);

    if (orderIds.length === 0) {
      logDevOnce('order.repository', 'using supabase data', {
        orders: 0,
      });
      return {
        data: [],
        source: 'supabase',
      };
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError || !itemRows) {
      lastError = itemsError;
      continue;
    }

    const itemsByOrderId = new Map<string, OrderItem[]>();

    (itemRows as OrderItemRow[]).forEach((row) => {
      const items = itemsByOrderId.get(row.order_id) ?? [];
      items.push(mapOrderItem(row));
      itemsByOrderId.set(row.order_id, items);
    });

    const orders = (orderRows as OrderRow[]).map((order) =>
      mapOrder(order, itemsByOrderId.get(order.id) ?? [])
    );

    logDevOnce('order.repository', 'using supabase data', {
      orders: orders.length,
    });

    return {
      data: orders,
      source: 'supabase',
    };
  }

  logDevOnce('order.repository', 'using mock data', {
    reason: 'orders-query-failed',
    ...getQueryErrorDetails(lastError),
  });

  return {
    data: await listMockOrdersFromRepository(),
    source: 'mock',
  };
}

export async function saveOrderToRepository(order: Order): Promise<Order> {
  if (!isSupabaseAdminConfigured()) {
    logDevOnce('order.repository', 'using local order simulation', {
      reason: 'supabase-env-missing',
    });
    return order;
  }

  const supabase = createOptionalAdminClient();

  if (!supabase) {
    logDevOnce('order.repository', 'using local order simulation', {
      reason: 'supabase-client-unavailable',
    });
    return order;
  }

  const storeId = toNullableUuid(order.storeId);

  if (!storeId) {
    logDevOnce('order.repository', 'using local order simulation', {
      reason: 'non-uuid-store-id',
    });
    return order;
  }

  const { error: orderError } = await supabase.from('orders').insert({
    id: order.id,
    store_id: storeId,
    order_number: order.orderNumber,
    customer_id: toNullableUuid(order.customerId),
    status: order.status,
    payment_status: order.paymentStatus,
    fulfillment_status: order.fulfillmentStatus,
    subtotal: order.subtotal,
    shipping_total: order.shippingTotal,
    discount_total: order.discountTotal,
    total: order.total,
    external_erp_provider: order.externalErpProvider,
    external_erp_id: order.externalErpId,
    created_at: order.createdAt,
  });

  if (orderError) {
    throw new Error('Failed to persist order in Supabase.');
  }

  if (order.items.length === 0) {
    return order;
  }

  const { error: itemError } = await supabase.from('order_items').insert(
    order.items.map((item) => ({
      id: item.id,
      store_id: toNullableUuid(item.storeId) ?? storeId,
      order_id: item.orderId,
      product_id: toNullableUuid(item.productId),
      variant_id: toNullableUuid(item.variantId),
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    }))
  );

  if (itemError) {
    throw new Error('Failed to persist order items in Supabase.');
  }

  logDevOnce('order.repository', 'saved order in supabase');

  return order;
}
