export type BlingOrderSendStatus = 'success' | 'error' | 'skipped';

export interface BlingOrderDraftItem {
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BlingOrderDraft {
  orderId: string;
  orderNumber: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  shippingAddress?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  items: BlingOrderDraftItem[];
  totals: {
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
  };
}

export interface BlingOrderSendResult {
  status: BlingOrderSendStatus;
  orderId: string;
  orderNumber?: string;
  externalId?: string;
  errorCode?: string;
  tokenRefreshed?: boolean;
}
