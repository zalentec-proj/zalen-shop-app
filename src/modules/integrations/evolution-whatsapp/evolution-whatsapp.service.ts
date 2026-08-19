import 'server-only';

import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  isIntegrationCredentialEncryptionConfigured,
} from '../core/credential-vault';
import { EvolutionWhatsAppClient, EvolutionWhatsAppClientError } from './evolution-whatsapp.client';
import { getEvolutionWhatsAppConfig } from './evolution-whatsapp.config';
import {
  getCustomerWhatsAppPreference,
  createCustomerWhatsAppVerification,
  getActiveCustomerWhatsAppVerification,
  consumeCustomerWhatsAppVerification,
  getEvolutionWhatsAppIntegration,
  getEvolutionWhatsAppIntegrationByInstance,
  insertWhatsAppDelivery,
  listDueWhatsAppDeliveries,
  saveEvolutionWhatsAppIntegration,
  updateWhatsAppDelivery,
  upsertCustomerWhatsAppPreference,
  saveWhatsAppWebhookEvent,
} from './evolution-whatsapp.repository';
import {
  customerWhatsAppEvents,
  operatorWhatsAppEvents,
  type EvolutionWhatsAppCredentials,
  type EvolutionWhatsAppSettings,
  type WhatsAppAdminState,
  type WhatsAppDelivery,
  type WhatsAppNotificationEvent,
} from './evolution-whatsapp.types';
import type { Order } from '@/modules/orders/order.types';
import type { ShipmentStatus } from '@/modules/shipping/shipment.types';

function asSettings(value: Record<string, unknown>): EvolutionWhatsAppSettings {
  return value as EvolutionWhatsAppSettings;
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  return normalized.length >= 10 && normalized.length <= 15 ? `+${normalized}` : null;
}

function maskPhone(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length > 4 ? `+${digits.slice(0, 4)}••••${digits.slice(-4)}` : '••••';
}

function toConnectionStatus(value?: string): WhatsAppAdminState['connectionStatus'] {
  if (value === 'open' || value === 'connected') return 'connected';
  if (value === 'connecting' || value === 'awaiting_qr') return 'awaiting_qr';
  if (value === 'close' || value === 'disconnected') return 'disconnected';
  if (value === 'error') return 'error';
  return 'not_configured';
}

function toIntegrationStatus(connectionStatus: WhatsAppAdminState['connectionStatus']) {
  if (connectionStatus === 'connected') return 'connected' as const;
  if (connectionStatus === 'error') return 'error' as const;
  if (connectionStatus === 'not_configured') return 'planned' as const;
  return 'disconnected' as const;
}

function makeWebhookSecret() {
  return randomBytes(32).toString('base64url');
}

