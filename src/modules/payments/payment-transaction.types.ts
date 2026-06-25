export type PaymentProvider = 'mercado_pago';

export type PaymentTransactionStatus =
  | 'created'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'error';

export interface UpsertPaymentTransactionInput {
  storeId: string;
  orderId: string;
  provider: PaymentProvider;
  providerReference?: string;
  externalPaymentId?: string;
  externalReference: string;
  status: PaymentTransactionStatus;
  amount: number;
  checkoutUrl?: string;
  sandboxCheckoutUrl?: string;
  rawStatus?: string;
  rawStatusDetail?: string;
  approvedAt?: string;
  processedAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentTransaction {
  id: string;
  storeId: string;
  orderId: string;
  provider: PaymentProvider;
  providerReference?: string;
  externalPaymentId?: string;
  externalReference: string;
  status: PaymentTransactionStatus;
  amount: number;
  checkoutUrl?: string;
  sandboxCheckoutUrl?: string;
  rawStatus?: string;
  rawStatusDetail?: string;
  approvedAt?: string;
  processedAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
