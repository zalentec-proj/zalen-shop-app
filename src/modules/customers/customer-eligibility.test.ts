import { describe, expect, it } from 'vitest';
import { isEligibleBusinessCustomer } from './customer.service';

const completeBusinessCustomer = {
  customerType: 'pj' as const,
  document: '62.193.839/0001-40',
  legalName: 'Empresa Teste Ltda.',
  stateRegistration: '123456789',
  stateRegistrationExempt: false,
};

describe('business customer eligibility', () => {
  it('accepts a complete PJ profile with a mathematically valid CNPJ', () => {
    expect(isEligibleBusinessCustomer(completeBusinessCustomer)).toBe(true);
  });

  it('accepts a complete PJ profile declared exempt', () => {
    expect(
      isEligibleBusinessCustomer({
        ...completeBusinessCustomer,
        stateRegistration: undefined,
        stateRegistrationExempt: true,
      })
    ).toBe(true);
  });

  it('rejects PF, invalid CNPJ and incomplete fiscal data', () => {
    expect(
      isEligibleBusinessCustomer({
        ...completeBusinessCustomer,
        customerType: 'pf',
      })
    ).toBe(false);
    expect(
      isEligibleBusinessCustomer({
        ...completeBusinessCustomer,
        document: '11.111.111/1111-11',
      })
    ).toBe(false);
    expect(
      isEligibleBusinessCustomer({
        ...completeBusinessCustomer,
        stateRegistration: undefined,
      })
    ).toBe(false);
  });
});
