import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  Customer,
  CustomerAddress,
  CustomerAddressInput,
  CustomerInput,
  CustomerListItem,
  CustomerSource,
} from './customer.types';

type CustomerRow = {
  id: string;
  store_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  source: string | null;
  accepts_marketing: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CustomerAddressRow = {
  id: string;
  store_id: string;
  customer_id: string;
  label: string | null;
  recipient_name: string | null;
  phone: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type OrderMetricRow = {
  customer_id: string | null;
  order_number: string;
  total: number | string | null;
  created_at: string | null;
};

const fallbackDate = new Date(0).toISOString();
const customerSources: CustomerSource[] = ['manual', 'checkout', 'integration'];

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanEmail(value: string | undefined) {
  return cleanText(value)?.toLowerCase();
}

function cleanDigits(value: string | undefined) {
  const digits = value?.replace(/\D/g, '');
  return digits ? digits : undefined;
}

function toSource(value: string | null | undefined): CustomerSource {
  return customerSources.includes(value as CustomerSource)
    ? (value as CustomerSource)
    : 'manual';
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    label: row.label ?? 'Principal',
    recipientName: row.recipient_name ?? undefined,
    phone: row.phone ?? undefined,
    postalCode: row.postal_code ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    district: row.district ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? 'BR',
    isDefault: row.is_default ?? true,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function mapCustomer(
  row: CustomerRow,
  defaultAddress?: CustomerAddress
): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    document: row.document ?? undefined,
    source: toSource(row.source),
    acceptsMarketing: row.accepts_marketing ?? false,
    notes: row.notes ?? undefined,
    defaultAddress,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function buildCustomerPayload(input: CustomerInput) {
  return {
    store_id: input.storeId,
    name: cleanText(input.name) ?? 'Cliente sem nome',
    email: cleanEmail(input.email) ?? null,
    phone: cleanDigits(input.phone) ?? null,
    document: cleanDigits(input.document) ?? null,
    source: input.source ?? 'manual',
    accepts_marketing: input.acceptsMarketing ?? false,
    notes: cleanText(input.notes) ?? null,
    updated_at: new Date().toISOString(),
  };
}

function buildAddressPayload(input: {
  storeId: string;
  customerId: string;
  name: string;
  phone?: string;
  address: CustomerAddressInput;
}) {
  return {
    store_id: input.storeId,
    customer_id: input.customerId,
    label: 'Principal',
    recipient_name: cleanText(input.address.recipientName) ?? input.name,
    phone: cleanDigits(input.address.phone) ?? cleanDigits(input.phone) ?? null,
    postal_code: cleanDigits(input.address.postalCode) ?? null,
    street: cleanText(input.address.street) ?? null,
    number: cleanText(input.address.number) ?? null,
    complement: cleanText(input.address.complement) ?? null,
    district: cleanText(input.address.district) ?? null,
    city: cleanText(input.address.city) ?? null,
    state: cleanText(input.address.state)?.toUpperCase() ?? null,
    country: cleanText(input.address.country) ?? 'BR',
    is_default: true,
    updated_at: new Date().toISOString(),
  };
}

function hasAddressData(address: CustomerAddressInput | undefined) {
  if (!address) {
    return false;
  }

  return Object.values(address).some((value) => Boolean(cleanText(value)));
}

async function getDefaultAddressesByCustomerId(
  storeId: string,
  customerIds: string[]
) {
  const supabase = createOptionalAdminClient();

  if (!supabase || customerIds.length === 0) {
    return new Map<string, CustomerAddress>();
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('store_id', storeId)
    .in('customer_id', customerIds)
    .eq('is_default', true);

  if (error || !data) {
    return new Map<string, CustomerAddress>();
  }

  return (data as CustomerAddressRow[]).reduce((accumulator, row) => {
    if (!accumulator.has(row.customer_id)) {
      accumulator.set(row.customer_id, mapAddress(row));
    }

    return accumulator;
  }, new Map<string, CustomerAddress>());
}

export async function listCustomersFromRepository(
  storeId: string
): Promise<CustomerListItem[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data: customerRows, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false });

  if (customerError || !customerRows) {
    return [];
  }

  const customers = customerRows as CustomerRow[];
  const customerIds = customers.map((customer) => customer.id);

  if (customerIds.length === 0) {
    return [];
  }

  const [addressesByCustomerId, metricsResult] = await Promise.all([
    getDefaultAddressesByCustomerId(storeId, customerIds),
    supabase
      .from('orders')
      .select('customer_id, order_number, total, created_at')
      .eq('store_id', storeId)
      .in('customer_id', customerIds),
  ]);

  const metrics = new Map<
    string,
    {
      ordersCount: number;
      totalSpent: number;
      lastPurchaseAt?: string;
      lastOrderNumber?: string;
    }
  >();

  if (!metricsResult.error && metricsResult.data) {
    (metricsResult.data as OrderMetricRow[]).forEach((order) => {
      if (!order.customer_id) {
        return;
      }

      const current = metrics.get(order.customer_id) ?? {
        ordersCount: 0,
        totalSpent: 0,
      };
      const createdAt = order.created_at ?? fallbackDate;
      const isLatest =
        !current.lastPurchaseAt ||
        new Date(createdAt).getTime() > new Date(current.lastPurchaseAt).getTime();

      metrics.set(order.customer_id, {
        ordersCount: current.ordersCount + 1,
        totalSpent: current.totalSpent + toNumber(order.total),
        lastPurchaseAt: isLatest ? createdAt : current.lastPurchaseAt,
        lastOrderNumber: isLatest ? order.order_number : current.lastOrderNumber,
      });
    });
  }

  return customers.map((row) => {
    const customer = mapCustomer(row, addressesByCustomerId.get(row.id));
    const metric = metrics.get(row.id);

    return {
      ...customer,
      ordersCount: metric?.ordersCount ?? 0,
      totalSpent: metric?.totalSpent ?? 0,
      lastPurchaseAt: metric?.lastPurchaseAt,
      lastOrderNumber: metric?.lastOrderNumber,
    };
  });
}

export async function upsertCustomerInRepository(
  input: CustomerInput
): Promise<Customer> {
  const supabase = createOptionalAdminClient();
  const payload = buildCustomerPayload(input);

  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      storeId: input.storeId,
      name: payload.name,
      email: payload.email ?? undefined,
      phone: payload.phone ?? undefined,
      document: payload.document ?? undefined,
      source: input.source ?? 'manual',
      acceptsMarketing: input.acceptsMarketing ?? false,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let existing: CustomerRow | null = null;

  if (payload.document) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', input.storeId)
      .eq('document', payload.document)
      .maybeSingle();

    existing = (data as CustomerRow | null) ?? null;
  }

  if (!existing && payload.email) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', input.storeId)
      .eq('email', payload.email)
      .maybeSingle();

    existing = (data as CustomerRow | null) ?? null;
  }

  const result = existing
    ? await supabase
        .from('customers')
        .update(payload)
        .eq('id', existing.id)
        .eq('store_id', input.storeId)
        .select('*')
        .single()
    : await supabase
        .from('customers')
        .insert(payload)
        .select('*')
        .single();

  if (result.error || !result.data) {
    throw new Error('Unable to persist customer.');
  }

  const customerRow = result.data as CustomerRow;
  let defaultAddress: CustomerAddress | undefined;

  if (hasAddressData(input.address)) {
    const addressPayload = buildAddressPayload({
      storeId: input.storeId,
      customerId: customerRow.id,
      name: customerRow.name,
      phone: customerRow.phone ?? undefined,
      address: input.address!,
    });

    const { data: existingAddress } = await supabase
      .from('customer_addresses')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('customer_id', customerRow.id)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    const addressResult = existingAddress
      ? await supabase
          .from('customer_addresses')
          .update(addressPayload)
          .eq('id', existingAddress.id)
          .eq('store_id', input.storeId)
          .select('*')
          .single()
      : await supabase
          .from('customer_addresses')
          .insert(addressPayload)
          .select('*')
          .single();

    if (!addressResult.error && addressResult.data) {
      defaultAddress = mapAddress(addressResult.data as CustomerAddressRow);
    }
  } else {
    defaultAddress = (await getDefaultAddressesByCustomerId(
      input.storeId,
      [customerRow.id]
    )).get(customerRow.id);
  }

  return mapCustomer(customerRow, defaultAddress);
}
