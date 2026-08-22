export type CheckoutEntryStep =
  | 'cadastro'
  | 'entrega'
  | 'pagamento';

export function resolveCheckoutEntryStep(input: {
  hasVerifiedSession: boolean;
  hasCustomerData: boolean;
  hasDeliveryData: boolean;
}): CheckoutEntryStep {
  if (!input.hasVerifiedSession) {
    return 'cadastro';
  }

  if (!input.hasCustomerData) {
    return 'cadastro';
  }

  if (!input.hasDeliveryData) {
    return 'entrega';
  }

  return 'pagamento';
}

export function getInitialPostalCodeLookupKey(input: {
  hasCompleteDeliveryAddress: boolean;
  postalCode: string;
}) {
  if (!input.hasCompleteDeliveryAddress) {
    return null;
  }

  const postalCode = input.postalCode.replace(/\D/g, '');

  return postalCode.length === 8 ? postalCode : null;
}

export function shouldKeepPixStatusInCheckout(input: {
  accessKind: 'authenticated' | 'guest';
  status: string;
  paymentId: string;
  paymentMethodId?: string;
  submittedAsPix: boolean;
}) {
  const isPix =
    input.paymentMethodId?.trim().toLowerCase() === 'pix' ||
    input.submittedAsPix;

  return (
    input.accessKind === 'guest' &&
    input.status === 'pending' &&
    Boolean(input.paymentId) &&
    isPix
  );
}

export type CheckoutPresentation =
  | 'confirmation'
  | 'pix_status'
  | 'empty_cart'
  | 'checkout';

export function resolveCheckoutPresentation(input: {
  checkoutDone: boolean;
  hasPixPaymentStatus: boolean;
  itemCount: number;
}): CheckoutPresentation {
  if (input.checkoutDone) {
    return 'confirmation';
  }

  // A confirmed pending Pix intentionally clears the cart. Its payment status
  // must still take precedence so the customer never sees an empty cart first.
  if (input.hasPixPaymentStatus) {
    return 'pix_status';
  }

  return input.itemCount === 0 ? 'empty_cart' : 'checkout';
}

export type ShippingSummaryState =
  | 'pending'
  | 'calculating'
  | 'free'
  | 'priced';

export function getShippingSummaryState(input: {
  selectedPrice?: number;
  isQuoting: boolean;
}): ShippingSummaryState {
  if (input.selectedPrice === undefined) {
    return input.isQuoting ? 'calculating' : 'pending';
  }

  return input.selectedPrice === 0 ? 'free' : 'priced';
}
