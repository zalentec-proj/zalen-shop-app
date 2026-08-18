import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { StoreIntegration } from '../core/store-integration.types';
import { BLING_PROVIDER_KEY } from './bling.config';
import type { BlingEnvironment } from './bling.types';

type BlingIntegrationRow = {
  id: string;
  store_id: string;
  provider_key: string;
  environment: string;
  status: string;
  credentials_encrypted?: string | null;
  settings_json: Record<string, unknown> | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BlingSyncJobStatus = 'pending' | 'running' | 'success' | 'error';
type BlingSyncJobType =
  | 'product_sync'
  | 'product_reconciliation'
  | 'inventory_sync'
  | 'order_send'
  | 'webhook_process';

type BlingWebhookProcessJobRow = {
  id: string;
  store_id: string;
  status: string;
  attempts: number | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  locked_at?: string | null;
  next_attempt_at?: string | null;
};

export type BlingWebhookProcessJob = {
  id: string;
  storeId: string;
  attempts: number;
  payload: Record<string, unknown>;
  webhookEventId?: string;
  eventId?: string;
  event?: string;
  externalIds: Record<string, string | number>;
};

type SupabaseRepositoryError = {
  code?: string;
  message?: string;
};

const fallbackDate = new Date(0).toISOString();

function mapBlingIntegration(row: BlingIntegrationRow): StoreIntegration {
  return {
    id: row.id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    environment: row.environment,
    status:
      row.status === 'connected' ||
      row.status === 'error' ||
      row.status === 'disconnected' ||
      row.status === 'disabled' ||
      row.status === 'syncing' ||
      row.status === 'planned' ||
      row.status === 'pending_credentials'
        ? row.status
        : 'pending_credentials',
    settings: row.settings_json ?? {},
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function requireAdminClient() {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getIntegrationSettings(
  integration: BlingIntegrationRow | null | undefined
) {
  return isRecord(integration?.settings_json)
    ? integration.settings_json
    : {};
}

function hasConnectedCredentials(
  integration: BlingIntegrationRow | null | undefined
) {
  return (
    integration?.status === 'connected' &&
    typeof integration.credentials_encrypted === 'string' &&
    integration.credentials_encrypted.trim().length > 0
  );
}

function isUniqueViolation(error: SupabaseRepositoryError | null | undefined) {
  return error?.code === '23505';
}

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mapBlingWebhookProcessJob(
  row: BlingWebhookProcessJobRow
): BlingWebhookProcessJob {
  const payload = isRecord(row.payload) ? row.payload : {};
  const externalIds = isRecord(payload.externalIds)
    ? Object.fromEntries(
        Object.entries(payload.externalIds).filter(
          ([, value]) =>
            (typeof value === 'string' && value.trim()) ||
            (typeof value === 'number' && Number.isFinite(value))
        )
      )
    : {};

  return {
    id: row.id,
    storeId: row.store_id,
    attempts: row.attempts ?? 0,
    payload,
    webhookEventId:
      typeof payload.webhookEventId === 'string'
        ? payload.webhookEventId
        : undefined,
    eventId:
      typeof payload.eventId === 'string' ? payload.eventId : undefined,
    event: typeof payload.event === 'string' ? payload.event : undefined,
    externalIds: externalIds as Record<string, string | number>,
  };
}

export async function getBlingIntegrationFromRepository(
  storeId: string
): Promise<StoreIntegration | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select(
      'id, store_id, provider_key, environment, status, settings_json, last_sync_at, created_at, updated_at'
    )
    .eq('store_id', storeId)
    .eq('provider_key', BLING_PROVIDER_KEY)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapBlingIntegration(data as BlingIntegrationRow);
}

async function getBlingIntegrationForEnvironmentFromRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
}): Promise<BlingIntegrationRow | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select(
      'id, store_id, provider_key, environment, status, credentials_encrypted, settings_json, last_sync_at, created_at, updated_at'
    )
    .eq('store_id', input.storeId)
    .eq('provider_key', BLING_PROVIDER_KEY)
    .eq('environment', input.environment)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as BlingIntegrationRow;
}

