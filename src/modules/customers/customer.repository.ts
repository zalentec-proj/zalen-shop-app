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
import type { CustomerType } from '@/modules/pricing/pricing.types';
import { normalizeAdminQuery, toAdminPaginatedResult, type AdminPaginatedResult, type AdminPaginationInput } from '@/modules/admin/admin-pagination';

type CustomerRow = {
  id: string;
  store_id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  customer_type: string | null;
  legal_name: string | null;
  state_registration: string | null;
  state_registration_exempt: boolean | null;
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
  payment_status: string | null;
};

export type CustomerListResult = {
  data: CustomerListItem[];
  source: 'supabase' | 'unavailable';
};

export interface AdminCustomerFilters extends AdminPaginationInput {
  q?: string;
  status?: 'all' | 'pf' | 'pj';
}

export type AdminCustomerPageResult = AdminPaginatedResult<CustomerListItem> & {
  source: CustomerListResult['source'];
};

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const customerFields =
  'id,store_id,auth_user_id,name,email,phone,document,customer_type,legal_name,state_registration,state_registration_exempt,source,accepts_marketing,notes,created_at,updated_at';
const customerAddressFields =
  'id,store_id,customer_id,label,recipient_name,phone,postal_code,street,number,complement,district,city,state,country,is_default,created_at,updated_at';

export class CustomerPersistenceError extends Error {
  readonly safeReason: string;

  constructor(reason: string, error?: RepositoryError | null) {
    super('customer_persistence_failed');
    this.name = 'CustomerPersistenceError';
    const signal = getSafeRepositoryErrorSignal(error);
    this.safeReason = signal ? `${reason}:${signal}` : reason;
  }
}

const fallbackDate = new Date(0).toISOString();
const customerSources: CustomerSource[] = ['manual', 'checkout', 'integration'];
const customerTypes: CustomerType[] = ['pf', 'pj'];

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

function toCustomerType(value: string | null | undefined): CustomerType {
  return customerTypes.includes(value as CustomerType)
    ? (value as CustomerType)
    : 'pf';
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSafeRepositoryErrorSignal(error: RepositoryError | null | undefined) {
  if (error?.code) {
    return error.code;
  }

  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('fetch failed') || text.includes('enotfound')) {
    return 'fetch_failed';
  }

  if (text.includes('permission denied')) {
    return 'permission_denied';
  }

  if (text.includes('does not exist')) {
    return 'schema_mismatch';
  }

  return undefined;
}

function logCustomerRepositoryError(
  stage: string,
  error: RepositoryError | null | undefined
) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const safeSignal = getSafeRepositoryErrorSignal(error) ?? 'unknown';

  console.warn('[customers] repository query failed', {
    stage,
    signal: safeSignal,
    code: error?.code || undefined,
    message: error?.message
      ? error.message.replace(/\s+/g, ' ').slice(0, 180)
      : undefined,
    details: error?.details
      ? error.details.replace(/\s+/g, ' ').slice(0, 180)
      : undefined,
    hint: error?.hint
      ? error.hint.replace(/\s+/g, ' ').slice(0, 180)
      : undefined,
  });
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
    authUserId: row.auth_user_id ?? undefined,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    document: row.document ?? undefined,
    customerType: toCustomerType(row.customer_type),
    legalName: row.legal_name ?? undefined,
    stateRegistration: row.state_registration ?? undefined,
    stateRegistrationExempt: row.state_registration_exempt ?? false,
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
    auth_user_id: cleanText(input.authUserId) ?? null,
    name: cleanText(input.name) ?? 'Cliente sem nome',
    email: cleanEmail(input.email) ?? null,
    phone: cleanDigits(input.phone) ?? null,
    document: cleanDigits(input.document) ?? null,
    customer_type: input.customerType ?? 'pf',
    legal_name: cleanText(input.legalName) ?? null,
    state_registration: cleanText(input.stateRegistration) ?? null,
    state_registration_exempt: input.stateRegistrationExempt ?? false,
    source: input.source ?? 'manual',
    accepts_marketing: input.acceptsMarketing ?? false,
    notes: cleanText(input.notes) ?? null,
    updated_at: new Date().toISOString(),
  };
}

