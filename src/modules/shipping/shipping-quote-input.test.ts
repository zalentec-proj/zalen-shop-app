import { describe, expect, it } from 'vitest';
import { shippingQuoteAddressSchema } from './shipping-quote-input';

describe('shipping quote input', () => {
  it('accepts a destination CEP without requiring delivery fields unused by carriers', () => {
    expect(
      shippingQuoteAddressSchema.safeParse({ postalCode: '85801-210' }).success
    ).toBe(true);
  });

  it('rejects a destination CEP that is too short', () => {
    expect(
      shippingQuoteAddressSchema.safeParse({ postalCode: '85801' }).success
    ).toBe(false);
  });
});
