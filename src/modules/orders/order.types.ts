/**
 * Tipos do módulo de pedidos.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'partial'
  | 'fulfilled'
  | 'returned';

export type ExternalErpSyncStatus = 'pending' | 'synced' | 'error' | 'skipped';

export interface OrderAddressSnapshot {
  recipientName?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface OrderCustomerSnapshot {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  shippingAddress?: OrderAddressSnapshot;
}

export interface OrderItem {
  id: string;
  storeId: string;
  orderId: string;
  productId: string;
  variantId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  id: string;
  storeId: string;
  orderNumber: string;
  customerId?: string;
  customer?: OrderCustomerSnapshot;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  /** ID do pedido no ERP (Bling) — preenchido após sincronização */
  externalErpProvider?: string;
  externalErpId?: string;
  externalErpSyncStatus: ExternalErpSyncStatus;
  externalErpLastError?: string;
  externalErpSyncedAt?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface OrderListItem extends Order {
  customerName?: string;
  customerEmail?: string;
  salesChannel?: string;
}

export interface CreateOrderInput {
  storeId: string;
  customerId?: string;
  customer?: OrderCustomerSnapshot;
  items: Array<{
    productId: string;
    variantId: string;
    /** Apenas referência informativa vinda do client. O servidor recalcula. */
    sku?: string;
    /** Apenas referência informativa vinda do client. O servidor recalcula. */
    name?: string;
    quantity: number;
    /** Nunca confiar neste valor para total. O servidor recalcula pelo catálogo. */
    unitPrice?: number;
  }>;
}
