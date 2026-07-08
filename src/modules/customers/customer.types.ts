import type { CustomerType } from '@/modules/pricing/pricing.types';

export type CustomerSource = 'manual' | 'checkout' | 'integration';

export interface CustomerAddress {
  id: string;
  storeId: string;
  customerId: string;
  label: string;
  recipientName?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  storeId: string;
  authUserId?: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  customerType: CustomerType;
  legalName?: string;
  stateRegistration?: string;
  stateRegistrationExempt: boolean;
  source: CustomerSource;
  acceptsMarketing: boolean;
  notes?: string;
  defaultAddress?: CustomerAddress;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItem extends Customer {
  ordersCount: number;
  totalSpent: number;
  lastPurchaseAt?: string;
  lastOrderNumber?: string;
}

export interface CustomerAddressInput {
  label?: string;
  recipientName?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface CustomerInput {
  storeId: string;
  authUserId?: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  customerType?: CustomerType;
  legalName?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  source?: CustomerSource;
  acceptsMarketing?: boolean;
  notes?: string;
  address?: CustomerAddressInput;
}
