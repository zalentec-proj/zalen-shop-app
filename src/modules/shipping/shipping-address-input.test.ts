import { describe, expect, it } from 'vitest';
import { shippingAddressSchema } from './shipping-address-input';

const address = {
  postalCode: '85801-210',
  street: 'Rua Pio XII',
  number: '123',
  district: 'Centro',
  city: 'Cascavel',
  state: 'PR',
};

describe('shipping address input', () => {
  it('accepts an address without complement', () => {
    const result = shippingAddressSchema.safeParse({
      ...address,
      complement: '',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.complement).toBeUndefined();
  });

  it('requires number and district', () => {
    expect(
      shippingAddressSchema.safeParse({ ...address, number: '' }).success
    ).toBe(false);
    expect(
      shippingAddressSchema.safeParse({ ...address, district: '' }).success
    ).toBe(false);
  });
});
