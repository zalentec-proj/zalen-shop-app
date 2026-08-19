import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class ClientError extends Error {
    constructor(readonly status: number, readonly reason: string) {
      super(`request_failed:${status}:${reason}`);
      this.name = 'EvolutionWhatsAppClientError';
    }
  }

  return {
    ClientError,
    sendText: vi.fn(),
    getIntegration: vi.fn(),
    getIntegrationByInstance: vi.fn(),
    claimDelivery: vi.fn(),
    updateDelivery: vi.fn(),
    updateDeliveryFromReceipt: vi.fn(),
    listDue: vi.fn(),
    releaseStale: vi.fn(),
    saveIntegration: vi.fn(),
    saveWebhookEvent: vi.fn(),
    insertDelivery: vi.fn(),
    getPreference: vi.fn(),
    upsertPreference: vi.fn(),
    createVerification: vi.fn(),
    getVerification: vi.fn(),
    consumeVerification: vi.fn(),
  };
});

vi.mock('../core/credential-vault', () => ({
  decryptIntegrationCredentials: vi.fn((value: string) => {
    if (value === 'credentials') {
      return { provider: 'evolution_whatsapp', webhookSecret: 'webhook-secret' };
    }
    return { provider: 'evolution_whatsapp_message', text: 'Mensagem protegida' };
  }),
  encryptIntegrationCredentials: vi.fn(() => 'v1:encrypted-message'),
  isIntegrationCredentialEncryptionConfigured: vi.fn(() => true),
}));

vi.mock('./evolution-whatsapp.client', () => ({
  EvolutionWhatsAppClientError: mocks.ClientError,
  EvolutionWhatsAppClient: class {
    sendText = mocks.sendText;
  },
}));

vi.mock('./evolution-whatsapp.config', () => ({
  getEvolutionWhatsAppConfig: () => ({ isConfigured: true }),
}));

vi.mock('./evolution-whatsapp.repository', () => ({
  getCustomerWhatsAppPreference: mocks.getPreference,
  createCustomerWhatsAppVerification: mocks.createVerification,
  getActiveCustomerWhatsAppVerification: mocks.getVerification,
  consumeCustomerWhatsAppVerification: mocks.consumeVerification,
  getEvolutionWhatsAppIntegration: mocks.getIntegration,
  getEvolutionWhatsAppIntegrationByInstance: mocks.getIntegrationByInstance,
  claimWhatsAppDelivery: mocks.claimDelivery,
  insertWhatsAppDelivery: mocks.insertDelivery,
  listDueWhatsAppDeliveries: mocks.listDue,
  releaseStaleWhatsAppDeliveryClaims: mocks.releaseStale,
  saveEvolutionWhatsAppIntegration: mocks.saveIntegration,
  updateWhatsAppDelivery: mocks.updateDelivery,
  updateWhatsAppDeliveryFromReceipt: mocks.updateDeliveryFromReceipt,
  upsertCustomerWhatsAppPreference: mocks.upsertPreference,
  saveWhatsAppWebhookEvent: mocks.saveWebhookEvent,
}));

import {
  getEvolutionMessageReceipt,
  normalizeWhatsAppPhone,
  processEvolutionWebhook,
  processWhatsAppDelivery,
  queueWhatsAppNotification,
  saveWhatsAppNotificationSettings,
} from './evolution-whatsapp.service';
import type { WhatsAppDelivery } from './evolution-whatsapp.types';

const integration = {
  id: 'integration-1',
  storeId: 'store-1',
  providerKey: 'evolution_whatsapp',
  environment: 'production',
  status: 'connected',
  credentialsEncrypted: 'credentials',
  settings: {
    instanceName: 'brasil_drones',
    connectionStatus: 'connected',
    notificationsEnabled: true,
    enabledEvents: ['access_code'],
    alertPhoneE164: '+5545999999999',
  },
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
} as const;

