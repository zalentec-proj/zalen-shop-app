export const EVOLUTION_WHATSAPP_PROVIDER_KEY = 'evolution_whatsapp' as const;
export const EVOLUTION_WHATSAPP_ENVIRONMENT = 'production' as const;

export type WhatsAppConnectionStatus =
  | 'not_configured'
  | 'awaiting_qr'
  | 'connected'
  | 'disconnected'
  | 'error';

export type WhatsAppNotificationEvent =
  | 'access_code'
  | 'order_received'
  | 'payment_pending'
  | 'payment_approved'
  | 'payment_failed'
  | 'shipment_pending'
  | 'shipment_posted'
  | 'shipment_in_transit'
  | 'shipment_out_for_delivery'
  | 'shipment_delivered'
  | 'shipment_exception'
  | 'shipment_cancelled'
  | 'operator_order_received'
  | 'operator_payment_approved';

export const customerWhatsAppEvents: WhatsAppNotificationEvent[] = [
  'access_code',
  'order_received',
  'payment_pending',
  'payment_approved',
  'payment_failed',
  'shipment_pending',
  'shipment_posted',
  'shipment_in_transit',
  'shipment_out_for_delivery',
  'shipment_delivered',
  'shipment_exception',
  'shipment_cancelled',
];

export const operatorWhatsAppEvents: WhatsAppNotificationEvent[] = [
  'operator_order_received',
  'operator_payment_approved',
];

export interface EvolutionWhatsAppCredentials {
  provider: typeof EVOLUTION_WHATSAPP_PROVIDER_KEY;
  instanceToken?: string;
  webhookSecret: string;
}

export interface EvolutionWhatsAppSettings {
  instanceName?: string;
  instanceId?: string;
  ownerPhoneMasked?: string;
  connectionStatus?: WhatsAppConnectionStatus;
  connectedAt?: string;
  lastConnectionCheckAt?: string;
  lastConnectionErrorCode?: string;
  alertPhoneE164?: string;
  notificationsEnabled?: boolean;
  enabledEvents?: WhatsAppNotificationEvent[];
  webhookConfiguredAt?: string;
}

export interface EvolutionInstanceSummary {
  id?: string;
  name: string;
  connectionStatus: 'open' | 'close' | 'connecting' | 'unknown';
  ownerPhone?: string;
  profileName?: string;
}

export interface EvolutionConnectionResult {
  status: 'open' | 'close' | 'connecting' | 'unknown';
  qrCodeDataUrl?: string;
  ownerPhone?: string;
}

export interface WhatsAppAdminState {
  configured: boolean;
  encryptionConfigured: boolean;
  connectionStatus: WhatsAppConnectionStatus;
  instanceName?: string;
  instanceId?: string;
  ownerPhoneMasked?: string;
  connectedAt?: string;
  lastConnectionCheckAt?: string;
  lastConnectionErrorCode?: string;
  alertPhoneMasked?: string;
  notificationsEnabled: boolean;
  enabledEvents: WhatsAppNotificationEvent[];
  webhookConfigured: boolean;
  warnings: string[];
}

export type WhatsAppDeliveryStatus =
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'delivered'
  | 'failed'
  | 'skipped';

export interface WhatsAppDelivery {
  id: string;
  storeId: string;
  eventKey: WhatsAppNotificationEvent;
  entityType: string;
  entityId?: string;
  recipientKind: 'customer' | 'store_operator';
  customerId?: string;
  recipientPhoneE164: string;
  messageText: string;
  idempotencyKey: string;
  providerMessageId?: string;
  status: WhatsAppDeliveryStatus;
  attemptCount: number;
  nextAttemptAt?: string;
  lockedAt?: string;
  expiresAt?: string;
  acceptedAt?: string;
  deliveredAt?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}
