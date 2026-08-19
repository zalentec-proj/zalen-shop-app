import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { StoreIntegration } from '../core/store-integration.types';
import {
  EVOLUTION_WHATSAPP_ENVIRONMENT,
  EVOLUTION_WHATSAPP_PROVIDER_KEY,
} from './evolution-whatsapp.config';
import type {
  EvolutionWhatsAppSettings,
  WhatsAppDelivery,
  WhatsAppDeliveryStatus,
  WhatsAppNotificationEvent,
} from './evolution-whatsapp.types';

type IntegrationRow = {
  id: string;
  store_id: string;
  provider_key: string;
  environment: string;
  status: string;
  credentials_encrypted: string | null;
  settings_json: Record<string, unknown> | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DeliveryRow = {
  id: string;
  store_id: string;
  event_key: WhatsAppNotificationEvent;
  entity_type: string;
  entity_id: string | null;
  recipient_kind: 'customer' | 'store_operator';
  customer_id: string | null;
  recipient_phone_e164: string;
  message_text: string;
  idempotency_key: string;
  provider_message_id: string | null;
  status: WhatsAppDeliveryStatus;
  attempt_count: number | null;
  next_attempt_at: string | null;
  locked_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  last_error_code: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export interface EvolutionWhatsAppIntegration extends StoreIntegration {
  credentialsEncrypted?: string;
}

function requireAdminClient() {
  const supabase = createOptionalAdminClient();
  if (!supabase) throw new Error('supabase_admin_not_configured');
  return supabase;
}

function mapIntegration(row: IntegrationRow): EvolutionWhatsAppIntegration {
  return {
    id: row.id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    environment: row.environment,
    status: row.status as StoreIntegration['status'],
    credentialsEncrypted: row.credentials_encrypted ?? undefined,
    settings: row.settings_json ?? {},
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function mapDelivery(row: DeliveryRow): WhatsAppDelivery {
  return {
    id: row.id,
    storeId: row.store_id,
    eventKey: row.event_key,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    recipientKind: row.recipient_kind,
    customerId: row.customer_id ?? undefined,
    recipientPhoneE164: row.recipient_phone_e164,
    messageText: row.message_text,
    idempotencyKey: row.idempotency_key,
    providerMessageId: row.provider_message_id ?? undefined,
    status: row.status,
    attemptCount: row.attempt_count ?? 0,
    nextAttemptAt: row.next_attempt_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

export async function getEvolutionWhatsAppIntegration(storeId: string) {
  const supabase = createOptionalAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('store_integrations')
    .select('id,store_id,provider_key,environment,status,credentials_encrypted,settings_json,last_sync_at,created_at,updated_at')
    .eq('store_id', storeId)
    .eq('provider_key', EVOLUTION_WHATSAPP_PROVIDER_KEY)
    .eq('environment', EVOLUTION_WHATSAPP_ENVIRONMENT)
    .maybeSingle();
  return error || !data ? null : mapIntegration(data as IntegrationRow);
}

export async function getEvolutionWhatsAppIntegrationByInstance(instanceName: string) {
  const supabase = createOptionalAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('store_integrations')
    .select('id,store_id,provider_key,environment,status,credentials_encrypted,settings_json,last_sync_at,created_at,updated_at')
    .eq('provider_key', EVOLUTION_WHATSAPP_PROVIDER_KEY)
    .eq('environment', EVOLUTION_WHATSAPP_ENVIRONMENT)
    .contains('settings_json', { instanceName })
    .maybeSingle();
  return error || !data ? null : mapIntegration(data as IntegrationRow);
}

export async function saveEvolutionWhatsAppIntegration(input: {
  storeId: string;
  status: StoreIntegration['status'];
  settings: EvolutionWhatsAppSettings;
  credentialsEncrypted?: string | null;
}) {
  const supabase = requireAdminClient();
  const payload: Record<string, unknown> = {
    store_id: input.storeId,
    provider_key: EVOLUTION_WHATSAPP_PROVIDER_KEY,
    environment: EVOLUTION_WHATSAPP_ENVIRONMENT,
    status: input.status,
    settings_json: input.settings,
    updated_at: new Date().toISOString(),
  };
  if (input.credentialsEncrypted !== undefined) {
    payload.credentials_encrypted = input.credentialsEncrypted;
  }
  const { data, error } = await supabase
    .from('store_integrations')
    .upsert(payload, { onConflict: 'store_id,provider_key,environment' })
    .select('id,store_id,provider_key,environment,status,credentials_encrypted,settings_json,last_sync_at,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('evolution_whatsapp_integration_save_failed');
  return mapIntegration(data as IntegrationRow);
}

export async function getCustomerWhatsAppPreference(input: {
  storeId: string;
  customerId: string;
}) {
  const supabase = createOptionalAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('customer_contact_preferences')
    .select('phone_e164,verified_at,transactional_opted_in_at,transactional_opted_out_at')
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId)
    .eq('channel', 'whatsapp')
    .maybeSingle();
  if (error || !data) return null;
  return {
    phoneE164: data.phone_e164 as string | null,
    verifiedAt: data.verified_at as string | null,
    optedInAt: data.transactional_opted_in_at as string | null,
    optedOutAt: data.transactional_opted_out_at as string | null,
  };
}

export async function upsertCustomerWhatsAppPreference(input: {
  storeId: string;
  customerId: string;
  phoneE164: string;
  optedIn: boolean;
  verifiedAt?: string | null;
}) {
  const supabase = requireAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('customer_contact_preferences').upsert(
    {
      store_id: input.storeId,
      customer_id: input.customerId,
      channel: 'whatsapp',
      phone_e164: input.phoneE164,
      verified_at: input.verifiedAt ?? null,
      transactional_opted_in_at: input.optedIn ? now : null,
      transactional_opted_out_at: input.optedIn ? null : now,
      updated_at: now,
    },
    { onConflict: 'store_id,customer_id,channel' }
  );
  if (error) throw new Error('customer_whatsapp_preference_save_failed');
}

export async function createCustomerWhatsAppVerification(input: {
  storeId: string;
  customerId: string;
  phoneE164: string;
  codeHash: string;
  expiresAt: string;
}) {
  const supabase = requireAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from('customer_contact_verifications')
    .update({ consumed_at: now })
    .eq('store_id', input.storeId)
    .eq('customer_id', input.customerId)
    .eq('channel', 'whatsapp')
    .is('consumed_at', null);
  const { data, error } = await supabase
    .from('customer_contact_verifications')
    .insert({
      store_id: input.storeId,
      customer_id: input.customerId,
      channel: 'whatsapp',
      phone_e164: input.phoneE164,
      code_hash: input.codeHash,
      expires_at: input.expiresAt,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('customer_whatsapp_verification_create_failed');
  return { id: data.id as string };
}

export async function getActiveCustomerWhatsAppVerification(input: { storeId: string; customerId: string; phoneE164: string }) {
  const supabase = createOptionalAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('customer_contact_verifications')
    .select('id,code_hash,attempts,expires_at')
    .eq('store_id', input.storeId).eq('customer_id', input.customerId).eq('channel', 'whatsapp').eq('phone_e164', input.phoneE164)
    .is('consumed_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return error || !data ? null : { id: data.id as string, codeHash: data.code_hash as string, attempts: Number(data.attempts ?? 0) };
}

export async function consumeCustomerWhatsAppVerification(input: { id: string; valid: boolean }) {
  const supabase = requireAdminClient();
  const payload = input.valid ? { consumed_at: new Date().toISOString() } : { attempts: undefined as number | undefined };
  if (!input.valid) {
    const { data } = await supabase.from('customer_contact_verifications').select('attempts').eq('id', input.id).maybeSingle();
    payload.attempts = Number(data?.attempts ?? 0) + 1;
  }
  const { error } = await supabase.from('customer_contact_verifications').update(payload).eq('id', input.id);
  if (error) throw new Error('customer_whatsapp_verification_update_failed');
}

export async function insertWhatsAppDelivery(input: {
  storeId: string;
  integrationId?: string;
  eventKey: WhatsAppNotificationEvent;
  entityType: string;
  entityId?: string;
  recipientKind: 'customer' | 'store_operator';
  customerId?: string;
  recipientPhoneE164: string;
  messageText: string;
  idempotencyKey: string;
  expiresAt?: string;
}) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_message_deliveries')
    .upsert(
      {
        store_id: input.storeId,
        integration_id: input.integrationId ?? null,
        event_key: input.eventKey,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        recipient_kind: input.recipientKind,
        customer_id: input.customerId ?? null,
        recipient_phone_e164: input.recipientPhoneE164,
        message_text: input.messageText,
        idempotency_key: input.idempotencyKey,
        expires_at: input.expiresAt ?? null,
      },
      { onConflict: 'store_id,idempotency_key', ignoreDuplicates: true }
    )
    .select('*')
    .maybeSingle();
  if (error) throw new Error('whatsapp_delivery_enqueue_failed');
  return data ? mapDelivery(data as DeliveryRow) : null;
}

export async function claimWhatsAppDelivery(id: string) {
  const supabase = requireAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('whatsapp_message_deliveries')
    .update({ status: 'processing', locked_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'queued')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .select('*')
    .maybeSingle();
  if (error) throw new Error('whatsapp_delivery_claim_failed');
  return data ? mapDelivery(data as DeliveryRow) : null;
}

export async function releaseStaleWhatsAppDeliveryClaims() {
  const supabase = createOptionalAdminClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('whatsapp_message_deliveries')
    .update({ status: 'queued', locked_at: null, next_attempt_at: now, updated_at: now })
    .eq('status', 'processing')
    .lt('locked_at', staleBefore);
  if (error) throw new Error('whatsapp_delivery_claim_recovery_failed');
}

export async function listDueWhatsAppDeliveries(limit = 30) {
  const supabase = createOptionalAdminClient();
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('whatsapp_message_deliveries')
    .select('*')
    // `accepted` means Evolution already accepted the message. It is terminal
    // for outbound retry purposes; delivery receipts may refine it to
    // `delivered`, but must never cause the same text to be sent again.
    .eq('status', 'queued')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(limit);
  return error || !data ? [] : (data as DeliveryRow[]).map(mapDelivery);
}

export async function updateWhatsAppDelivery(input: {
  id: string;
  status: WhatsAppDeliveryStatus;
  providerMessageId?: string;
  errorCode?: string;
  retryAt?: string | null;
  incrementAttempt?: boolean;
  redactMessage?: boolean;
}) {
  const supabase = requireAdminClient();
  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
    next_attempt_at: input.retryAt ?? null,
    last_error_code: input.errorCode ?? null,
    locked_at: null,
  };
  if (input.providerMessageId) payload.provider_message_id = input.providerMessageId;
  if (input.status === 'accepted') payload.accepted_at = new Date().toISOString();
  if (input.status === 'delivered') payload.delivered_at = new Date().toISOString();
  if (input.redactMessage) payload.message_text = '[redacted]';
  if (input.incrementAttempt) {
    const { data: current } = await supabase
      .from('whatsapp_message_deliveries')
      .select('attempt_count')
      .eq('id', input.id)
      .maybeSingle();
    payload.attempt_count = Number(current?.attempt_count ?? 0) + 1;
  }
  const { error } = await supabase.from('whatsapp_message_deliveries').update(payload).eq('id', input.id);
  if (error) throw new Error('whatsapp_delivery_update_failed');
}

export async function updateWhatsAppDeliveryFromReceipt(input: {
  storeId: string;
  providerMessageId: string;
  status: Extract<WhatsAppDeliveryStatus, 'delivered' | 'failed'>;
  errorCode?: string;
}) {
  const supabase = requireAdminClient();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
    next_attempt_at: null,
    locked_at: null,
    last_error_code: input.errorCode ?? null,
    message_text: '[redacted]',
  };
  if (input.status === 'delivered') payload.delivered_at = now;
  const { error } = await supabase
    .from('whatsapp_message_deliveries')
    .update(payload)
    .eq('store_id', input.storeId)
    .eq('provider_message_id', input.providerMessageId)
    .in('status', ['accepted', 'delivered']);
  if (error) throw new Error('whatsapp_delivery_receipt_update_failed');
}

export async function saveWhatsAppWebhookEvent(input: {
  storeId: string;
  integrationId?: string;
  externalEventId?: string;
  eventType: string;
  instanceName: string;
  sanitizedPayload: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();
  const { error } = await supabase.from('whatsapp_webhook_events').upsert(
    {
      store_id: input.storeId,
      integration_id: input.integrationId ?? null,
      external_event_id: input.externalEventId ?? null,
      event_type: input.eventType,
      instance_name: input.instanceName,
      sanitized_payload: input.sanitizedPayload,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'store_id,external_event_id', ignoreDuplicates: true }
  );
  if (error) throw new Error('whatsapp_webhook_event_save_failed');
}
