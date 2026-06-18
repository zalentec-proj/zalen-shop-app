import 'server-only';

import { z } from 'zod';
import {
  listCustomersFromRepository,
  upsertCustomerInRepository,
} from './customer.repository';
import type { Customer, CustomerInput, CustomerListItem } from './customer.types';

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const customerAddressInputSchema = z.object({
  recipientName: optionalTrimmedString,
  phone: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  street: optionalTrimmedString,
  number: optionalTrimmedString,
  complement: optionalTrimmedString,
  district: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  country: optionalTrimmedString,
});

const customerInputSchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2),
  email: optionalTrimmedString,
  phone: optionalTrimmedString,
  document: optionalTrimmedString,
  source: z.enum(['manual', 'checkout', 'integration']).optional(),
  acceptsMarketing: z.boolean().optional(),
  notes: optionalTrimmedString,
  address: customerAddressInputSchema.optional(),
});

const checkoutCustomerInputSchema = customerInputSchema.extend({
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  document: z.string().trim().min(11),
});

export function parseCustomerInput(input: CustomerInput): CustomerInput {
  return customerInputSchema.parse(input);
}

export function parseCheckoutCustomerInput(input: CustomerInput): CustomerInput {
  return checkoutCustomerInputSchema.parse(input);
}

export async function listCustomers(storeId: string): Promise<CustomerListItem[]> {
  return listCustomersFromRepository(storeId);
}

export async function upsertCustomer(input: CustomerInput): Promise<Customer> {
  return upsertCustomerInRepository(parseCustomerInput(input));
}

export async function upsertCheckoutCustomer(
  input: CustomerInput
): Promise<Customer> {
  return upsertCustomerInRepository({
    ...parseCheckoutCustomerInput(input),
    source: 'checkout',
  });
}