function getSafeCustomerUpdatePayload(input: {
  payload: ReturnType<typeof buildCustomerPayload>;
  existing: CustomerRow;
  emailOwner?: CustomerRow | null;
  documentOwner?: CustomerRow | null;
}) {
  const nextPayload = { ...input.payload };

  if (
    input.emailOwner &&
    input.emailOwner.id !== input.existing.id &&
    nextPayload.email
  ) {
    nextPayload.email = input.existing.email;
  }

  if (
    input.documentOwner &&
    input.documentOwner.id !== input.existing.id &&
    nextPayload.document
  ) {
    nextPayload.document = input.existing.document;
  }

  return nextPayload;
}

function buildAddressPayload(input: {
  storeId: string;
  customerId: string;
  name: string;
  phone?: string;
  address: CustomerAddressInput;
  isDefault?: boolean;
}) {
  return {
    store_id: input.storeId,
    customer_id: input.customerId,
    label: cleanText(input.address.label) ?? 'Principal',
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
    is_default: input.isDefault ?? true,
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
    .select(customerAddressFields)
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

export async function listCustomerAddressesFromRepository(input: {
  storeId: string;
  customerId: string;
}): Promise<CustomerAddress[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .select(customerAddressFields)
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error || !data) {
    if (error) {
      logCustomerRepositoryError('list_customer_addresses', error);
    }

    return [];
  }

  return (data as CustomerAddressRow[]).map(mapAddress);
}

export async function upsertCustomerAddressInRepository(input: {
  storeId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  addressId?: string;
  address: CustomerAddressInput;
  isDefault?: boolean;
}): Promise<CustomerAddress> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new CustomerPersistenceError('supabase_admin_unavailable');
  }

  const existingAddresses = await listCustomerAddressesFromRepository({
    storeId: input.storeId,
    customerId: input.customerId,
  });
  const shouldBeDefault = input.isDefault ?? existingAddresses.length === 0;
  const payload = buildAddressPayload({
    storeId: input.storeId,
    customerId: input.customerId,
    name: input.customerName,
    phone: input.customerPhone,
    address: input.address,
    isDefault: shouldBeDefault,
  });

  if (shouldBeDefault) {
    const { error } = await supabase
      .from('customer_addresses')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('store_id', input.storeId)
      .eq('customer_id', input.customerId);

    if (error) {
      logCustomerRepositoryError('clear_default_customer_address', error);
      throw new CustomerPersistenceError('clear_default_customer_address', error);
    }
  }

  const result = input.addressId
    ? await supabase
        .from('customer_addresses')
        .update(payload)
        .eq('id', input.addressId)
        .eq('store_id', input.storeId)
        .eq('customer_id', input.customerId)
        .select(customerAddressFields)
        .single()
    : await supabase
        .from('customer_addresses')
        .insert(payload)
        .select(customerAddressFields)
        .single();

  if (result.error || !result.data) {
    logCustomerRepositoryError('upsert_customer_address', result.error);
    throw new CustomerPersistenceError('upsert_customer_address', result.error);
  }

  return mapAddress(result.data as CustomerAddressRow);
}

export async function setDefaultCustomerAddressInRepository(input: {
  storeId: string;
  customerId: string;
  addressId: string;
}): Promise<boolean> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const { data: address, error: addressError } = await supabase
    .from('customer_addresses')
    .select('id')
    .eq('id', input.addressId)
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId)
    .maybeSingle();

  if (addressError || !address) {
    if (addressError) {
      logCustomerRepositoryError('lookup_default_customer_address', addressError);
    }

    return false;
  }

  const { error: clearError } = await supabase
    .from('customer_addresses')
    .update({
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId);

  if (clearError) {
    logCustomerRepositoryError('clear_default_customer_address', clearError);
    return false;
  }

  const { error: setError } = await supabase
    .from('customer_addresses')
    .update({
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.addressId)
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId);

  if (setError) {
    logCustomerRepositoryError('set_default_customer_address', setError);
    return false;
  }

  return true;
}

