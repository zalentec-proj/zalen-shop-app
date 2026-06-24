import 'server-only';

import {
  createOptionalAdminClient,
  createOptionalClient,
  isSupabaseAdminConfigured,
} from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import { getMockProductBySlug } from '../catalog/product.mock';
import type {
  ExternalErpSyncStatus,
  FulfillmentStatus,
  Order,
  OrderAddressSnapshot,
  OrderItem,
  OrderListItem,
  OrderStatus,
  PaymentStatus,
} from './order.types';

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
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  customer_type: string | null;
  customer_legal_name: string | null;
  customer_state_registration: string | null;
  customer_state_registration_exempt: boolean | null;
  price_list_id: string | null;
  price_list_name: string | null;
  fiscal_info_json: Record<string, unknown> | null;
  shipping_address_json: Record<string, unknown> | null;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  subtotal: number | string | null;
  shipping_total: number | string | null;
  discount_total: number | string | null;
  total: number | string | null;
  external_erp_provider: string | null;
  external_erp_id: string | null;
  external_erp_sync_status: string | null;
  external_erp_last_error: string | null;
  external_erp_synced_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
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
  customer_type: string | null;
  price_list_id: string | null;
  price_list_name: string | null;
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

function toExternalErpSyncStatus(
  value: string | null | undefined
): ExternalErpSyncStatus {
  const allowed: ExternalErpSyncStatus[] = [
    'pending',
    'synced',
    'error',
    'skipped',
  ];

  return allowed.includes(value as ExternalErpSyncStatus)
    ? (value as ExternalErpSyncStatus)
    : 'pending';
}

function toCustomerType(value: string | null | undefined) {
  return value === 'pj' ? 'pj' : value === 'pf' ? 'pf' : undefined;
}

function toFiscalInfoJson(
  value: OrderListItem['fiscalInfo'] | undefined
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function toAddressSnapshot(
  value: Record<string, unknown> | null | undefined
): OrderAddressSnapshot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const snapshot: OrderAddressSnapshot = {};

  for (const key of [
    'recipientName',
    'phone',
    'postalCode',
    'street',
    'number',
    'complement',
    'district',
    'city',
    'state',
    'country',
  ] as const) {
    const rawValue = value[key];

    if (typeof rawValue === 'string' && rawValue.trim()) {
      snapshot[key] = rawValue;
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

function toShippingAddressJson(value: OrderAddressSnapshot | undefined) {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => Boolean(entryValue))
  );
}

function buildMockOrderItem(
  orderId: string,
  productSlug: string,
  quantity: number,
  storeId: string
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
    storeId,
    orderId,
    productId: product.id,
    variantId: variant.id,
    sku: variant.sku,
    name: product.name,
    quantity,
    unitPrice: variant.price,
    total: variant.price * quantity,
    customerType: undefined,
    priceListId: undefined,
    priceListName: undefined,
  };
}

function buildMockOrder(
  input: Omit<
    OrderListItem,
    | 'storeId'
    | 'subtotal'
    | 'total'
    | 'items'
    | 'externalErpSyncStatus'
    | 'externalErpLastError'
    | 'externalErpSyncedAt'
  > & {
    externalErpSyncStatus?: ExternalErpSyncStatus;
    externalErpLastError?: string;
    externalErpSyncedAt?: string;
    itemBlueprints: Array<{ productSlug: string; quantity: number }>;
    shippingTotal: number;
    discountTotal: number;
  },
  storeId: string
): OrderListItem {
  const items = input.itemBlueprints.map((blueprint) =>
    buildMockOrderItem(
      input.id,
      blueprint.productSlug,
      blueprint.quantity,
      storeId
    )
  );
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const total = subtotal + input.shippingTotal - input.discountTotal;

  return {
    id: input.id,
    storeId,
    orderNumber: input.orderNumber,
    customerId: input.customerId,
    customer: input.customer,
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
    externalErpSyncStatus: input.externalErpSyncStatus ?? 'pending',
    externalErpLastError: input.externalErpLastError,
    externalErpSyncedAt: input.externalErpSyncedAt,
    items,
    createdAt: input.createdAt,
  };
}

