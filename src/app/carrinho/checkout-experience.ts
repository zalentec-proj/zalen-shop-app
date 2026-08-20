export type CheckoutEntryStep =
  | 'identificacao'
  | 'cadastro'
  | 'entrega'
  | 'pagamento';

export function resolveCheckoutEntryStep(input: {
  hasVerifiedSession: boolean;
  hasCustomerData: boolean;
  hasDeliveryData: boolean;
}): CheckoutEntryStep {
  if (!input.hasVerifiedSession) {
    return 'identificacao';
  }

  if (!input.hasCustomerData) {
    return 'cadastro';
  }

  if (!input.hasDeliveryData) {
    return 'entrega';
  }

  return 'pagamento';
}
