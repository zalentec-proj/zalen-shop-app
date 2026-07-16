import 'server-only';

import { z } from 'zod';
import {
  deleteCustomerAddressInRepository,
  findCustomerByAuthUserIdFromRepository,
  findCustomerByCheckoutIdentifierFromRepository,
  findCustomerByEmailFromRepository,
  linkCustomerAuthUserInRepository,
  listCustomerAddressesFromRepository,
  listCustomersFromRepository,
  listCustomersWithSourceFromRepository,
  setDefaultCustomerAddressInRepository,
  upsertCustomerAddressInRepository,
  upsertCustomerInRepository,
} from './customer.repository';
import { isValidCpfOrCnpj } from './br-document';
import { getCustomerTypeFromDocument } from '@/modules/pricing/pricing.service';
import type {
  Customer,
  CustomerAddress,
  CustomerAddressInput,
  CustomerInput,
  CustomerListItem,
} from './customer.types';

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const customerAddressInputSchema = z.object({
  label: optionalTrimmedString,
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

const customerAddressRequiredInputSchema = customerAddressInputSchema.extend({
  label: optionalTrimmedString,
  recipientName: optionalTrimmedString,
  phone: optionalTrimmedString,
  postalCode: z.string().trim().min(8),
  street: z.string().trim().min(2),
  number: z.string().trim().min(1),
  complement: optionalTrimmedString,
  district: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
  country: optionalTrimmedString,
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

export async function listCustomersWithSource(storeId: string) {
  return listCustomersWithSourceFromRepository(storeId);
}

export async function listCustomerAddresses(input: {
  storeId: string;
  customerId: string;
}): Promise<CustomerAddress[]> {
  return listCustomerAddressesFromRepository(input);
}

export async function upsertCustomerAddress(input: {
  storeId: string;
  customer: Customer;
  addressId?: string;
  address: CustomerAddressInput;
  isDefault?: boolean;
}): Promise<CustomerAddress> {
  const parsedAddress = customerAddressRequiredInputSchema.parse(input.address);

  return upsertCustomerAddressInRepository({
    storeId: input.storeId,
    customerId: input.customer.id,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    addressId: input.addressId,
    address: parsedAddress,
    isDefault: input.isDefault,
  });
}

export async function setDefaultCustomerAddress(input: {
  storeId: string;
  customerId: string;
  addressId: string;
}): Promise<boolean> {
  return setDefaultCustomerAddressInRepository(input);
}

export async function deleteCustomerAddress(input: {
  storeId: string;
  customerId: string;
  addressId: string;
}): Promise<boolean> {
  return deleteCustomerAddressInRepository(input);
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
