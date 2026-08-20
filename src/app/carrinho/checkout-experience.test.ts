import { describe, expect, it } from 'vitest';
import {
  getShippingSummaryState,
  getInitialPostalCodeLookupKey,
  resolveCheckoutEntryStep,
  shouldKeepPixStatusInCheckout,
} from './checkout-experience';

describe('checkout experience', () => {
  it('lets a visitor start directly with guest checkout data', () => {
    expect(
      resolveCheckoutEntryStep({
        hasVerifiedSession: false,
        hasCustomerData: true,
        hasDeliveryData: true,
      })
    ).toBe('cadastro');
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

  it('does not look up a complete saved address again on checkout entry', () => {
    expect(
      getInitialPostalCodeLookupKey({
        hasCompleteDeliveryAddress: true,
        postalCode: '85801-210',
      })
    ).toBe('85801210');

    expect(
      getInitialPostalCodeLookupKey({
        hasCompleteDeliveryAddress: false,
        postalCode: '85801-210',
      })
    ).toBeNull();
  });

  it('redirects authenticated Pix to the order and keeps guest Pix available in checkout', () => {
    const payment = {
      status: 'pending',
      paymentId: 'payment-1',
      paymentMethodId: 'pix',
      submittedAsPix: true,
    };

    expect(
      shouldKeepPixStatusInCheckout({
        ...payment,
        accessKind: 'authenticated',
      })
    ).toBe(false);
    expect(
      shouldKeepPixStatusInCheckout({
        ...payment,
        accessKind: 'guest',
      })
    ).toBe(true);
  });

  it('does not present unknown shipping as free', () => {
    expect(
      getShippingSummaryState({ selectedPrice: undefined, isQuoting: false })
    ).toBe('pending');
    expect(
      getShippingSummaryState({ selectedPrice: undefined, isQuoting: true })
    ).toBe('calculating');
    expect(
      getShippingSummaryState({ selectedPrice: 0, isQuoting: false })
    ).toBe('free');
    expect(
      getShippingSummaryState({ selectedPrice: 18.5, isQuoting: false })
    ).toBe('priced');
  });
});
