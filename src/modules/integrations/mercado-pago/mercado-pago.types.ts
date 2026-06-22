import type { Order } from '@/modules/orders/order.types';

export type PaymentMethod = 'mercado_pago_checkout_pro';

export interface PaymentIntent {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

export interface PaymentResult {
  externalId: string;
  status: 'pending' | 'approved' | 'rejected' | 'created';
  checkoutUrl?: string;
}

export interface MercadoPagoCheckoutPreferenceInput {
  order: Order;
  baseUrl: string;
}

export interface MercadoPagoCheckoutPreferenceResult {
  provider: 'mercado_pago';
  preferenceId: string;
  checkoutUrl: string;
  initPoint?: string;
  sandboxInitPoint?: string;
}

export interface MercadoPagoPaymentLookupResult {
  id: string;
  status?: string;
  statusDetail?: string;
  externalReference?: string;
  transactionAmount?: number;
  metadata?: Record<string, unknown>;
}
