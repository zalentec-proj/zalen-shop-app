export type ShipmentStatus =
  | 'pending'
  | 'posted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'cancelled';

export interface Shipment {
  id: string;
  storeId: string;
  orderId: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertManualShipmentInput {
  storeId: string;
  orderId: string;
  shipmentId?: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  status?: ShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
}
