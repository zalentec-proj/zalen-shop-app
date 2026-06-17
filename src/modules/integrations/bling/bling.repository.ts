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

type BlingSyncJobStatus = 'running' | 'success' | 'error';
type BlingSyncJobType = 'product_sync' | 'inventory_sync';

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
  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'pending_credentials',
    settings: {
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
  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'error',
    settings: {
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
  jobType: BlingSyncJobType
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('store_id', storeId)
    .eq('provider', BLING_PROVIDER_KEY)
    .eq('job_type', jobType)
    .eq('status', 'running')
    .is('processed_at', null)
    .limit(1)
    .maybeSingle();

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
  status: Exclude<BlingSyncJobStatus, 'running'>;
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
  settingsKey: 'productSync' | 'inventorySync';
  status: BlingSyncJobStatus;
  summary?: Record<string, unknown>;
  updateLastSyncAt?: boolean;
}) {
  const supabase = requireAdminClient();

  const current = await getBlingEncryptedCredentialsFromRepository(input.storeId);
  const previousSettings = current?.settings ?? {};
  const updatedAt = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    settings_json: {
      ...previousSettings,
      [input.settingsKey]: {
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
  status: Exclude<BlingSyncJobStatus, 'running'>;
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
  status: BlingSyncJobStatus;
  summary?: Record<string, unknown>;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'productSync',
    updateLastSyncAt: true,
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
  status: Exclude<BlingSyncJobStatus, 'running'>;
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
  status: BlingSyncJobStatus;
  summary?: Record<string, unknown>;
}) {
  return recordBlingSyncEventInRepository({
    ...input,
    settingsKey: 'inventorySync',
  });
}
