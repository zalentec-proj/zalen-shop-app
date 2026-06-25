import 'server-only';

import {
  getShipmentsByOrderIdFromRepository,
  listShipmentsByOrderIdsFromRepository,
  upsertManualShipmentInRepository,
} from './shipment.repository';
import type { Shipment, UpsertManualShipmentInput } from './shipment.types';

export type { Shipment, ShipmentStatus } from './shipment.types';

export async function listShipmentsByOrderIds(input: {
  storeId: string;
  orderIds: string[];
}): Promise<Shipment[]> {
  return listShipmentsByOrderIdsFromRepository(input);
}

export async function getShipmentsByOrderId(input: {
  storeId: string;
  orderId: string;
}): Promise<Shipment[]> {
  return getShipmentsByOrderIdFromRepository(input);
}

export async function upsertManualShipment(
  input: UpsertManualShipmentInput
): Promise<Shipment | null> {
  return upsertManualShipmentInRepository(input);
}
