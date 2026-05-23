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
  items: OrderItem[];
  createdAt: string;
}

export interface OrderListItem extends Order {
  customerName?: string;
  customerEmail?: string;
  salesChannel?: string;
}

export interface CreateOrderInput {
  storeId: string;
  customerId?: string;
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