export async function getBlingEncryptedCredentialsFromRepository(
  storeId: string
): Promise<{
  credentialsEncrypted: string;
  environment: BlingEnvironment;
  settings: Record<string, unknown>;
} | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select('environment, credentials_encrypted, settings_json')
    .eq('store_id', storeId)
    .eq('provider_key', BLING_PROVIDER_KEY)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.credentials_encrypted) {
    return null;
  }

  return {
    credentialsEncrypted: data.credentials_encrypted,
    environment:
      data.environment === 'production' || data.environment === 'sandbox'
        ? data.environment
        : 'sandbox',
    settings: data.settings_json ?? {},
  };
}

export async function listConnectedBlingStoreIdsInRepository(): Promise<string[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select('store_id')
    .eq('provider_key', BLING_PROVIDER_KEY)
    .eq('status', 'connected')
    .not('credentials_encrypted', 'is', null);

  if (error || !data) {
    return [];
  }

  return Array.from(
    new Set(
      data
        .map((row) => row.store_id)
        .filter((storeId): storeId is string => typeof storeId === 'string')
    )
  );
}

export async function getBlingOrderSendSettingsFromRepository(
  storeId: string
): Promise<{
  enabled: boolean;
  status?: StoreIntegration['status'];
  environment?: string;
  paymentMethodId?: number;
}> {
  const integration = await getBlingIntegrationFromRepository(storeId);
  const orderSend = isRecord(integration?.settings.orderSend)
    ? integration.settings.orderSend
    : {};
  const paymentMethodId = toOptionalNumber(
    orderSend.paymentMethodId ?? orderSend.formaPagamentoId
  );

  return {
    enabled: orderSend.enabled === true,
    status: integration?.status,
    environment: integration?.environment,
    paymentMethodId,
  };
}

async function upsertBlingIntegration(input: {
  storeId: string;
  environment: BlingEnvironment;
  status: string;
  credentialsEncrypted?: string;
  settings: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();

  const payload: Record<string, unknown> = {
    store_id: input.storeId,
    provider_key: BLING_PROVIDER_KEY,
    environment: input.environment,
    status: input.status,
    settings_json: input.settings,
    updated_at: new Date().toISOString(),
  };

  if (input.credentialsEncrypted) {
    payload.credentials_encrypted = input.credentialsEncrypted;
  }

  const { error } = await supabase
    .from('store_integrations')
    .upsert(payload, {
      onConflict: 'store_id,provider_key,environment',
    });

  if (error) {
    throw new Error('Unable to update Bling store integration.');
  }
}

export async function markBlingConnectionAttemptInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  userId: string;
}) {
  const current = await getBlingIntegrationForEnvironmentFromRepository(input);
  const previousSettings = getIntegrationSettings(current);

  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: hasConnectedCredentials(current) ? 'connected' : 'pending_credentials',
    settings: {
      ...previousSettings,
      primary: true,
      lastConnectionAttemptAt: new Date().toISOString(),
      lastConnectionAttemptUserId: input.userId,
    },
  });
}

export async function markBlingConnectionErrorInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  errorCode: string;
}) {
  const current = await getBlingIntegrationForEnvironmentFromRepository(input);
  const previousSettings = getIntegrationSettings(current);

  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: hasConnectedCredentials(current) ? 'connected' : 'error',
    settings: {
      ...previousSettings,
      primary: true,
      lastConnectionErrorAt: new Date().toISOString(),
      lastConnectionErrorCode: input.errorCode,
    },
  });
}

export async function saveBlingCredentialsInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  credentialsEncrypted: string;
  expiresIn?: number;
  scope?: string;
}) {
  const current = await getBlingIntegrationFromRepository(input.storeId);
  const previousSettings = current?.settings ?? {};

  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'connected',
    credentialsEncrypted: input.credentialsEncrypted,
    settings: {
      ...previousSettings,
      primary: true,
      connectedAt:
        typeof previousSettings.connectedAt === 'string'
          ? previousSettings.connectedAt
          : new Date().toISOString(),
      credentialsUpdatedAt: new Date().toISOString(),
      expiresIn: input.expiresIn,
      scope: input.scope,
    },
  });
}

