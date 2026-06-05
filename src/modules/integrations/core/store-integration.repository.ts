import 'server-only';

import { logDevOnce } from '@/lib/logging/dev';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  IntegrationDataSource,
  IntegrationRepositoryResult,
} from './integration-provider.types';
import {
  listIntegrationProvidersWithSourceFromRepository,
  mockIntegrationProviders,
} from './integration-provider.repository';
import type {
  StoreIntegration,
  StoreIntegrationListItem,
  StoreIntegrationStatus,
} from './store-integration.types';

type StoreIntegrationRow = {
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

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const storeIntegrationStatuses: StoreIntegrationStatus[] = [
  'planned',
  'pending_credentials',
  'disconnected',
  'connected',
  'error',
  'syncing',
  'disabled',
];

const fallbackDate = new Date(0).toISOString();

function toCompactLogText(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').slice(0, 220);
}

function getQueryErrorDetails(error: RepositoryError | null) {
  return {
    code: error?.code ?? 'unknown',
    details: toCompactLogText(error?.details),
    hint: toCompactLogText(error?.hint),
    message: error?.message ?? 'query-error',
  };
}

function toStoreIntegrationStatus(value: string): StoreIntegrationStatus {
  return storeIntegrationStatuses.includes(value as StoreIntegrationStatus)
    ? (value as StoreIntegrationStatus)
    : 'disconnected';
}

function mapStoreIntegration(row: StoreIntegrationRow): StoreIntegration {
  return {
    id: row.id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    environment: row.environment,
    status: toStoreIntegrationStatus(row.status),
    settings: row.settings_json ?? {},
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function mapProvidersWithoutStoreRows(
  source: IntegrationDataSource
): IntegrationRepositoryResult<StoreIntegrationListItem[]> {
  return {
    data: mockIntegrationProviders.map((provider) => ({ provider })),
    source,
  };
}

export async function listStoreIntegrationsWithSourceFromRepository(
  storeId: string
): Promise<IntegrationRepositoryResult<StoreIntegrationListItem[]>> {
  const providersResult =
    await listIntegrationProvidersWithSourceFromRepository();
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    logDevOnce('store-integration.repository', 'using provider-only fallback', {
      reason: 'supabase-admin-env-missing',
      storeId,
    });

    return {
      data: providersResult.data.map((provider) => ({ provider })),
      source: providersResult.source,
    };
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select(
      'id, store_id, provider_key, environment, status, settings_json, last_sync_at, created_at, updated_at'
    )
    .eq('store_id', storeId);

  if (error || !data) {
    logDevOnce('store-integration.repository', 'using provider-only fallback', {
      reason: 'store-integrations-query-failed',
      storeId,
      ...getQueryErrorDetails(error),
    });

    return providersResult.data.length > 0
      ? {
          data: providersResult.data.map((provider) => ({ provider })),
          source: providersResult.source,
        }
      : mapProvidersWithoutStoreRows('mock');
  }

  const integrationsByProviderKey = new Map(
    (data as StoreIntegrationRow[]).map((row) => [
      row.provider_key,
      mapStoreIntegration(row),
    ])
  );

  return {
    data: providersResult.data.map((provider) => ({
      provider,
      integration: integrationsByProviderKey.get(provider.key),
    })),
    source: 'supabase',
  };
}