function getRetryAt(attempt: number) {
  const delaySeconds = Math.min(30 * 2 ** Math.max(0, attempt - 1), 60 * 30);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function isRetryable(error: unknown) {
  return (
    error instanceof EvolutionWhatsAppClientError &&
    (error.status === 429 || error.status >= 500)
  ) || (error instanceof Error && error.name === 'TimeoutError');
}

export async function getWhatsAppAdminState(storeId: string): Promise<WhatsAppAdminState> {
  const config = getEvolutionWhatsAppConfig();
  const integration = await getEvolutionWhatsAppIntegration(storeId);
  const settings = asSettings(integration?.settings ?? {});
  const connectionStatus = toConnectionStatus(settings.connectionStatus);
  const warnings: string[] = [];

  if (!config.isConfigured) warnings.push('A API central da Zalen ainda não está configurada neste ambiente.');
  if (!isIntegrationCredentialEncryptionConfigured()) warnings.push('A criptografia de credenciais de integração ainda não está configurada.');
  if (!settings.instanceName) warnings.push('Nenhuma instância WhatsApp foi vinculada a esta loja.');
  if (settings.instanceName && connectionStatus !== 'connected') warnings.push('O WhatsApp não está conectado. Gere um novo QR Code para reconectar.');

  return {
    configured: config.isConfigured,
    encryptionConfigured: isIntegrationCredentialEncryptionConfigured(),
    connectionStatus,
    instanceName: settings.instanceName,
    instanceId: settings.instanceId,
    ownerPhoneMasked: settings.ownerPhoneMasked,
    connectedAt: settings.connectedAt,
    lastConnectionCheckAt: settings.lastConnectionCheckAt,
    lastConnectionErrorCode: settings.lastConnectionErrorCode,
    alertPhoneMasked: maskPhone(settings.alertPhoneE164),
    notificationsEnabled: settings.notificationsEnabled === true,
    enabledEvents: Array.isArray(settings.enabledEvents) ? settings.enabledEvents : [],
    webhookConfigured: Boolean(settings.webhookConfiguredAt),
    warnings,
  };
}

async function getSavedCredentials(integration: Awaited<ReturnType<typeof getEvolutionWhatsAppIntegration>>) {
  if (!integration?.credentialsEncrypted) return null;
  return decryptIntegrationCredentials<EvolutionWhatsAppCredentials>(integration.credentialsEncrypted);
}

export async function adoptExistingEvolutionInstance(input: {
  storeId: string;
  instanceName: string;
}) {
  if (!isIntegrationCredentialEncryptionConfigured()) {
    throw new Error('evolution_whatsapp_encryption_not_configured');
  }
  const client = new EvolutionWhatsAppClient();
  const instance = (await client.listInstances()).find((item) => item.name === input.instanceName);
  if (!instance) throw new Error('evolution_whatsapp_instance_not_found');

  const existing = await getEvolutionWhatsAppIntegration(input.storeId);
  const existingCredentials = await getSavedCredentials(existing);
  const credentialsEncrypted = encryptIntegrationCredentials({
    provider: 'evolution_whatsapp',
    instanceToken: existingCredentials?.instanceToken,
    webhookSecret: existingCredentials?.webhookSecret ?? makeWebhookSecret(),
  } satisfies EvolutionWhatsAppCredentials);
  const connectionStatus = toConnectionStatus(instance.connectionStatus);
  const settings: EvolutionWhatsAppSettings = {
    ...asSettings(existing?.settings ?? {}),
    instanceName: instance.name,
    instanceId: instance.id,
    ownerPhoneMasked: maskPhone(instance.ownerPhone),
    connectionStatus,
    connectedAt: connectionStatus === 'connected' ? new Date().toISOString() : undefined,
    lastConnectionCheckAt: new Date().toISOString(),
    lastConnectionErrorCode: undefined,
  };
  return saveEvolutionWhatsAppIntegration({
    storeId: input.storeId,
    status: toIntegrationStatus(connectionStatus),
    settings,
    credentialsEncrypted,
  });
}

export async function createEvolutionInstance(input: { storeId: string; storeSlug: string }) {
  if (!isIntegrationCredentialEncryptionConfigured()) throw new Error('evolution_whatsapp_encryption_not_configured');
  const existing = await getEvolutionWhatsAppIntegration(input.storeId);
  const existingSettings = asSettings(existing?.settings ?? {});
  if (existingSettings.instanceName) return reconnectEvolutionInstance({ storeId: input.storeId });

  const instanceName = `${input.storeSlug.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const instanceToken = randomUUID();
  const created = await new EvolutionWhatsAppClient().createInstance({ instanceName, instanceToken });
  const credentialsEncrypted = encryptIntegrationCredentials({
    provider: 'evolution_whatsapp', instanceToken, webhookSecret: makeWebhookSecret(),
  } satisfies EvolutionWhatsAppCredentials);
  await saveEvolutionWhatsAppIntegration({
    storeId: input.storeId,
    status: 'disconnected',
    credentialsEncrypted,
    settings: {
      ...existingSettings,
      instanceName,
      instanceId: created.instanceId,
      connectionStatus: 'awaiting_qr',
      lastConnectionCheckAt: new Date().toISOString(),
    },
  });
  return created.qrCodeDataUrl;
}

export async function reconnectEvolutionInstance(input: { storeId: string }) {
  const integration = await getEvolutionWhatsAppIntegration(input.storeId);
  const settings = asSettings(integration?.settings ?? {});
  if (!settings.instanceName) throw new Error('evolution_whatsapp_instance_missing');
  const result = await new EvolutionWhatsAppClient().reconnect(settings.instanceName);
  const connectionStatus = toConnectionStatus(result.status);
  await saveEvolutionWhatsAppIntegration({
    storeId: input.storeId,
    status: toIntegrationStatus(connectionStatus),
    settings: {
      ...settings,
      connectionStatus,
      lastConnectionCheckAt: new Date().toISOString(),
    },
  });
  return result.qrCodeDataUrl;
}

export async function refreshEvolutionConnection(input: { storeId: string }) {
  const integration = await getEvolutionWhatsAppIntegration(input.storeId);
  const settings = asSettings(integration?.settings ?? {});
  if (!settings.instanceName) return null;
  try {
    const result = await new EvolutionWhatsAppClient().getConnectionState(settings.instanceName);
    const connectionStatus = toConnectionStatus(result.status);
    return await saveEvolutionWhatsAppIntegration({
      storeId: input.storeId,
      status: toIntegrationStatus(connectionStatus),
      settings: {
        ...settings,
        connectionStatus,
        ownerPhoneMasked: maskPhone(result.ownerPhone) ?? settings.ownerPhoneMasked,
        connectedAt: connectionStatus === 'connected' ? (settings.connectedAt ?? new Date().toISOString()) : settings.connectedAt,
        lastConnectionCheckAt: new Date().toISOString(),
        lastConnectionErrorCode: undefined,
      },
    });
  } catch (error) {
    await saveEvolutionWhatsAppIntegration({
      storeId: input.storeId,
      status: 'error',
      settings: { ...settings, connectionStatus: 'error', lastConnectionCheckAt: new Date().toISOString(), lastConnectionErrorCode: 'connection_check_failed' },
    });
    throw error;
  }
}

export async function configureEvolutionWebhook(input: { storeId: string; appUrl: string }) {
  const integration = await getEvolutionWhatsAppIntegration(input.storeId);
  const settings = asSettings(integration?.settings ?? {});
  const credentials = await getSavedCredentials(integration);
  if (!integration || !settings.instanceName || !credentials?.webhookSecret) {
    throw new Error('evolution_whatsapp_instance_missing');
  }
  const webhookUrl = `${input.appUrl.replace(/\/$/, '')}/api/webhooks/evolution-whatsapp`;
  await new EvolutionWhatsAppClient().setWebhook({
    instanceName: settings.instanceName,
    url: webhookUrl,
    secret: credentials.webhookSecret,
  });
  return saveEvolutionWhatsAppIntegration({
    storeId: input.storeId,
    status: integration.status,
    settings: { ...settings, webhookConfiguredAt: new Date().toISOString() },
  });
}

export async function saveWhatsAppNotificationSettings(input: {
  storeId: string;
  alertPhone?: string;
  notificationsEnabled: boolean;
  enabledEvents: WhatsAppNotificationEvent[];
}) {
  const integration = await getEvolutionWhatsAppIntegration(input.storeId);
  const settings = asSettings(integration?.settings ?? {});
  const alertPhoneE164 = input.alertPhone ? normalizeWhatsAppPhone(input.alertPhone) ?? undefined : undefined;
  if (input.alertPhone && !alertPhoneE164) throw new Error('invalid_alert_phone');
  return saveEvolutionWhatsAppIntegration({
    storeId: input.storeId,
    status: integration?.status ?? 'planned',
    settings: {
      ...settings,
      alertPhoneE164,
      notificationsEnabled: input.notificationsEnabled,
      enabledEvents: Array.from(new Set(input.enabledEvents)).filter((event): event is WhatsAppNotificationEvent =>
        customerWhatsAppEvents.includes(event) || operatorWhatsAppEvents.includes(event)
      ),
    },
  });
}

export async function saveCustomerWhatsAppConsent(input: {
  storeId: string;
  customerId: string;
  phone: string;
  optedIn: boolean;
  verifiedAt?: string | null;
}) {
  const phoneE164 = normalizeWhatsAppPhone(input.phone);
  if (!phoneE164) throw new Error('invalid_whatsapp_phone');
  return upsertCustomerWhatsAppPreference({ ...input, phoneE164 });
}

export async function requestCustomerWhatsAppVerification(input: { storeId: string; customerId: string; phone: string; storeName: string }) {
  const phoneE164 = normalizeWhatsAppPhone(input.phone);
  if (!phoneE164) throw new Error('invalid_whatsapp_phone');
  const code = String(randomInt(100000, 1000000));
  const salt = randomBytes(16).toString('hex');
  await createCustomerWhatsAppVerification({
    storeId: input.storeId, customerId: input.customerId, phoneE164,
    codeHash: `${salt}:${getWhatsappVerificationHash({ code, salt })}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  const delivery = await queueWhatsAppNotification({
    storeId: input.storeId, eventKey: 'access_code', entityType: 'whatsapp_phone_verification', entityId: input.customerId,
    recipientKind: 'customer', recipientPhone: phoneE164,
    messageText: `${input.storeName}: seu código para confirmar este WhatsApp é ${code}. Não compartilhe este código.`,
    idempotencyKey: `whatsapp-phone-verify:${input.customerId}:${code}`,
  });
  if (!delivery) throw new Error('whatsapp_verification_not_queued');
  await processDelivery(delivery);
  return { phoneE164 };
}

export async function confirmCustomerWhatsAppVerification(input: { storeId: string; customerId: string; phone: string; code: string; optedIn: boolean }) {
  const phoneE164 = normalizeWhatsAppPhone(input.phone);
  if (!phoneE164) throw new Error('invalid_whatsapp_phone');
  const verification = await getActiveCustomerWhatsAppVerification({ storeId: input.storeId, customerId: input.customerId, phoneE164 });
  if (!verification || verification.attempts >= 5) throw new Error('whatsapp_verification_invalid');
  const [salt, expectedHash] = verification.codeHash.split(':', 2);
  const hash = salt ? getWhatsappVerificationHash({ code: input.code.trim(), salt }) : '';
  const valid = Boolean(expectedHash && safeEqual(expectedHash, hash));
  await consumeCustomerWhatsAppVerification({ id: verification.id, valid });
  if (!valid) throw new Error('whatsapp_verification_invalid');
  await upsertCustomerWhatsAppPreference({ storeId: input.storeId, customerId: input.customerId, phoneE164, optedIn: input.optedIn, verifiedAt: new Date().toISOString() });
}

export async function queueWhatsAppNotification(input: {
  storeId: string;
  eventKey: WhatsAppNotificationEvent;
  entityType: string;
  entityId?: string;
  recipientKind: 'customer' | 'store_operator';
  customerId?: string;
  recipientPhone?: string;
  messageText: string;
  idempotencyKey: string;
}) {
  const integration = await getEvolutionWhatsAppIntegration(input.storeId);
  const settings = asSettings(integration?.settings ?? {});
  if (!integration || settings.connectionStatus !== 'connected' || !settings.notificationsEnabled || !settings.enabledEvents?.includes(input.eventKey)) return null;
  let phoneE164: string | undefined;
  if (input.recipientKind === 'store_operator') phoneE164 = settings.alertPhoneE164;
  if (input.recipientKind === 'customer' && input.customerId) {
    const preference = await getCustomerWhatsAppPreference({ storeId: input.storeId, customerId: input.customerId });
    if (preference?.verifiedAt && preference.optedInAt && !preference.optedOutAt) phoneE164 = preference.phoneE164 ?? undefined;
  }
  if (!phoneE164 && input.recipientPhone) phoneE164 = normalizeWhatsAppPhone(input.recipientPhone) ?? undefined;
  if (!phoneE164) return null;
  return insertWhatsAppDelivery({
    ...input,
    integrationId: integration.id,
    recipientPhoneE164: phoneE164,
  });
}

export async function enqueueLoginCodeViaWhatsApp(input: {
  storeId: string;
  customerId: string;
  storeName: string;
  code: string;
  idempotencyKey: string;
}) {
  const delivery = await queueWhatsAppNotification({
    storeId: input.storeId,
    eventKey: 'access_code',
    entityType: 'customer_login',
    entityId: input.customerId,
    recipientKind: 'customer',
    customerId: input.customerId,
    messageText: buildWhatsAppLoginCodeMessage(input),
    idempotencyKey: input.idempotencyKey,
  });
  if (delivery) await processDelivery(delivery);
  return delivery;
}

export async function enqueueOperationalWhatsAppTest(input: {
  storeId: string;
  storeName: string;
  idempotencyKey: string;
}) {
  return queueWhatsAppNotification({
    storeId: input.storeId,
    eventKey: 'operator_order_received',
    entityType: 'whatsapp_test',
    recipientKind: 'store_operator',
    messageText: `${input.storeName}: teste de conexão WhatsApp concluído.`,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function enqueueOrderWhatsAppNotification(input: {
  storeId: string;
  storeName: string;
  order: Order;
  eventKey: Extract<WhatsAppNotificationEvent, 'order_received' | 'payment_pending' | 'payment_approved' | 'payment_failed'>;
  idempotencySuffix?: string;
}) {
  const label: Record<typeof input.eventKey, string> = {
    order_received: 'Recebemos seu pedido',
    payment_pending: 'Seu pagamento está pendente',
    payment_approved: 'Pagamento confirmado',
    payment_failed: 'Não foi possível aprovar o pagamento',
  };
  const message = `${input.storeName}: ${label[input.eventKey]} do pedido ${input.order.orderNumber}.`;
  const result = input.order.customerId ? await queueWhatsAppNotification({
    storeId: input.storeId,
    eventKey: input.eventKey,
    entityType: 'order',
    entityId: input.order.id,
    recipientKind: 'customer',
    customerId: input.order.customerId,
    messageText: message,
    idempotencyKey: `whatsapp:${input.eventKey}:${input.order.id}:${input.idempotencySuffix ?? 'v1'}`,
  }) : null;
  if (input.eventKey === 'order_received') {
    await queueWhatsAppNotification({
      storeId: input.storeId,
      eventKey: 'operator_order_received',
      entityType: 'order',
      entityId: input.order.id,
      recipientKind: 'store_operator',
      messageText: `${input.storeName}: novo pedido ${input.order.orderNumber}.`,
      idempotencyKey: `whatsapp:operator_order_received:${input.order.id}`,
    });
  }
  if (input.eventKey === 'payment_approved') {
    await queueWhatsAppNotification({
      storeId: input.storeId,
      eventKey: 'operator_payment_approved',
      entityType: 'order',
      entityId: input.order.id,
      recipientKind: 'store_operator',
      messageText: `${input.storeName}: pagamento aprovado do pedido ${input.order.orderNumber}.`,
      idempotencyKey: `whatsapp:operator_payment_approved:${input.order.id}`,
    });
  }
  return result;
}

export async function enqueueShipmentWhatsAppNotification(input: {
  storeId: string;
  storeName: string;
  order: Order;
  shipmentStatus: ShipmentStatus;
  trackingUrl?: string;
}) {
  const mapping: Partial<Record<ShipmentStatus, Extract<WhatsAppNotificationEvent, `shipment_${string}`>>> = {
    pending: 'shipment_pending', posted: 'shipment_posted', in_transit: 'shipment_in_transit', out_for_delivery: 'shipment_out_for_delivery', delivered: 'shipment_delivered', exception: 'shipment_exception', cancelled: 'shipment_cancelled',
  };
  const eventKey = mapping[input.shipmentStatus];
  if (!eventKey || !input.order.customerId) return null;
  const suffix = input.trackingUrl ? ` Acompanhe: ${input.trackingUrl}` : '';
  return queueWhatsAppNotification({
    storeId: input.storeId,
    eventKey,
    entityType: 'order',
    entityId: input.order.id,
    recipientKind: 'customer',
    customerId: input.order.customerId,
    messageText: `${input.storeName}: pedido ${input.order.orderNumber} — ${input.shipmentStatus.replaceAll('_', ' ')}.${suffix}`,
    idempotencyKey: `whatsapp:${eventKey}:${input.order.id}:${input.shipmentStatus}:${input.trackingUrl ?? ''}`,
  });
}

async function processDelivery(delivery: WhatsAppDelivery) {
  const integration = await getEvolutionWhatsAppIntegration(delivery.storeId);
  const settings = asSettings(integration?.settings ?? {});
  if (!integration || settings.connectionStatus !== 'connected' || !settings.instanceName) {
    await updateWhatsAppDelivery({ id: delivery.id, status: 'skipped', errorCode: 'integration_not_connected' });
    return 'skipped';
  }
  try {
    const sent = await new EvolutionWhatsAppClient().sendText({
      instanceName: settings.instanceName,
      phoneE164: delivery.recipientPhoneE164,
      text: delivery.messageText,
    });
    await updateWhatsAppDelivery({ id: delivery.id, status: 'accepted', providerMessageId: sent.providerMessageId, incrementAttempt: true });
    return 'accepted';
  } catch (error) {
    const nextAttempt = delivery.attemptCount + 1;
    await updateWhatsAppDelivery({
      id: delivery.id,
      status: isRetryable(error) && nextAttempt < 5 ? 'queued' : 'failed',
      errorCode: error instanceof EvolutionWhatsAppClientError ? `provider_${error.status}` : 'send_failed',
      retryAt: isRetryable(error) && nextAttempt < 5 ? getRetryAt(nextAttempt) : null,
      incrementAttempt: true,
    });
    return 'failed';
  }
}

export async function processDueWhatsAppDeliveries(limit = 30) {
  const deliveries = await listDueWhatsAppDeliveries(limit);
  const results = await Promise.all(deliveries.map(processDelivery));
  return { processed: deliveries.length, accepted: results.filter((result) => result === 'accepted').length };
}

export function buildWhatsAppLoginCodeMessage(input: { storeName: string; code: string }) {
  return `${input.storeName}: seu código de acesso é ${input.code}. Não compartilhe este código.`;
}

export function getWhatsappVerificationHash(input: { code: string; salt: string }) {
  return createHash('sha256').update(`${input.salt}:${input.code}`).digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function processEvolutionWebhook(input: {
  instanceName: string;
  suppliedSecret?: string | null;
  eventType: string;
  eventId?: string;
  payload: Record<string, unknown>;
}) {
  const integration = await getEvolutionWhatsAppIntegrationByInstance(input.instanceName);
  const credentials = await getSavedCredentials(integration);
  if (!integration || !credentials?.webhookSecret || !input.suppliedSecret || !safeEqual(credentials.webhookSecret, input.suppliedSecret)) {
    return { ok: false as const, errorCode: 'unauthorized' as const };
  }
  const settings = asSettings(integration.settings ?? {});
  const state = String((input.payload.instance as Record<string, unknown> | undefined)?.state ?? (input.payload.data as Record<string, unknown> | undefined)?.state ?? '');
  if (input.eventType === 'CONNECTION_UPDATE' && state) {
    const connectionStatus = toConnectionStatus(state);
    await saveEvolutionWhatsAppIntegration({
      storeId: integration.storeId,
      status: toIntegrationStatus(connectionStatus),
      settings: { ...settings, connectionStatus, lastConnectionCheckAt: new Date().toISOString() },
    });
  }
  await saveWhatsAppWebhookEvent({
    storeId: integration.storeId,
    integrationId: integration.id,
    externalEventId: input.eventId,
    eventType: input.eventType,
    instanceName: input.instanceName,
    sanitizedPayload: { eventType: input.eventType, hasData: Boolean(input.payload.data), receivedAt: new Date().toISOString() },
  });
  return { ok: true as const };
}
