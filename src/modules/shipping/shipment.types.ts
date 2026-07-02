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
  providerKey?: string;
  externalShipmentId?: string;
  externalLabelId?: string;
  labelUrl?: string;
  labelFormat?: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
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

export type ShippingMethodKind = 'pickup' | 'fixed' | 'manual' | 'external';

export type ShippingMethodStatus = 'active' | 'disabled';

export interface ShippingOrigin {
  id: string;
  storeId: string;
  senderName: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  country: string;
  phone?: string;
  status: ShippingMethodStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethod {
  id: string;
  storeId: string;
  kind: ShippingMethodKind;
  providerKey?: string;
  serviceCode: string;
  name: string;
  description?: string;
  status: ShippingMethodStatus;
  sortOrder: number;
  price: number;
  freeOverSubtotal?: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingRate {
  quoteId?: string;
  methodId: string;
  kind: ShippingMethodKind;
  providerKey?: string;
  serviceCode: string;
  carrierName?: string;
  serviceName: string;
  description?: string;
  price: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
  deliveryTimeLabel?: string;
  rawPayload?: Record<string, unknown>;
  expiresAt?: string;
}

export interface ShippingQuote {
  id: string;
  storeId: string;
  methodId?: string;
  providerKey?: string;
  serviceCode: string;
  carrierName?: string;
  serviceName: string;
  price: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
  deliveryTimeLabel?: string;
  destinationPostalCode: string;
  itemsHash: string;
  expiresAt: string;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingQuoteItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ShippingQuoteInput {
  storeId: string;
  subtotal: number;
  destinationPostalCode: string;
  items: ShippingQuoteItem[];
}

export interface ShippingProviderAdapter {
  providerKey: string;
  calculateRates(input: ShippingQuoteInput): Promise<ShippingRate[]>;
}

export interface UpsertShippingOriginInput {
  storeId: string;
  senderName: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  country?: string;
  phone?: string;
  status: ShippingMethodStatus;
}

export interface UpdateShippingMethodInput {
  storeId: string;
  methodId: string;
  status: ShippingMethodStatus;
  price?: number;
  freeOverSubtotal?: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}
