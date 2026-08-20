export type CheckoutRecoveryAction = 'refresh_shipping';

const SHIPPING_REFRESH_ERROR_CODES = new Set([
  'shipping_quote_not_found',
  'shipping_quote_expired',
  'shipping_quote_items_changed',
  'shipping_quote_address_changed',
  'shipping_quote_pricing_changed',
  'shipping_quote_stale',
  'superfrete_quote_failed',
  'superfrete_quote_timeout',
  'superfrete_quote_invalid_response',
  'superfrete_no_services',
]);

export const SHIPPING_REFRESH_REQUIRED_MESSAGE =
  'As opções de envio mudaram. Atualizamos o frete; confirme novamente a forma de envio para continuar.';

export function getCheckoutRecoveryAction(
  error: unknown
): CheckoutRecoveryAction | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return SHIPPING_REFRESH_ERROR_CODES.has(error.message)
    ? 'refresh_shipping'
    : undefined;
}

export function getCheckoutOperationalErrorCode(error: unknown) {
  if (error instanceof Error && SHIPPING_REFRESH_ERROR_CODES.has(error.message)) {
    return error.message;
  }

  return 'checkout_start_failed';
}
