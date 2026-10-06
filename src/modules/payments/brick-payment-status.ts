import type { MercadoPagoPaymentProcessingResult } from './mercado-pago-payment.service';

export type BrickPaymentStatus = 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded' | 'error';

export function getBrickPaymentStatus(status: string | undefined): BrickPaymentStatus {
  if (status === 'approved' || status === 'pending' || status === 'rejected' || status === 'cancelled' || status === 'refunded') return status;
  if (status === 'in_process' || status === 'authorized' || status === 'in_mediation') return 'pending';
  if (status === 'charged_back') return 'cancelled';
  return 'error';
}

/** No fallback to the creation response when amount, store or environment checks fail. */
export function getReconciledBrickStatus(result: MercadoPagoPaymentProcessingResult): BrickPaymentStatus {
  return result.ok ? getBrickPaymentStatus(result.status) : 'error';
}
