import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  isIntegrationCredentialEncryptionConfigured,
} from '@/modules/integrations/core/credential-vault';
import type { StoreIntegrationStatus } from '@/modules/integrations/core/store-integration.types';
import {
  marketingProviderKeys,
  type MarketingAdminEvent,
  type MarketingEventPayload,
  type MarketingProviderKey,
} from './marketing.types';

type MarketingIntegrationRow = {
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

type MarketingEventRow = {
  id: string;
  store_id: string;
  provider_key: string;
  event_name: string;
  event_id: string;
  source: string;
  order_id: string | null;
  order_number: string | null;
  status: string;
  occurred_at: string | null;
  processed_at: string | null;
  value: number | string | null;
  currency: string | null;
  payload_json: Record<string, unknown> | null;
  response_json: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketingIntegrationRecord = {
  id: string;
  storeId: string;
  providerKey: MarketingProviderKey;
  environment: string;
  status: StoreIntegrationStatus;
  settings: Record<string, unknown>;
  credentialsEncrypted?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MetaCapiCredentials = {
  accessToken?: string;
};

const fallbackDate = new Date(0).toISOString();

function isMarketingProviderKey(value: string): value is MarketingProviderKey {
  return marketingProviderKeys.includes(value as MarketingProviderKey);
}

function toStatus(value: string): StoreIntegrationStatus {
  const allowed: StoreIntegrationStatus[] = [
    'planned',
    'pending_credentials',
    'disconnected',
    'connected',
    'error',
    'syncing',
    'disabled',
  ];

  return allowed.includes(value as StoreIntegrationStatus)
    ? (value as StoreIntegrationStatus)
    : 'disconnected';
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requireAdminClient() {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabase;
}

function mapIntegration(
  row: MarketingIntegrationRow
): MarketingIntegrationRecord | null {
  if (!isMarketingProviderKey(row.provider_key)) {
    return null;
  }

  return {
    id: row.id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    environment: row.environment,
    status: toStatus(row.status),
    credentialsEncrypted: row.credentials_encrypted ?? undefined,
    settings: row.settings_json ?? {},
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function mapEvent(row: MarketingEventRow): MarketingAdminEvent | null {
  if (!isMarketingProviderKey(row.provider_key)) {
    return null;
  }

  return {
    id: row.id,
    providerKey: row.provider_key,
    eventName: row.event_name,
    eventId: row.event_id,
    source: row.source,
    status: row.status,
    orderNumber: row.order_number ?? undefined,
    value: toNumber(row.value),
    currency: row.currency ?? undefined,
    occurredAt: row.occurred_at ?? fallbackDate,
    processedAt: row.processed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

export async function listMarketingIntegrationsFromRepository(
  storeId: string
): Promise<MarketingIntegrationRecord[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('store_integrations')
    .select(
      'id, store_id, provider_key, environment, status, credentials_encrypted, settings_json, last_sync_at, created_at, updated_at'
    )
    .eq('store_id', storeId)
    .in('provider_key', [...marketingProviderKeys])
    .eq('environment', 'production');

  if (error || !data) {
    return [];
  }

  return (data as MarketingIntegrationRow[])
    .map(mapIntegration)
    .filter((row): row is MarketingIntegrationRecord => Boolean(row));
}

export async function getMarketingIntegrationFromRepository(input: {
  storeId: string;
  providerKey: MarketingProviderKey;
}): Promise<MarketingIntegrationRecord | null> {
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
    .eq('provider_key', input.providerKey)
    .eq('environment', 'production')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapIntegration(data as MarketingIntegrationRow);
}

export async function upsertMarketingIntegrationInRepository(input: {
  storeId: string;
  providerKey: MarketingProviderKey;
  status: StoreIntegrationStatus;
  settings: Record<string, unknown>;
  credentials?: MetaCapiCredentials | null;
  preserveCredentials?: boolean;
}) {
  const supabase = requireAdminClient();
  const payload: Record<string, unknown> = {
    store_id: input.storeId,
    provider_key: input.providerKey,
    environment: 'production',
    status: input.status,
    settings_json: input.settings,
    updated_at: new Date().toISOString(),
  };

  if (input.credentials) {
    payload.credentials_encrypted = encryptIntegrationCredentials(
      input.credentials
    );
  } else if (!input.preserveCredentials) {
    payload.credentials_encrypted = null;
  }

  const { error } = await supabase.from('store_integrations').upsert(payload, {
    onConflict: 'store_id,provider_key,environment',
  });

  if (error) {
    throw new Error('Unable to update marketing integration.');
  }
}

export function canEncryptMarketingCredentials() {
  return isIntegrationCredentialEncryptionConfigured();
}

export async function getMetaCapiCredentialsFromRepository(input: {
  storeId: string;
}): Promise<MetaCapiCredentials | null> {
  const integration = await getMarketingIntegrationFromRepository({
    storeId: input.storeId,
    providerKey: 'meta_conversions_api',
  });

  if (!integration?.credentialsEncrypted) {
    return null;
  }

  return decryptIntegrationCredentials<MetaCapiCredentials>(
    integration.credentialsEncrypted
  );
}

export async function listRecentMarketingEventsFromRepository(
  storeId: string,
  limit = 12
): Promise<MarketingAdminEvent[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('marketing_events')
    .select(
      'id, store_id, provider_key, event_name, event_id, source, order_id, order_number, status, occurred_at, processed_at, value, currency, payload_json, response_json, error_message, created_at, updated_at'
    )
    .eq('store_id', storeId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return (data as MarketingEventRow[])
    .map(mapEvent)
    .filter((row): row is MarketingAdminEvent => Boolean(row));
}

export async function createMarketingEventIfMissingInRepository(
  payload: MarketingEventPayload
): Promise<{ created: boolean; id?: string }> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return { created: false };
  }

  const existing = await supabase
    .from('marketing_events')
    .select('id, status')
    .eq('store_id', payload.storeId)
    .eq('provider_key', payload.providerKey)
    .eq('event_name', payload.eventName)
    .eq('event_id', payload.eventId)
    .maybeSingle();

  if (existing.data) {
    return { created: false, id: existing.data.id as string };
  }

  const { data, error } = await supabase
    .from('marketing_events')
    .insert({
      store_id: payload.storeId,
      provider_key: payload.providerKey,
      event_name: payload.eventName,
      event_id: payload.eventId,
      source: payload.source,
      order_id: payload.orderId,
      order_number: payload.orderNumber,
      occurred_at: payload.occurredAt,
      value: payload.value,
      currency: payload.currency,
      payload_json: payload,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    return { created: false };
  }

  return { created: true, id: data?.id as string | undefined };
}

export async function updateMarketingEventResultInRepository(input: {
  storeId: string;
  providerKey: MarketingProviderKey;
  eventName: string;
  eventId: string;
  status: 'sent' | 'skipped' | 'error';
  response?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  await supabase
    .from('marketing_events')
    .update({
      status: input.status,
      response_json: input.response ?? {},
      error_message: input.errorMessage,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', input.storeId)
    .eq('provider_key', input.providerKey)
    .eq('event_name', input.eventName)
    .eq('event_id', input.eventId);
}
