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
  settings_json: Record<string, unknown> | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  await upsertBlingIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'connected',
    credentialsEncrypted: input.credentialsEncrypted,
    settings: {
      primary: true,
      connectedAt: new Date().toISOString(),
      expiresIn: input.expiresIn,
      scope: input.scope,
    },
  });
}
