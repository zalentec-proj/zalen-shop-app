import 'server-only';

import { z } from 'zod';
import {
  findCustomerByAuthUserIdFromRepository,
  findCustomerByCheckoutIdentifierFromRepository,
  findCustomerByEmailFromRepository,
  linkCustomerAuthUserInRepository,
  listCustomersFromRepository,
  upsertCustomerInRepository,
} from './customer.repository';
import { isValidCpfOrCnpj } from './br-document';
import { getCustomerTypeFromDocument } from '@/modules/pricing/pricing.service';
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
  authUserId: optionalTrimmedString,
  name: z.string().trim().min(2),
  email: optionalTrimmedString,
  phone: optionalTrimmedString,
  document: optionalTrimmedString,
  customerType: z.enum(['pf', 'pj']).optional(),
  legalName: optionalTrimmedString,
  stateRegistration: optionalTrimmedString,
  stateRegistrationExempt: z.boolean().optional(),
  source: z.enum(['manual', 'checkout', 'integration']).optional(),
  acceptsMarketing: z.boolean().optional(),
  notes: optionalTrimmedString,
  address: customerAddressInputSchema.optional(),
});

const checkoutCustomerInputSchema = customerInputSchema.extend({
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  document: z
    .string()
    .trim()
    .min(11)
    .refine(isValidCpfOrCnpj, 'CPF ou CNPJ inválido.'),
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
  const parsed = parseCustomerInput(input);

  return upsertCustomerInRepository({
    ...parsed,
    customerType:
      parsed.customerType ?? getCustomerTypeFromDocument(parsed.document),
  });
}

export async function upsertCheckoutCustomer(
  input: CustomerInput
): Promise<Customer> {
  const parsed = parseCheckoutCustomerInput(input);

  return upsertCustomerInRepository({
    ...parsed,
    customerType:
      parsed.customerType ?? getCustomerTypeFromDocument(parsed.document),
    source: 'checkout',
  });
}

export async function findCheckoutCustomerByIdentifier(input: {
  storeId: string;
  identifier: string;
}): Promise<Customer | null> {
  return findCustomerByCheckoutIdentifierFromRepository(input);
}

export async function findCustomerByAuthUserId(input: {
  storeId: string;
  authUserId: string;
}): Promise<Customer | null> {
  return findCustomerByAuthUserIdFromRepository(input);
}

export async function findCustomerByEmail(input: {
  storeId: string;
  email: string;
}): Promise<Customer | null> {
  return findCustomerByEmailFromRepository(input);
}

export async function linkCustomerAuthUser(input: {
  storeId: string;
  customerId: string;
  authUserId: string;
}): Promise<Customer | null> {
  return linkCustomerAuthUserInRepository(input);
}