export async function recordBlingHomologationEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  event: 'homologation_started' | 'homologation_success' | 'homologation_failed';
  status: 'running' | 'success' | 'error';
  summary?: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();

  const current = await getBlingEncryptedCredentialsFromRepository(input.storeId);
  const previousSettings = current?.settings ?? {};

  const { error } = await supabase
    .from('store_integrations')
    .update({
      settings_json: {
        ...previousSettings,
        homologation: {
          event: input.event,
          status: input.status,
          summary: input.summary ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', input.storeId)
    .eq('provider_key', BLING_PROVIDER_KEY)
    .eq('environment', input.environment);

  if (error) {
    throw new Error('Unable to record Bling homologation event.');
  }
}

async function hasRunningBlingSyncJobInRepository(
  storeId: string,
  jobType: BlingSyncJobType,
  orderId?: string
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  await supabase
    .from('sync_jobs')
    .update({
      status: 'error',
      last_error: `${jobType}_stale_running_job_released`,
      processed_at: new Date().toISOString(),
      locked_at: null,
      next_attempt_at: null,
    })
    .eq('store_id', storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', jobType)
    .eq('status', 'running')
    .is('processed_at', null)
    .lte('created_at', staleBefore);

  let query = supabase
    .from('sync_jobs')
    .select('id')
    .eq('store_id', storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', jobType)
    .eq('status', 'running')
    .is('processed_at', null);

  if (orderId) {
    query = query.contains('payload', { orderId });
  }

  const { data, error } = await query.limit(1).maybeSingle();

  return Boolean(!error && data);
}

async function createBlingSyncJobInRepository(input: {
  storeId: string;
  jobType: BlingSyncJobType;
  summary?: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();

  const { data, error } = await supabase
    .from('sync_jobs')
    .insert({
      store_id: input.storeId,
      provider: BLING_PROVIDER_KEY,
      job_type: input.jobType,
      status: 'running',
      attempts: 1,
      payload: input.summary ?? {},
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Unable to create Bling sync job.');
  }

  return data.id as string;
}

async function completeBlingSyncJobInRepository(input: {
  jobId: string;
  storeId: string;
  jobType: BlingSyncJobType;
  status: Exclude<BlingSyncJobStatus, 'pending' | 'running'>;
  summary: Record<string, unknown>;
  lastError?: string;
}) {
  const supabase = requireAdminClient();

  const { error } = await supabase
    .from('sync_jobs')
    .update({
      status: input.status,
      payload: input.summary,
      last_error: input.lastError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', input.jobId)
    .eq('store_id', input.storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', input.jobType);

  if (error) {
    throw new Error('Unable to complete Bling sync job.');
  }
}

async function recordBlingSyncEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  settingsKey:
    | 'productSync'
    | 'productReconciliation'
    | 'inventorySync'
    | 'orderSend';
  status: Exclude<BlingSyncJobStatus, 'pending'>;
  summary?: Record<string, unknown>;
  updateLastSyncAt?: boolean;
}) {
  const supabase = requireAdminClient();

  const current = await getBlingEncryptedCredentialsFromRepository(input.storeId);
  const previousSettings = current?.settings ?? {};
  const previousSetting = previousSettings[input.settingsKey];
  const previousSettingRecord = isRecord(previousSetting) ? previousSetting : {};
  const updatedAt = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    settings_json: {
      ...previousSettings,
      [input.settingsKey]: {
        ...previousSettingRecord,
        status: input.status,
        summary: input.summary ?? null,
        updatedAt,
      },
    },
    updated_at: updatedAt,
  };

  if (input.status === 'success' && input.updateLastSyncAt) {
    updatePayload.last_sync_at = updatedAt;
  }

  const { error } = await supabase
    .from('store_integrations')
    .update(updatePayload)
    .eq('store_id', input.storeId)
    .eq('provider_key', BLING_PROVIDER_KEY)
    .eq('environment', input.environment);

  if (error) {
    throw new Error('Unable to record Bling sync event.');
  }
}

export async function hasRunningBlingProductSyncJobInRepository(storeId: string) {
  return hasRunningBlingSyncJobInRepository(storeId, 'product_sync');
}

export async function createBlingProductSyncJobInRepository(input: {
  storeId: string;
  summary?: Record<string, unknown>;
}) {
  return createBlingSyncJobInRepository({
    ...input,
    jobType: 'product_sync',
  });
}

export async function completeBlingProductSyncJobInRepository(input: {
  jobId: string;
  storeId: string;
  status: Exclude<BlingSyncJobStatus, 'pending' | 'running'>;
  summary: Record<string, unknown>;
  lastError?: string;
}) {
  return completeBlingSyncJobInRepository({
    ...input,
    jobType: 'product_sync',
  });
}

export async function recordBlingProductSyncEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  status: Exclude<BlingSyncJobStatus, 'pending'>;
  summary?: Record<string, unknown>;
  updateLastSyncAt?: boolean;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'productSync',
    updateLastSyncAt: input.updateLastSyncAt ?? true,
  });
}

export async function hasRunningBlingProductReconciliationJobInRepository(
  storeId: string
) {
  return hasRunningBlingSyncJobInRepository(storeId, 'product_reconciliation');
}

export async function createBlingProductReconciliationJobInRepository(input: {
  storeId: string;
  summary?: Record<string, unknown>;
}) {
  return createBlingSyncJobInRepository({
    ...input,
    jobType: 'product_reconciliation',
  });
}

export async function completeBlingProductReconciliationJobInRepository(input: {
  jobId: string;
  storeId: string;
  status: Exclude<BlingSyncJobStatus, 'pending' | 'running'>;
  summary: Record<string, unknown>;
  lastError?: string;
}) {
  return completeBlingSyncJobInRepository({
    ...input,
    jobType: 'product_reconciliation',
  });
}

export async function recordBlingProductReconciliationEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  status: Exclude<BlingSyncJobStatus, 'pending'>;
  summary?: Record<string, unknown>;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'productReconciliation',
    updateLastSyncAt: false,
  });
}

export async function hasRunningBlingInventorySyncJobInRepository(storeId: string) {
  return hasRunningBlingSyncJobInRepository(storeId, 'inventory_sync');
}

export async function createBlingInventorySyncJobInRepository(input: {
  storeId: string;
  summary?: Record<string, unknown>;
}) {
  return createBlingSyncJobInRepository({
    ...input,
    jobType: 'inventory_sync',
  });
}

export async function completeBlingInventorySyncJobInRepository(input: {
  jobId: string;
  storeId: string;
  status: Exclude<BlingSyncJobStatus, 'pending' | 'running'>;
  summary: Record<string, unknown>;
  lastError?: string;
}) {
  return completeBlingSyncJobInRepository({
    ...input,
    jobType: 'inventory_sync',
  });
}

export async function recordBlingInventorySyncEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  status: Exclude<BlingSyncJobStatus, 'pending'>;
  summary?: Record<string, unknown>;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'inventorySync',
  });
}

