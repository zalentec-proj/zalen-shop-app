import { describe, expect, it } from 'vitest';
import { resolveCheckoutEntryStep } from './checkout-experience';

describe('checkout experience', () => {
  it('keeps the complete flow for a visitor without a verified session', () => {
    expect(
      resolveCheckoutEntryStep({
        hasVerifiedSession: false,
        hasCustomerData: true,
        hasDeliveryData: true,
      })
    ).toBe('identificacao');
  });

  it('requests only the missing customer or delivery data', () => {
    expect(
      resolveCheckoutEntryStep({
        hasVerifiedSession: true,
        hasCustomerData: false,
        hasDeliveryData: false,
      })
    ).toBe('cadastro');

    expect(
      resolveCheckoutEntryStep({
        hasVerifiedSession: true,
        hasCustomerData: true,
        hasDeliveryData: false,
      })
    ).toBe('entrega');
  });

  it('sends a recognized complete customer directly to review and payment', () => {
    expect(
      resolveCheckoutEntryStep({
        hasVerifiedSession: true,
        hasCustomerData: true,
        hasDeliveryData: true,
      })
    ).toBe('pagamento');
  });
});
