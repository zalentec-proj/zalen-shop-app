import type { Order } from '@/modules/orders/order.types';
import type { StoreIntegrationStatus } from '@/modules/integrations/core/store-integration.types';

export type PaymentMethod = 'mercado_pago_checkout_pro';

export type MercadoPagoRuntimeStatus =
  | 'connected'
  | 'pending_credentials'
  | 'disabled';

export type MercadoPagoEnvironment = 'test' | 'production';

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

export interface MercadoPagoRuntimeState {
  provider: 'mercado_pago';
  checkoutMode: 'checkout_pro';
  credentialsSource: 'env';
  status: MercadoPagoRuntimeStatus;
  enabled: boolean;
  configured: boolean;
  environment: MercadoPagoEnvironment;
  missingEnv: string[];
  integrationStatus?: StoreIntegrationStatus;
  warnings: string[];
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
  currencyId?: string;
  liveMode?: boolean;
  metadata?: Record<string, unknown>;
}
