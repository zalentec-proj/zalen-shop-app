import { describe, expect, it } from 'vitest';
import {
  getCheckoutOperationalErrorCode,
  getCheckoutRecoveryAction,
} from './checkout-recovery';

describe('checkout shipping recovery', () => {
  it.each([
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
  ])('requests a fresh shipping selection for %s', (code) => {
    const error = new Error(code);

    expect(getCheckoutRecoveryAction(error)).toBe('refresh_shipping');
    expect(getCheckoutOperationalErrorCode(error)).toBe(code);
  });

  it('does not expose an unexpected error as a recovery code', () => {
    const error = new Error('provider_payload_with_sensitive_context');

    expect(getCheckoutRecoveryAction(error)).toBeUndefined();
    expect(getCheckoutOperationalErrorCode(error)).toBe(
      'checkout_start_failed'
    );
  });
});