export async function deleteCustomerAddressInRepository(input: {
  storeId: string;
  customerId: string;
  addressId: string;
}): Promise<boolean> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const { data: address, error: lookupError } = await supabase
    .from('customer_addresses')
    .select('id,is_default')
    .eq('id', input.addressId)
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId)
    .maybeSingle();

  if (lookupError || !address) {
    if (lookupError) {
      logCustomerRepositoryError('lookup_delete_customer_address', lookupError);
    }

    return false;
  }

  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', input.addressId)
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId);

  if (error) {
    logCustomerRepositoryError('delete_customer_address', error);
    return false;
  }

  if (address.is_default) {
    const { data: fallbackAddress } = await supabase
      .from('customer_addresses')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('customer_id', input.customerId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackAddress?.id) {
      await setDefaultCustomerAddressInRepository({
        storeId: input.storeId,
        customerId: input.customerId,
        addressId: String(fallbackAddress.id),
      });
    }
  }

  return true;
}

export async function listCustomersFromRepository(
  storeId: string
): Promise<CustomerListItem[]> {
  return (await listCustomersWithSourceFromRepository(storeId)).data;
}

export async function listCustomersWithSourceFromRepository(
  storeId: string
): Promise<CustomerListResult> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return { data: [], source: 'unavailable' };
  }

  const { data: customerRows, error: customerError } = await supabase
    .from('customers')
    .select(customerFields)
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false });

  if (customerError || !customerRows) {
    return { data: [], source: 'unavailable' };
  }

  const customers = customerRows as CustomerRow[];
  const customerIds = customers.map((customer) => customer.id);

  if (customerIds.length === 0) {
    return { data: [], source: 'supabase' };
  }

  const [addressesByCustomerId, metricsResult] = await Promise.all([
    getDefaultAddressesByCustomerId(storeId, customerIds),
    supabase
      .from('orders')
      .select('customer_id, order_number, total, created_at, payment_status')
      .eq('store_id', storeId)
      .eq('payment_status', 'paid')
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
  } else if (metricsResult.error) {
    logCustomerRepositoryError('list_customer_purchase_metrics', metricsResult.error);
  }

  return {
    data: customers.map((row) => {
      const customer = mapCustomer(row, addressesByCustomerId.get(row.id));
      const metric = metrics.get(row.id);

      return {
        ...customer,
        ordersCount: metric?.ordersCount ?? 0,
        totalSpent: metric?.totalSpent ?? 0,
        lastPurchaseAt: metric?.lastPurchaseAt,
        lastOrderNumber: metric?.lastOrderNumber,
      };
    }),
    source: metricsResult.error ? 'unavailable' : 'supabase',
  };
}

export async function listCustomersPageFromRepository(
  storeId: string,
  filters: AdminCustomerFilters
): Promise<AdminCustomerPageResult> {
  const supabase = createOptionalAdminClient();
  if (!supabase) return { ...toAdminPaginatedResult([], 0, filters), source: 'unavailable' };

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const q = normalizeAdminQuery(filters.q);
  let query = supabase.from('customers').select(customerFields, { count: 'exact' }).eq('store_id', storeId);
  if (filters.status && filters.status !== 'all') query = query.eq('customer_type', filters.status);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, to);
  if (error || !data) return { ...toAdminPaginatedResult([], 0, filters), source: 'unavailable' };

  const rows = data as CustomerRow[];
  const ids = rows.map((row) => row.id);
  const [addresses, metricsResult] = await Promise.all([
    getDefaultAddressesByCustomerId(storeId, ids),
    ids.length
      ? supabase.from('orders').select('customer_id,order_number,total,created_at,payment_status').eq('store_id', storeId).eq('payment_status', 'paid').in('customer_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const metrics = new Map<string, { ordersCount: number; totalSpent: number; lastPurchaseAt?: string; lastOrderNumber?: string }>();
  for (const order of (metricsResult.data as OrderMetricRow[] | null) ?? []) {
    if (!order.customer_id) continue;
    const current = metrics.get(order.customer_id) ?? { ordersCount: 0, totalSpent: 0 };
    const createdAt = order.created_at ?? fallbackDate;
    const latest = !current.lastPurchaseAt || createdAt > current.lastPurchaseAt;
    metrics.set(order.customer_id, {
      ordersCount: current.ordersCount + 1,
      totalSpent: current.totalSpent + toNumber(order.total),
      lastPurchaseAt: latest ? createdAt : current.lastPurchaseAt,
      lastOrderNumber: latest ? order.order_number : current.lastOrderNumber,
    });
  }
  const items = rows.map((row) => {
    const customer = mapCustomer(row, addresses.get(row.id));
    const metric = metrics.get(row.id);
    return { ...customer, ordersCount: metric?.ordersCount ?? 0, totalSpent: metric?.totalSpent ?? 0, lastPurchaseAt: metric?.lastPurchaseAt, lastOrderNumber: metric?.lastOrderNumber };
  });
  return { ...toAdminPaginatedResult(items, count ?? 0, filters), source: 'supabase' };
}

export async function findCustomerByCheckoutIdentifierFromRepository(input: {
  storeId: string;
  identifier: string;
}): Promise<Customer | null> {
  const supabase = createOptionalAdminClient();
  const email = cleanEmail(input.identifier);
  const document = cleanDigits(input.identifier);

  if (!supabase || (!email && !document)) {
    return null;
  }

  let query = supabase
    .from('customers')
    .select(customerFields)
    .eq('store_id', input.storeId)
    .limit(1);

  if (document && document.length >= 11) {
    query = query.eq('document', document);
  } else if (email) {
    query = query.eq('email', email);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    if (error) {
      logCustomerRepositoryError('checkout_identifier_lookup', error);
    }

    return null;
  }

  const customerRow = data as CustomerRow;
  const defaultAddress = (await getDefaultAddressesByCustomerId(input.storeId, [
    customerRow.id,
  ])).get(customerRow.id);

  return mapCustomer(customerRow, defaultAddress);
}

export async function findCustomerByAuthUserIdFromRepository(input: {
  storeId: string;
  authUserId: string;
}): Promise<Customer | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('customers')
    .select(customerFields)
    .eq('store_id', input.storeId)
    .eq('auth_user_id', input.authUserId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logCustomerRepositoryError('auth_user_lookup', error);
    }

    return null;
  }

  const customerRow = data as CustomerRow;
  const defaultAddress = (await getDefaultAddressesByCustomerId(input.storeId, [
    customerRow.id,
  ])).get(customerRow.id);

  return mapCustomer(customerRow, defaultAddress);
}

