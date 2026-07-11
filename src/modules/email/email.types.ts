export type EmailProvider = 'resend';

export type EmailDeliveryMode = 'platform_managed' | 'store_managed';

export type EmailDomainStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed';

export type EmailMessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'
  | 'skipped';

export type StoreEmailTemplateKey =
  | 'customer_login_code'
  | 'order_received'
  | 'payment_approved'
  | 'payment_pending'
  | 'payment_failed'
  | 'shipment_tracking'
  | 'cart_abandoned'
  | 'product_suggestions';

export interface StoreEmailSettings {
  id: string;
  storeId: string;
  provider: EmailProvider;
  mode: EmailDeliveryMode;
  status: 'active' | 'disabled';
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  domain?: string;
  domainStatus: EmailDomainStatus;
  settings?: Record<string, unknown>;
}

export interface StoreEmailMessageInput {
  storeId: string;
  templateKey: StoreEmailTemplateKey;
  recipientEmail: string;
  subject: string;
  provider?: EmailProvider;
  metadata?: Record<string, unknown>;
}

export interface SendStoreEmailInput extends StoreEmailMessageInput {
  html: string;
  text: string;
  idempotencyKey?: string;
}

export interface StoreEmailResult {
  ok: boolean;
  status: EmailMessageStatus;
  messageId?: string;
  providerMessageId?: string;
  errorCode?: string;
}