function mapOrderItem(row: OrderItemRow, fallbackStoreId: string): OrderItem {
  return {
    id: row.id,
    storeId: row.store_id ?? fallbackStoreId,
    orderId: row.order_id,
    productId: row.product_id ?? '',
    variantId: row.variant_id ?? '',
    sku: row.sku ?? undefined,
    name: row.name,
    quantity: row.quantity,
    unitPrice: toNumber(row.unit_price),
    total: toNumber(row.total),
    customerType: toCustomerType(row.customer_type),
    priceListId: row.price_list_id ?? undefined,
    priceListName: row.price_list_name ?? undefined,
  };
}

function mapOrder(
  row: OrderRow,
  items: OrderItem[],
  fallbackStoreId: string
): OrderListItem {
  return {
    id: row.id,
    storeId: row.store_id ?? fallbackStoreId,
    orderNumber: row.order_number,
    customerId: row.customer_id ?? undefined,
    customer: {
      name: row.customer_name ?? undefined,
      email: row.customer_email ?? undefined,
      phone: row.customer_phone ?? undefined,
      document: row.customer_document ?? undefined,
      customerType: toCustomerType(row.customer_type),
      legalName: row.customer_legal_name ?? undefined,
      stateRegistration: row.customer_state_registration ?? undefined,
      stateRegistrationExempt:
        row.customer_state_registration_exempt ?? undefined,
      shippingAddress: toAddressSnapshot(row.shipping_address_json),
    },
    status: toOrderStatus(row.status),
    paymentStatus: toPaymentStatus(row.payment_status),
    fulfillmentStatus: toFulfillmentStatus(row.fulfillment_status),
    subtotal: toNumber(row.subtotal),
    shippingTotal: toNumber(row.shipping_total),
    discountTotal: toNumber(row.discount_total),
    total: toNumber(row.total),
    customerType: toCustomerType(row.customer_type),
    customerLegalName: row.customer_legal_name ?? undefined,
    customerStateRegistration: row.customer_state_registration ?? undefined,
    customerStateRegistrationExempt:
      row.customer_state_registration_exempt ?? undefined,
    priceListId: row.price_list_id ?? undefined,
    priceListName: row.price_list_name ?? undefined,
    fiscalInfo: row.fiscal_info_json as
      | Record<string, string | boolean | undefined>
      | undefined,
    externalErpProvider: row.external_erp_provider ?? undefined,
    externalErpId: row.external_erp_id ?? undefined,
    externalErpSyncStatus: toExternalErpSyncStatus(row.external_erp_sync_status),
    externalErpLastError: row.external_erp_last_error ?? undefined,
    externalErpSyncedAt: row.external_erp_synced_at ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    salesChannel: 'Loja online',
    items,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
  };
}

export async function listMockOrdersFromRepository(
  storeId: string
): Promise<OrderListItem[]> {
  return [
    buildMockOrder(
      {
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
      },
      storeId
    ),
    buildMockOrder(
      {
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
      },
      storeId
    ),
    buildMockOrder(
      {
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
      },
      storeId
    ),
    buildMockOrder(
      {
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
      },
      storeId
    ),
    buildMockOrder(
      {
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
      },
      storeId
    ),
  ];
}

export async function listOrdersFromRepository(
  storeId: string
): Promise<OrderListItem[]> {
  return (await listOrdersWithSourceFromRepository(storeId)).data;
}

async function getOrderItemsFromRepository(
  supabase: SupabaseOrderClient,
  storeId: string,
  orderIds: string[]
) {
  if (orderIds.length === 0) {
    return new Map<string, OrderItem[]>();
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('store_id', storeId)
    .in('order_id', orderIds);

  if (itemsError || !itemRows) {
    throw new Error('Unable to load order items.');
  }

  return (itemRows as OrderItemRow[]).reduce((accumulator, row) => {
    const items = accumulator.get(row.order_id) ?? [];
    items.push(mapOrderItem(row, storeId));
    accumulator.set(row.order_id, items);
    return accumulator;
  }, new Map<string, OrderItem[]>());
}

export async function getOrderByIdFromRepository(
  storeId: string,
  orderId: string
): Promise<OrderListItem | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    return null;
  }

  const itemsByOrderId = await getOrderItemsFromRepository(
    supabase,
    storeId,
    [orderId]
  );

  return mapOrder(
    orderRow as OrderRow,
    itemsByOrderId.get(orderId) ?? [],
    storeId
  );
}

