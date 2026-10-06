import { describe, expect, it } from 'vitest';
import { getBrickPaymentStatus, getReconciledBrickStatus } from './brick-payment-status';

describe('Brick payment confirmation', () => {
  it.each(['payment_amount_mismatch', 'payment_metadata_store_mismatch', 'payment_metadata_order_mismatch', 'payment_environment_mismatch', 'payment_currency_mismatch', 'mercado_pago_lookup_failed'])('does not approve after reconciliation failure: %s', errorCode => {
    expect(getReconciledBrickStatus({ ok: false, status: 'approved', errorCode })).toBe('error');
  });
  it.each(['approved', 'pending', 'rejected', 'cancelled', 'refunded'] as const)('uses the validated status %s', status => {
    expect(getReconciledBrickStatus({ ok: true, status })).toBe(status);
  });
  it('does not treat unknown statuses as success', () => {
    expect(getBrickPaymentStatus('unknown')).toBe('error');
    expect(getBrickPaymentStatus(undefined)).toBe('error');
    expect(getBrickPaymentStatus('in_process')).toBe('pending');
    expect(getBrickPaymentStatus('charged_back')).toBe('cancelled');
  });
});
