import { describe, expect, it } from 'vitest';
import { adminOrderFixture as order } from '../../../tests/fixtures/admin-order';
import { getBlingOrderErrorMessage, getOrderAdminSummary } from './order-admin-summary';
import type { PaymentTransaction } from '@/modules/payments/payment-transaction.types';

describe('order admin summary', () => {
  it('uses saved company fiscal data, including explicit non-exemption', () => {
    const summary = getOrderAdminSummary({ ...order, customerType: 'pj', customerLegalName: 'Empresa teste', customerStateRegistrationExempt: false, customerStateRegistration: '123', customer: { ...order.customer, stateRegistrationExempt: true } });
    expect(summary).toMatchObject({ legalName: 'Empresa teste', stateRegistration: '123', stateRegistrationExempt: false, missingFiscalData: [] });
  });
  it('calls out missing fiscal fields rather than inventing them', () => {
    expect(getOrderAdminSummary({ ...order, customerType: 'pj', customer: { name: 'Teste' } }).missingFiscalData).toEqual(['CPF/CNPJ', 'razão social', 'inscrição estadual ou isenção']);
  });
  it('exposes only a normalized payment method, never raw metadata', () => {
    const summary = getOrderAdminSummary(order, { metadata: { payment_method_id: 'pix', secret: 'must-not-render' } } as unknown as PaymentTransaction);
    expect(summary.paymentMethod).toBe('Pix');
    expect(JSON.stringify(summary)).not.toContain('must-not-render');
  });
  it('does not expose arbitrary provider errors in feedback', () => {
    expect(getBlingOrderErrorMessage('private provider payload')).not.toContain('private provider payload');
  });
});