export async function hasRunningBlingOrderSendJobInRepository(input: {
  storeId: string;
  orderId: string;
}) {
  return hasRunningBlingSyncJobInRepository(
    input.storeId,
    'order_send',
    input.orderId
  );
}

export async function createBlingOrderSendJobInRepository(input: {
  storeId: string;
  orderId: string;
  orderNumber?: string;
  testMode?: boolean;
}) {
  return createBlingSyncJobInRepository({
    storeId: input.storeId,
    jobType: 'order_send',
    summary: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      testMode: input.testMode === true,
      startedAt: new Date().toISOString(),
    },
  });
}

export async function completeBlingOrderSendJobInRepository(input: {
  jobId: string;
  storeId: string;
  status: Exclude<BlingSyncJobStatus, 'pending' | 'running'>;
  summary: Record<string, unknown>;
  lastError?: string;
}) {
  return completeBlingSyncJobInRepository({
    ...input,
    jobType: 'order_send',
  });
}

export async function recordBlingOrderSendEventInRepository(input: {
  storeId: string;
  environment: BlingEnvironment;
  status: Exclude<BlingSyncJobStatus, 'pending'>;
  summary?: Record<string, unknown>;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'orderSend',
  });
}

export async function createBlingWebhookEventInRepository(input: {
  storeId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();

  const existing = await supabase
    .from('webhook_events')
    .select('id')
    .eq('store_id', input.storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('external_id', input.eventId)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    return { webhookEventId: existing.data.id as string, duplicate: true };
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .insert({
      store_id: input.storeId,
      provider: BLING_PROVIDER_KEY,
      event_type: input.eventType,
      external_id: input.eventId,
      signature_valid: true,
      payload: input.payload,
      status: 'received',
    })
    .select('id')
    .single();

  if (isUniqueViolation(error)) {
    const duplicate = await supabase
      .from('webhook_events')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('provider', BLING_PROVIDER_KEY)
      .eq('external_id', input.eventId)
      .limit(1)
      .maybeSingle();

    return {
      webhookEventId: duplicate.data?.id as string | undefined,
      duplicate: true,
    };
  }

  if (error || !data?.id) {
    throw new Error('Unable to create Bling webhook event.');
  }

  return { webhookEventId: data.id as string, duplicate: false };
}

export async function createBlingWebhookProcessJobInRepository(input: {
  storeId: string;
  webhookEventId: string;
  eventId: string;
  eventType: string;
  externalIds?: Record<string, string | number>;
}) {
  const supabase = requireAdminClient();

  const existing = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('store_id', input.storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', 'webhook_process')
    .contains('payload', { eventId: input.eventId })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    return { jobId: existing.data.id as string, duplicate: true };
  }

  const payload: Record<string, unknown> = {
    webhookEventId: input.webhookEventId,
    eventId: input.eventId,
    event: input.eventType,
  };

  if (input.externalIds && Object.keys(input.externalIds).length > 0) {
    payload.externalIds = input.externalIds;
  }

  const { data, error } = await supabase
    .from('sync_jobs')
    .insert({
      store_id: input.storeId,
      provider: BLING_PROVIDER_KEY,
      job_type: 'webhook_process',
      status: 'pending',
      attempts: 0,
      payload,
    })
    .select('id')
    .single();

  if (isUniqueViolation(error)) {
    const duplicate = await supabase
      .from('sync_jobs')
      .select('id')
      .eq('store_id', input.storeId)
      .eq('provider', BLING_PROVIDER_KEY)
      .eq('job_type', 'webhook_process')
      .contains('payload', { eventId: input.eventId })
      .limit(1)
      .maybeSingle();

    return {
      jobId: duplicate.data?.id as string | undefined,
      duplicate: true,
    };
  }

  if (error || !data?.id) {
    throw new Error('Unable to create Bling webhook process job.');
  }

  return { jobId: data.id as string, duplicate: false };
}

export async function releaseStaleBlingWebhookProcessJobsInRepository(input: {
  storeId?: string;
  staleBefore: string;
  limit?: number;
}) {
  const supabase = requireAdminClient();

  let query = supabase
    .from('sync_jobs')
    .select('id, store_id')
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', 'webhook_process')
    .eq('status', 'running')
    .is('processed_at', null)
    .not('locked_at', 'is', null)
    .lte('locked_at', input.staleBefore)
    .order('locked_at', { ascending: true })
    .limit(input.limit ?? 25);

  if (input.storeId) {
    query = query.eq('store_id', input.storeId);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return 0;
  }

  let released = 0;
  const now = new Date().toISOString();

  for (const row of data) {
    const { error: updateError } = await supabase
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: 'webhook_process_lock_expired',
        locked_at: null,
        next_attempt_at: now,
      })
      .eq('id', row.id)
      .eq('store_id', row.store_id)
      .eq('provider', BLING_PROVIDER_KEY)
      .eq('job_type', 'webhook_process')
      .eq('status', 'running')
      .is('processed_at', null);

    if (!updateError) {
      released += 1;
    }
  }

  return released;
}

