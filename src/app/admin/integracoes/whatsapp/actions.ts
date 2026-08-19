'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import { getServerEnv } from '@/lib/env/server';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  adoptExistingEvolutionInstance,
  configureEvolutionWebhook,
  createEvolutionInstance,
  enqueueOperationalWhatsAppTest,
  reconnectEvolutionInstance,
  refreshEvolutionConnection,
  saveWhatsAppNotificationSettings,
} from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';
import { getEvolutionWhatsAppIntegration } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.repository';
import type { WhatsAppNotificationEvent } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.types';

const managementRoles: StoreRole[] = ['store_owner', 'store_admin'];

async function getManagedStore() {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, managementRoles);
  if (!access.allowed) throw new Error('whatsapp_access_denied');
  return store;
}

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/whatsapp');
}

export async function adoptExistingWhatsAppInstanceAction(instanceName: string) {
  const store = await getManagedStore();
  const result = await adoptExistingEvolutionInstance({ storeId: store.id, instanceName: instanceName.trim() });
  refresh();
  return { ok: true, status: result.status };
}

export async function createWhatsAppConnectionAction() {
  const store = await getManagedStore();
  const qrCodeDataUrl = await createEvolutionInstance({ storeId: store.id, storeSlug: store.slug });
  refresh();
  return { ok: true, qrCodeDataUrl };
}

export async function reconnectWhatsAppAction() {
  const store = await getManagedStore();
  const qrCodeDataUrl = await reconnectEvolutionInstance({ storeId: store.id });
  refresh();
  return { ok: true, qrCodeDataUrl };
}

export async function refreshWhatsAppConnectionAction() {
  const store = await getManagedStore();
  await refreshEvolutionConnection({ storeId: store.id });
  refresh();
  return { ok: true };
}

export async function configureWhatsAppWebhookAction() {
  const store = await getManagedStore();
  const appUrl = getServerEnv().APP_URL;
  if (!appUrl) throw new Error('app_url_not_configured');
  await configureEvolutionWebhook({ storeId: store.id, appUrl });
  refresh();
  return { ok: true };
}

const notificationSettingsSchema = z.object({
  alertPhone: z.string().trim().max(32).optional(),
  notificationsEnabled: z.boolean(),
  enabledEvents: z.array(z.string()).max(20),
});

export async function saveWhatsAppNotificationSettingsAction(input: z.infer<typeof notificationSettingsSchema>) {
  const store = await getManagedStore();
  const parsed = notificationSettingsSchema.parse(input);
  await saveWhatsAppNotificationSettings({
    storeId: store.id,
    alertPhone: parsed.alertPhone,
    notificationsEnabled: parsed.notificationsEnabled,
    enabledEvents: parsed.enabledEvents as WhatsAppNotificationEvent[],
  });
  refresh();
  return { ok: true };
}

export async function sendWhatsAppOperationalTestAction() {
  const store = await getManagedStore();
  const integration = await getEvolutionWhatsAppIntegration(store.id);
  const settings = (integration?.settings ?? {}) as { alertPhoneE164?: string };
  if (!settings.alertPhoneE164) throw new Error('alert_phone_missing');
  const result = await enqueueOperationalWhatsAppTest({
    storeId: store.id,
    storeName: store.shortName,
    idempotencyKey: `whatsapp-operational-test:${store.id}:${new Date().toISOString().slice(0, 16)}`,
  });
  if (!result) throw new Error('whatsapp_test_not_queued');
  return { ok: true };
}