export async function findCustomerByEmailFromRepository(input: {
  storeId: string;
  email: string;
}): Promise<Customer | null> {
  const supabase = createOptionalAdminClient();
  const email = cleanEmail(input.email);

  if (!supabase || !email) {
    return null;
  }

  const { data, error } = await supabase
    .from('customers')
    .select(customerFields)
    .eq('store_id', input.storeId)
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logCustomerRepositoryError('email_lookup', error);
    }

    return null;
  }

  const customerRow = data as CustomerRow;
  const defaultAddress = (await getDefaultAddressesByCustomerId(input.storeId, [
    customerRow.id,
  ])).get(customerRow.id);

  return mapCustomer(customerRow, defaultAddress);
}

export async function linkCustomerAuthUserInRepository(input: {
  storeId: string;
  customerId: string;
  authUserId: string;
}): Promise<Customer | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from('customers')
    .select(customerFields)
    .eq('store_id', input.storeId)
    .eq('id', input.customerId)
    .maybeSingle();

  if (existingError || !existing) {
    if (existingError) {
      logCustomerRepositoryError('link_auth_user_lookup', existingError);
    }

    return null;
  }

  const existingCustomer = existing as CustomerRow;

  if (
    existingCustomer.auth_user_id &&
    existingCustomer.auth_user_id !== input.authUserId
  ) {
    return null;
  }

  const { data, error } = await supabase
    .from('customers')
    .update({
      auth_user_id: input.authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', input.storeId)
    .eq('id', input.customerId)
    .select(customerFields)
    .single();

  if (error || !data) {
    if (error) {
      logCustomerRepositoryError('link_auth_user_update', error);
    }

    return null;
  }

  const customerRow = data as CustomerRow;
  const defaultAddress = (await getDefaultAddressesByCustomerId(input.storeId, [
    customerRow.id,
  ])).get(customerRow.id);

  return mapCustomer(customerRow, defaultAddress);
}

export async function upsertCustomerInRepository(
  input: CustomerInput
): Promise<Customer> {
  const supabase = createOptionalAdminClient();
  const payload = buildCustomerPayload(input);

  if (!supabase) {
    if (input.source === 'checkout') {
      throw new CustomerPersistenceError('supabase_admin_unavailable');
    }

    return {
      id: crypto.randomUUID(),
      storeId: input.storeId,
      authUserId: payload.auth_user_id ?? undefined,
      name: payload.name,
      email: payload.email ?? undefined,
      phone: payload.phone ?? undefined,
      document: payload.document ?? undefined,
      customerType: payload.customer_type,
      legalName: payload.legal_name ?? undefined,
      stateRegistration: payload.state_registration ?? undefined,
      stateRegistrationExempt: payload.state_registration_exempt,
      source: input.source ?? 'manual',
      acceptsMarketing: input.acceptsMarketing ?? false,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let existing: CustomerRow | null = null;
  let emailOwner: CustomerRow | null = null;
  let documentOwner: CustomerRow | null = null;

  if (payload.auth_user_id) {
    const { data, error } = await supabase
      .from('customers')
      .select(customerFields)
      .eq('store_id', input.storeId)
      .eq('auth_user_id', payload.auth_user_id)
      .maybeSingle();

    if (error) {
      logCustomerRepositoryError('lookup_auth_user', error);
      throw new CustomerPersistenceError('lookup_auth_user', error);
    }

    existing = (data as CustomerRow | null) ?? null;
  }

  if (payload.document) {
    const { data, error } = await supabase
      .from('customers')
      .select(customerFields)
      .eq('store_id', input.storeId)
      .eq('document', payload.document)
      .maybeSingle();

    if (error) {
      logCustomerRepositoryError('lookup_document', error);
      throw new CustomerPersistenceError('lookup_document', error);
    }

    documentOwner = (data as CustomerRow | null) ?? null;
    existing = existing ?? documentOwner;
  }

  if (payload.email) {
    const { data, error } = await supabase
      .from('customers')
      .select(customerFields)
      .eq('store_id', input.storeId)
      .eq('email', payload.email)
      .maybeSingle();

    if (error) {
      logCustomerRepositoryError('lookup_email', error);
      throw new CustomerPersistenceError('lookup_email', error);
    }

    emailOwner = (data as CustomerRow | null) ?? null;
    existing = existing ?? emailOwner;
  }

  const identityConflict = [documentOwner, emailOwner].some(
    (owner) =>
      Boolean(
        owner &&
          ((existing && owner.id !== existing.id) ||
            (owner.auth_user_id &&
              payload.auth_user_id &&
              owner.auth_user_id !== payload.auth_user_id))
      )
  );

  if (identityConflict) {
    throw new CustomerPersistenceError('customer_identity_conflict');
  }

  const updatePayload = existing
    ? getSafeCustomerUpdatePayload({
        payload,
        existing,
        emailOwner,
        documentOwner,
      })
    : payload;

  const result = existing
    ? await supabase
        .from('customers')
        .update(updatePayload)
        .eq('id', existing.id)
        .eq('store_id', input.storeId)
        .select(customerFields)
        .single()
    : await supabase
        .from('customers')
        .insert(payload)
        .select(customerFields)
        .single();

  if (result.error || !result.data) {
    logCustomerRepositoryError('persist_customer', result.error);
    throw new CustomerPersistenceError('persist_customer', result.error);
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

    const { data: existingAddress, error: existingAddressError } = await supabase
      .from('customer_addresses')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('customer_id', customerRow.id)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (existingAddressError) {
      logCustomerRepositoryError(
        'lookup_customer_address',
        existingAddressError
      );
      throw new CustomerPersistenceError(
        'lookup_customer_address',
        existingAddressError
      );
    }

    const addressResult = existingAddress
      ? await supabase
          .from('customer_addresses')
          .update(addressPayload)
          .eq('id', existingAddress.id)
          .eq('store_id', input.storeId)
          .select(customerAddressFields)
          .single()
      : await supabase
          .from('customer_addresses')
          .insert(addressPayload)
          .select(customerAddressFields)
          .single();

    if (addressResult.error || !addressResult.data) {
      logCustomerRepositoryError(
        'persist_customer_address',
        addressResult.error
      );
      throw new CustomerPersistenceError(
        'persist_customer_address',
        addressResult.error
      );
    }

    defaultAddress = mapAddress(addressResult.data as CustomerAddressRow);
  } else {
    defaultAddress = (await getDefaultAddressesByCustomerId(
      input.storeId,
      [customerRow.id]
    )).get(customerRow.id);
  }

  return mapCustomer(customerRow, defaultAddress);
}