export async function claimPendingBlingWebhookProcessJobsInRepository(input: {
  storeId?: string;
  limit?: number;
} = {}): Promise<BlingWebhookProcessJob[]> {
  const supabase = requireAdminClient();
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  await releaseStaleBlingWebhookProcessJobsInRepository({
    storeId: input.storeId,
    staleBefore,
  });

  let query = supabase
    .from('sync_jobs')
    .select('id, store_id, status, attempts, payload, created_at, locked_at, next_attempt_at')
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', 'webhook_process')
    .in('status', ['pending', 'error'])
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit * 5);

  if (input.storeId) {
    query = query.eq('store_id', input.storeId);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return [];
  }

  const claimed: BlingWebhookProcessJob[] = [];

  for (const row of data as BlingWebhookProcessJobRow[]) {
    if (claimed.length >= limit) {
      break;
    }

    const nextAttemptAt = row.next_attempt_at
      ? new Date(row.next_attempt_at)
      : null;

    if (nextAttemptAt && nextAttemptAt > now) {
      continue;
    }

    const attempts = (row.attempts ?? 0) + 1;
    const { data: updated, error: updateError } = await supabase
      .from('sync_jobs')
      .update({
        status: 'running',
        attempts,
        locked_at: nowIso,
        next_attempt_at: null,
        last_error: null,
      })
      .eq('id', row.id)
      .eq('store_id', row.store_id)
      .eq('provider', BLING_PROVIDER_KEY)
      .eq('job_type', 'webhook_process')
      .eq('status', row.status)
      .is('processed_at', null)
      .select('id, store_id, status, attempts, payload, created_at, locked_at, next_attempt_at')
      .maybeSingle();

    if (!updateError && updated) {
      claimed.push(mapBlingWebhookProcessJob(updated as BlingWebhookProcessJobRow));
    }
  }

  return claimed;
}