function delivery(overrides: Partial<WhatsAppDelivery> = {}): WhatsAppDelivery {
  return {
    id: 'delivery-1',
    storeId: 'store-1',
    eventKey: 'access_code',
    entityType: 'customer_login',
    recipientKind: 'customer',
    recipientPhoneE164: '+5545984155354',
    messageText: 'v1:encrypted-message',
    idempotencyKey: 'request-1',
    status: 'queued',
    attemptCount: 0,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('Evolution WhatsApp delivery safety', () => {
  beforeEach(() => {
    mocks.getIntegration.mockResolvedValue(integration);
    mocks.getIntegrationByInstance.mockResolvedValue(integration);
    mocks.claimDelivery.mockImplementation(async () => delivery({ status: 'processing' }));
    mocks.updateDelivery.mockResolvedValue(undefined);
    mocks.updateDeliveryFromReceipt.mockResolvedValue(undefined);
    mocks.saveIntegration.mockResolvedValue(integration);
    mocks.saveWebhookEvent.mockResolvedValue(undefined);
    mocks.sendText.mockResolvedValue({ providerMessageId: 'message-1' });
    mocks.getPreference.mockResolvedValue(null);
    mocks.insertDelivery.mockResolvedValue(delivery());
  });

  it('normalizes national and E.164 Brazilian numbers without confusing DDD 55', () => {
    expect(normalizeWhatsAppPhone('(45) 98415-5354')).toBe('+5545984155354');
    expect(normalizeWhatsAppPhone('+55 45 98415-5354')).toBe('+5545984155354');
    expect(normalizeWhatsAppPhone('(55) 98415-5354')).toBe('+5555984155354');
    expect(normalizeWhatsAppPhone('98415-5354')).toBeNull();
  });

  it('claims the queued row before sending and redacts the accepted message', async () => {
    const result = await processWhatsAppDelivery(delivery());

    expect(result).toBe('accepted');
    expect(mocks.claimDelivery).toHaveBeenCalledWith('delivery-1');
    expect(mocks.sendText).toHaveBeenCalledWith({
      instanceName: 'brasil_drones',
      phoneE164: '+5545984155354',
      text: 'Mensagem protegida',
    });
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery-1',
        status: 'accepted',
        redactMessage: true,
      })
    );
  });

  it('does not send when another worker already claimed the row', async () => {
    mocks.claimDelivery.mockResolvedValueOnce(null);

    await expect(processWhatsAppDelivery(delivery())).resolves.toBe('in_progress');
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it('keeps encrypted content only while a transient provider failure is retryable', async () => {
    mocks.sendText.mockRejectedValueOnce(new mocks.ClientError(503, 'unavailable'));

    await expect(processWhatsAppDelivery(delivery())).resolves.toBe('queued');
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        redactMessage: false,
        incrementAttempt: true,
      })
    );
  });

  it('skips and redacts an expired authentication code', async () => {
    mocks.claimDelivery.mockResolvedValueOnce(
      delivery({
        status: 'processing',
        expiresAt: '2026-08-18T00:00:00.000Z',
      })
    );

    await expect(processWhatsAppDelivery(delivery())).resolves.toBe('skipped');
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', redactMessage: true })
    );
  });

  it('preserves the saved operational phone when the admin changes other settings', async () => {
    await saveWhatsAppNotificationSettings({
      storeId: 'store-1',
      alertPhone: '',
      notificationsEnabled: true,
      enabledEvents: ['access_code'],
    });

    expect(mocks.saveIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ alertPhoneE164: '+5545999999999' }),
      })
    );
  });

  it('does not let an arbitrary customer notification bypass phone verification', async () => {
    const result = await queueWhatsAppNotification({
      storeId: 'store-1',
      eventKey: 'access_code',
      entityType: 'customer_login',
      entityId: 'customer-1',
      recipientKind: 'customer',
      customerId: 'customer-1',
      recipientPhone: '(45) 98415-5354',
      messageText: 'Código 123456',
      idempotencyKey: 'blocked-bypass',
    });

    expect(result).toBeNull();
    expect(mocks.insertDelivery).not.toHaveBeenCalled();
  });

  it('allows the authenticated phone-confirmation challenge before opt-in', async () => {
    const result = await queueWhatsAppNotification({
      storeId: 'store-1',
      eventKey: 'access_code',
      entityType: 'whatsapp_phone_verification',
      entityId: 'customer-1',
      recipientKind: 'customer',
      customerId: 'customer-1',
      recipientPhone: '(45) 98415-5354',
      messageText: 'Código 123456',
      idempotencyKey: 'phone-confirmation',
    });

    expect(result).toEqual(delivery());
    expect(mocks.insertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhoneE164: '+5545984155354' })
    );
  });
});

describe('Evolution WhatsApp webhooks', () => {
  beforeEach(() => {
    mocks.getIntegrationByInstance.mockResolvedValue(integration);
    mocks.updateDeliveryFromReceipt.mockResolvedValue(undefined);
    mocks.saveIntegration.mockResolvedValue(integration);
    mocks.saveWebhookEvent.mockResolvedValue(undefined);
  });

  it('recognizes the lowercase dotted delivery event used by Evolution 2.3.7', async () => {
    const result = await processEvolutionWebhook({
      instanceName: 'brasil_drones',
      suppliedSecret: 'webhook-secret',
      eventType: 'messages.update',
      payload: {
        data: { key: { id: 'message-1' }, status: 'DELIVERY_ACK' },
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.updateDeliveryFromReceipt).toHaveBeenCalledWith({
      storeId: 'store-1',
      providerMessageId: 'message-1',
      status: 'delivered',
      errorCode: undefined,
    });
    expect(mocks.saveWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'MESSAGES_UPDATE',
        externalEventId: 'message-1:delivered',
      })
    );
  });

  it('maps numeric delivery acknowledgements without accepting pending states', () => {
    expect(
      getEvolutionMessageReceipt({ data: { key: { id: 'one' }, status: 3 } })
    ).toEqual({ providerMessageId: 'one', status: 'delivered' });
    expect(
      getEvolutionMessageReceipt({ data: { key: { id: 'two' }, status: 2 } })
    ).toBeNull();
  });

  it('normalizes connection.update and persists the connected state', async () => {
    await processEvolutionWebhook({
      instanceName: 'brasil_drones',
      suppliedSecret: 'webhook-secret',
      eventType: 'connection.update',
      payload: { data: { state: 'open' } },
    });

    expect(mocks.saveIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'connected',
        settings: expect.objectContaining({ connectionStatus: 'connected' }),
      })
    );
  });
});