export async function updateOrderExternalErpStateInRepository(input: {
  storeId: string;
  orderId: string;
  provider?: string;
  externalId?: string;
  status: ExternalErpSyncStatus;
  lastError?: string;
  syncedAt?: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  const payload: Record<string, unknown> = {
    external_erp_sync_status: input.status,
    external_erp_last_error: input.lastError ?? null,
    external_erp_synced_at: input.syncedAt ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.provider) {
    payload.external_erp_provider = input.provider;
  }

  if (input.externalId) {
    payload.external_erp_id = input.externalId;
  }

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', input.orderId)
    .eq('store_id', input.storeId);

  if (error) {
    throw new Error('Unable to update order ERP sync state.');
  }
}

export async function updateOrderPaymentStateInRepository(input: {
  storeId: string;
  orderId: string;
  paymentStatus: PaymentStatus;
  status?: OrderStatus;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  const payload: Record<string, unknown> = {
    payment_status: input.paymentStatus,
    updated_at: new Date().toISOString(),
  };

  if (input.status) {
    payload.status = input.status;
  }

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', input.orderId)
    .eq('store_id', input.storeId);

  if (error) {
    throw new Error('Unable to update order payment state.');
  }
}

export async function markOrderPaymentApprovedIfPendingInRepository(input: {
  storeId: string;
  orderId: string;
}): Promise<boolean> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.orderId)
    .eq('store_id', input.storeId)
    .neq('payment_status', 'paid')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error('Unable to approve order payment state.');
  }

  return Boolean(data);
}

export async function listOrdersWithSourceFromRepository(
  storeId: string
): Promise<
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
      data: await listMockOrdersFromRepository(storeId),
      source: 'mock',
    };
  }

  let lastError: RepositoryError | null = null;

  for (const supabase of clients) {
    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
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
      .eq('store_id', storeId)
      .in('order_id', orderIds);

    if (itemsError || !itemRows) {
      lastError = itemsError;
      continue;
    }

    const itemsByOrderId = new Map<string, OrderItem[]>();

    (itemRows as OrderItemRow[]).forEach((row) => {
      const items = itemsByOrderId.get(row.order_id) ?? [];
      items.push(mapOrderItem(row, storeId));
      itemsByOrderId.set(row.order_id, items);
    });

    const orders = (orderRows as OrderRow[]).map((order) =>
      mapOrder(order, itemsByOrderId.get(order.id) ?? [], storeId)
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
    data: await listMockOrdersFromRepository(storeId),
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
    customer_name: order.customer?.name,
    customer_email: order.customer?.email,
    customer_phone: order.customer?.phone,
    customer_document: order.customer?.document,
    customer_type: order.customerType ?? order.customer?.customerType,
    customer_legal_name:
      order.customerLegalName ?? order.customer?.legalName ?? null,
    customer_state_registration:
      order.customerStateRegistration ??
      order.customer?.stateRegistration ??
      null,
    customer_state_registration_exempt:
      order.customerStateRegistrationExempt ??
      order.customer?.stateRegistrationExempt ??
      false,
    price_list_id: toNullableUuid(order.priceListId),
    price_list_name: order.priceListName,
    fiscal_info_json: toFiscalInfoJson(order.fiscalInfo),
    shipping_address_json: toShippingAddressJson(order.customer?.shippingAddress),
    status: order.status,
    payment_status: order.paymentStatus,
    fulfillment_status: order.fulfillmentStatus,
    subtotal: order.subtotal,
    shipping_total: order.shippingTotal,
    discount_total: order.discountTotal,
    total: order.total,
    external_erp_provider: order.externalErpProvider,
    external_erp_id: order.externalErpId,
    external_erp_sync_status: order.externalErpSyncStatus,
    external_erp_last_error: order.externalErpLastError,
    external_erp_synced_at: order.externalErpSyncedAt,
    created_at: order.createdAt,
    updated_at: order.updatedAt ?? order.createdAt,
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
      customer_type: item.customerType,
      price_list_id: toNullableUuid(item.priceListId),
      price_list_name: item.priceListName,
    }))
  );

  if (itemError) {
    throw new Error('Failed to persist order items in Supabase.');
  }

  logDevOnce('order.repository', 'saved order in supabase');

  return order;
}
