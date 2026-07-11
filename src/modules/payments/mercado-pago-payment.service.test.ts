import { describe, expect, it } from 'vitest';
import {
  amountsMatch,
  mapMercadoPagoStatus,
} from './mercado-pago-payment.service';

describe('Mercado Pago payment status mapping', () => {
  it.each([
    ['approved', 'approved', 'paid'],
    ['pending', 'pending', 'pending'],
    ['in_process', 'pending', 'pending'],
    ['rejected', 'rejected', 'failed'],
    ['cancelled', 'cancelled', 'failed'],
    ['refunded', 'refunded', 'refunded'],
  ] as const)(
    'maps %s to the safe Zalen state',
    (providerStatus, transactionStatus, orderPaymentStatus) => {
      const mapped = mapMercadoPagoStatus(providerStatus);

      expect(mapped.transactionStatus).toBe(transactionStatus);
      expect(mapped.orderPaymentStatus).toBe(orderPaymentStatus);
    }
  );

  it('keeps unknown status as an error instead of approving an order', () => {
    expect(mapMercadoPagoStatus('unexpected')).toMatchObject({
      transactionStatus: 'error',
      resultStatus: 'error',
      lastError: 'unsupported_status:unexpected',
    });
    expect(mapMercadoPagoStatus(undefined)).toMatchObject({
      transactionStatus: 'error',
      lastError: 'missing_status',
    });
  });

  it('compares payment amounts in cents before approving', () => {
    const order = { total: 42.5 } as never;

    expect(amountsMatch(42.5, order)).toBe(true);
    expect(amountsMatch(42.504, order)).toBe(true);
    expect(amountsMatch(42.51, order)).toBe(false);
    expect(amountsMatch(undefined, order)).toBe(false);
  });
});
