import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  Shipment,
  ShipmentStatus,
  UpsertManualShipmentInput,
} from './shipment.types';

type ShipmentRow = {
  id: string;
  store_id: string;
  order_id: string;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
    carrier: row.carrier ?? undefined,
    trackingCode: row.tracking_code ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    status: toStatus(row.status),
    shippedAt: row.shipped_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
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
