import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  Shipment,
  ShipmentStatus,
  ShippingMethod,
  ShippingFreeReason,
  ShippingOrigin,
  ShippingQuote,
  ShippingRate,
  UpdateShippingMethodInput,
  UpsertShippingOriginInput,
  UpsertManualShipmentInput,
} from './shipment.types';

type ShipmentRow = {
  id: string;
  store_id: string;
  order_id: string;
  provider_key: string | null;
  external_shipment_id: string | null;
  external_label_id: string | null;
  label_url: string | null;
  label_format: string | null;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  metadata_json: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type ShippingOriginRow = {
  id: string;
  store_id: string;
  sender_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ShippingMethodRow = {
  id: string;
  store_id: string;
  kind: string;
  provider_key: string | null;
  service_code: string;
  name: string;
  description: string | null;
  status: string | null;
  sort_order: number | null;
  price: number | string | null;
  free_over_subtotal: number | string | null;
  min_delivery_days: number | null;
  max_delivery_days: number | null;
  settings_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type ShippingQuoteRow = {
  id: string;
  store_id: string;
  method_id: string | null;
  provider_key: string | null;
  service_code: string;
  carrier_name: string | null;
  service_name: string;
  price: number | string | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  destination_postal_code: string;
  items_hash: string;
  expires_at: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullableText(value: string | undefined) {
  return cleanText(value) ?? null;
}

function toStatus(value: string | null | undefined): ShipmentStatus {
  const allowed: ShipmentStatus[] = [
    'pending',
    'posted',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'exception',
    'cancelled',
  ];

  return allowed.includes(value as ShipmentStatus)
    ? (value as ShipmentStatus)
    : 'pending';
}

function mapShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    providerKey: row.provider_key ?? undefined,
    externalShipmentId: row.external_shipment_id ?? undefined,
    externalLabelId: row.external_label_id ?? undefined,
    labelUrl: row.label_url ?? undefined,
    labelFormat: row.label_format ?? undefined,
    carrier: row.carrier ?? undefined,
    trackingCode: row.tracking_code ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    status: toStatus(row.status),
    shippedAt: row.shipped_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    metadata: row.metadata_json ?? {},
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function mapOrigin(row: ShippingOriginRow): ShippingOrigin {
  return {
    id: row.id,
    storeId: row.store_id,
    senderName: row.sender_name,
    postalCode: row.postal_code,
    street: row.street,
    number: row.number,
    complement: row.complement ?? undefined,
    district: row.district,
    city: row.city,
    state: row.state,
    country: row.country,
    phone: row.phone ?? undefined,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function mapMethod(row: ShippingMethodRow): ShippingMethod {
  const kind = ['pickup', 'fixed', 'manual', 'external'].includes(row.kind)
    ? row.kind
    : 'manual';

  return {
    id: row.id,
    storeId: row.store_id,
    kind: kind as ShippingMethod['kind'],
    providerKey: row.provider_key ?? undefined,
    serviceCode: row.service_code,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status === 'active' ? 'active' : 'disabled',
    sortOrder: row.sort_order ?? 0,
    price: toNumber(row.price),
    freeOverSubtotal:
      row.free_over_subtotal === null ? undefined : toNumber(row.free_over_subtotal),
    minDeliveryDays: row.min_delivery_days ?? undefined,
    maxDeliveryDays: row.max_delivery_days ?? undefined,
    settings: row.settings_json ?? {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function mapQuote(row: ShippingQuoteRow): ShippingQuote {
  const rawPayload = row.raw_payload ?? {};
  const deliveryTimeLabel =
    typeof rawPayload.deliveryTimeLabel === 'string'
      ? rawPayload.deliveryTimeLabel
      : undefined;
  const freeShippingReason =
    rawPayload.freeShippingReason === 'product'
      ? (rawPayload.freeShippingReason as ShippingFreeReason)
      : undefined;

  return {
    id: row.id,
    storeId: row.store_id,
    methodId: row.method_id ?? undefined,
    providerKey: row.provider_key ?? undefined,
    serviceCode: row.service_code,
    carrierName: row.carrier_name ?? undefined,
    serviceName: row.service_name,
    price: toNumber(row.price),
    freeShippingReason,
    deliveryMinDays: row.delivery_min_days ?? undefined,
    deliveryMaxDays: row.delivery_max_days ?? undefined,
    deliveryTimeLabel,
    destinationPostalCode: row.destination_postal_code,
    itemsHash: row.items_hash,
    expiresAt: row.expires_at,
    rawPayload,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

export async function getShippingOriginFromRepository(
  storeId: string
): Promise<ShippingOrigin | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_shipping_origins')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapOrigin(data as ShippingOriginRow);
}

export async function upsertShippingOriginInRepository(
  input: UpsertShippingOriginInput
): Promise<ShippingOrigin | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const payload = {
    store_id: input.storeId,
    sender_name: input.senderName.trim(),
    postal_code: input.postalCode.trim(),
    street: input.street.trim(),
    number: input.number.trim(),
    complement: cleanNullableText(input.complement),
    district: input.district.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    country: (input.country ?? 'BR').trim().toUpperCase(),
    phone: cleanNullableText(input.phone),
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('store_shipping_origins')
    .upsert(payload, { onConflict: 'store_id' })
    .select('*')
    .single();

  if (error || !data) {
    return null;
  }

  return mapOrigin(data as ShippingOriginRow);
}

export async function listShippingMethodsFromRepository(
  storeId: string
): Promise<ShippingMethod[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('shipping_methods')
    .select('*')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ShippingMethodRow[]).map(mapMethod);
}

export async function updateShippingMethodInRepository(
  input: UpdateShippingMethodInput
): Promise<ShippingMethod | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const payload: Record<string, unknown> = {
    status: input.status,
    price: input.price ?? 0,
    free_over_subtotal: input.freeOverSubtotal ?? null,
    min_delivery_days: input.minDeliveryDays ?? null,
    max_delivery_days: input.maxDeliveryDays ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('shipping_methods')
    .update(payload)
    .eq('store_id', input.storeId)
    .eq('id', input.methodId)
    .select('*')
    .single();

  if (error || !data) {
    return null;
  }

  return mapMethod(data as ShippingMethodRow);
}

export async function insertShippingQuotesInRepository(input: {
  storeId: string;
  destinationPostalCode: string;
  itemsHash: string;
  cacheKey: string;
  pricingFingerprint?: string;
  expiresAt: string;
  rates: ShippingRate[];
}): Promise<ShippingRate[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase || input.rates.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('shipping_quotes')
    .insert(
      input.rates.map((rate) => ({
        store_id: input.storeId,
        method_id: rate.methodId,
        provider_key: rate.providerKey ?? null,
        service_code: rate.serviceCode,
        carrier_name: rate.carrierName ?? null,
        service_name: rate.serviceName,
        price: rate.price,
        delivery_min_days: rate.deliveryMinDays ?? null,
        delivery_max_days: rate.deliveryMaxDays ?? null,
        destination_postal_code: input.destinationPostalCode,
        items_hash: input.itemsHash,
        expires_at: input.expiresAt,
        raw_payload: {
          kind: rate.kind,
          description: rate.description,
          deliveryTimeLabel: rate.deliveryTimeLabel,
          freeShippingReason: rate.freeShippingReason,
          cacheKey: input.cacheKey,
          pricingFingerprint: input.pricingFingerprint,
          ...(rate.rawPayload ?? {}),
        },
      }))
    )
    .select('*');

  if (error || !data) {
    return [];
  }

  const quotesByMethod = new Map(
    (data as ShippingQuoteRow[]).map((quote) => [
      `${quote.method_id ?? ''}:${quote.service_code}`,
      quote,
    ])
  );

  return input.rates.map((rate) => {
    const quote = quotesByMethod.get(`${rate.methodId}:${rate.serviceCode}`);

    return {
      ...rate,
      quoteId: quote?.id,
      expiresAt: quote?.expires_at ?? input.expiresAt,
    };
  });
}

export async function getReusableShippingQuoteRatesFromRepository(input: {
  storeId: string;
  cacheKey: string;
  minimumCreatedAt: string;
}): Promise<ShippingRate[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('shipping_quotes')
    .select('*')
    .eq('store_id', input.storeId)
    .contains('raw_payload', { cacheKey: input.cacheKey })
    .gte('created_at', input.minimumCreatedAt)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return [];
  }

  const newestCreatedAt = (data as ShippingQuoteRow[])[0].created_at;
  const newestGroup = (data as ShippingQuoteRow[]).filter(
    (quote) => quote.created_at === newestCreatedAt
  );

  return newestGroup.flatMap((quote): ShippingRate[] => {
    const rawPayload = quote.raw_payload ?? {};
    const kind = rawPayload.kind;

    if (!['pickup', 'fixed', 'manual', 'external'].includes(String(kind))) {
      return [];
    }

    return [{
      quoteId: quote.id,
      methodId: quote.method_id ?? '',
      kind: kind as ShippingRate['kind'],
      providerKey: quote.provider_key ?? undefined,
      serviceCode: quote.service_code,
      carrierName: quote.carrier_name ?? undefined,
      serviceName: quote.service_name,
      description:
        typeof rawPayload.description === 'string'
          ? rawPayload.description
          : undefined,
      price: toNumber(quote.price),
      freeShippingReason:
        rawPayload.freeShippingReason === 'product' ? 'product' : undefined,
      deliveryMinDays: quote.delivery_min_days ?? undefined,
      deliveryMaxDays: quote.delivery_max_days ?? undefined,
      deliveryTimeLabel:
        typeof rawPayload.deliveryTimeLabel === 'string'
          ? rawPayload.deliveryTimeLabel
          : undefined,
      rawPayload,
      expiresAt: quote.expires_at,
    }];
  });
}

export async function getShippingQuoteFromRepository(input: {
  storeId: string;
  quoteId: string;
}): Promise<ShippingQuote | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('shipping_quotes')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('id', input.quoteId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapQuote(data as ShippingQuoteRow);
}

export async function listShipmentsByOrderIdsFromRepository(input: {
  storeId: string;
  orderIds: string[];
}): Promise<Shipment[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase || input.orderIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('store_id', input.storeId)
    .in('order_id', input.orderIds)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ShipmentRow[]).map(mapShipment);
}

export async function getShipmentsByOrderIdFromRepository(input: {
  storeId: string;
  orderId: string;
}): Promise<Shipment[]> {
  return listShipmentsByOrderIdsFromRepository({
    storeId: input.storeId,
    orderIds: [input.orderId],
  });
}

export async function upsertManualShipmentInRepository(
  input: UpsertManualShipmentInput
): Promise<Shipment | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const payload = {
    store_id: input.storeId,
    order_id: input.orderId,
    carrier: cleanText(input.carrier) ?? null,
    tracking_code: cleanText(input.trackingCode) ?? null,
    tracking_url: cleanText(input.trackingUrl) ?? null,
    status: input.status ?? 'posted',
    shipped_at: input.shippedAt ?? null,
    delivered_at: input.deliveredAt ?? null,
    updated_at: new Date().toISOString(),
  };

  let shipmentId = input.shipmentId;

  if (!shipmentId) {
    const { data } = await supabase
      .from('shipments')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('order_id', input.orderId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    shipmentId = data?.id;
  }

  const result = shipmentId
    ? await supabase
        .from('shipments')
        .update(payload)
        .eq('store_id', input.storeId)
        .eq('id', shipmentId)
        .select('*')
        .single()
    : await supabase
        .from('shipments')
        .insert(payload)
        .select('*')
        .single();

  if (result.error || !result.data) {
    return null;
  }

  return mapShipment(result.data as ShipmentRow);
}