export async function completeBlingWebhookProcessJobInRepository(input: {
  jobId: string;
  storeId: string;
  status: 'success' | 'error';
  summary: Record<string, unknown>;
  lastError?: string;
  nextAttemptAt?: string;
  final?: boolean;
}) {
  const supabase = requireAdminClient();
  const finished = input.status === 'success' || input.final;

  const { error } = await supabase
    .from('sync_jobs')
    .update({
      status: input.status,
      payload: input.summary,
      last_error: input.lastError ?? null,
      locked_at: null,
      next_attempt_at:
        input.status === 'error' && !input.final
          ? input.nextAttemptAt ?? new Date().toISOString()
          : null,
      processed_at: finished ? new Date().toISOString() : null,
    })
    .eq('id', input.jobId)
    .eq('store_id', input.storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', 'webhook_process');

  if (error) {
    throw new Error('Unable to complete Bling webhook process job.');
  }
}

export async function updateBlingWebhookEventStatusInRepository(input: {
  webhookEventId: string;
  storeId: string;
  status: 'received' | 'processed' | 'error';
  errorMessage?: string;
}) {
  const supabase = requireAdminClient();

  const { error } = await supabase
    .from('webhook_events')
    .update({
      status: input.status,
      processed_at: input.status === 'processed' ? new Date().toISOString() : null,
      error_message: input.errorMessage ?? null,
    })
    .eq('id', input.webhookEventId)
    .eq('store_id', input.storeId)
    .eq('provider', BLING_PROVIDER_KEY);

  if (error) {
    throw new Error('Unable to update Bling webhook event status.');
  }
}

export async function getBlingWebhookOperationalSummaryFromRepository(
  storeId: string
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return {
      received: 0,
      pending: 0,
      error: 0,
      lastReceivedAt: undefined as string | undefined,
    };
  }

  const [received, pendingJobs, erroredJobs, erroredEvents, lastReceived] =
    await Promise.all([
      supabase
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('provider', BLING_PROVIDER_KEY),
      supabase
        .from('sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('provider', BLING_PROVIDER_KEY)
        .eq('job_type', 'webhook_process')
        .eq('status', 'pending'),
      supabase
        .from('sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('provider', BLING_PROVIDER_KEY)
        .eq('job_type', 'webhook_process')
        .eq('status', 'error'),
      supabase
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('provider', BLING_PROVIDER_KEY)
        .eq('status', 'error'),
      supabase
        .from('webhook_events')
        .select('created_at')
        .eq('store_id', storeId)
        .eq('provider', BLING_PROVIDER_KEY)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    received: received.count ?? 0,
    pending: pendingJobs.count ?? 0,
    error: (erroredJobs.count ?? 0) + (erroredEvents.count ?? 0),
    lastReceivedAt:
      typeof lastReceived.data?.created_at === 'string'
        ? lastReceived.data.created_at
        : undefined,
  };
}
