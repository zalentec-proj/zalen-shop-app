import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { StoreIntegration } from '../core/store-integration.types';
import { MERCADO_PAGO_PROVIDER_KEY } from './mercado-pago.config';
import type {
  MercadoPagoConnectedAccount,
  MercadoPagoEnvironment,
} from './mercado-pago.types';

type MercadoPagoIntegrationRow = {
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

export interface MercadoPagoIntegrationRecord extends StoreIntegration {
  credentialsEncrypted?: string;
}

const fallbackDate = new Date(0).toISOString();

function requireAdminClient() {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabase;
}

function toStatus(value: string): StoreIntegration['status'] {
  const allowed: StoreIntegration['status'][] = [
    'planned',
    'pending_credentials',
    'disconnected',
    'connected',
    'error',
    'syncing',
    'disabled',
  ];

  return allowed.includes(value as StoreIntegration['status'])
    ? (value as StoreIntegration['status'])
    : 'pending_credentials';
}

function toEnvironment(value: string): MercadoPagoEnvironment {
  return value === 'production' ? 'production' : 'test';
}

function mapIntegration(
  row: MercadoPagoIntegrationRow
): MercadoPagoIntegrationRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    providerKey: row.provider_key,
    environment: toEnvironment(row.environment),
    status: toStatus(row.status),
    credentialsEncrypted: row.credentials_encrypted ?? undefined,
    settings: row.settings_json ?? {},
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

async function upsertMercadoPagoIntegration(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  status: StoreIntegration['status'];
  credentialsEncrypted?: string | null;
  settings: Record<string, unknown>;
}) {
  const supabase = requireAdminClient();
  const payload: Record<string, unknown> = {
    store_id: input.storeId,
    provider_key: MERCADO_PAGO_PROVIDER_KEY,
    environment: input.environment,
    status: input.status,
    settings_json: input.settings,
    updated_at: new Date().toISOString(),
  };

  if (input.credentialsEncrypted !== undefined) {
    payload.credentials_encrypted = input.credentialsEncrypted;
  }

  const { error } = await supabase.from('store_integrations').upsert(payload, {
    onConflict: 'store_id,provider_key,environment',
  });

  if (error) {
    throw new Error('Unable to update Mercado Pago store integration.');
  }
}

export async function getMercadoPagoIntegrationFromRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
}): Promise<MercadoPagoIntegrationRecord | null> {
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
    .eq('provider_key', MERCADO_PAGO_PROVIDER_KEY)
    .eq('environment', input.environment)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapIntegration(data as MercadoPagoIntegrationRow);
}

export async function listMercadoPagoIntegrationsFromRepository(
  storeId: string
): Promise<MercadoPagoIntegrationRecord[]> {
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
    .eq('provider_key', MERCADO_PAGO_PROVIDER_KEY);

  if (error || !data) {
    return [];
  }

  return (data as MercadoPagoIntegrationRow[]).map(mapIntegration);
}

export async function markMercadoPagoConnectionAttemptInRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  userId: string;
}) {
  const current = await getMercadoPagoIntegrationFromRepository(input);
  const previousSettings = current?.settings ?? {};
  const now = new Date().toISOString();

  await upsertMercadoPagoIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'pending_credentials',
    settings: {
      ...previousSettings,
      credentialsSource: 'oauth',
      lastConnectionAttemptAt: now,
      lastConnectionAttemptUserId: input.userId,
      checkoutPro: {
        ...(typeof previousSettings.checkoutPro === 'object' &&
        previousSettings.checkoutPro &&
        !Array.isArray(previousSettings.checkoutPro)
          ? (previousSettings.checkoutPro as Record<string, unknown>)
          : {}),
        enabled: true,
        mode: 'checkout_pro',
      },
    },
  });
}

export async function markMercadoPagoConnectionErrorInRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  errorCode: string;
}) {
  const current = await getMercadoPagoIntegrationFromRepository(input);
  const previousSettings = current?.settings ?? {};

  await upsertMercadoPagoIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'error',
    settings: {
      ...previousSettings,
      credentialsSource: 'oauth',
      lastConnectionErrorAt: new Date().toISOString(),
      lastConnectionErrorCode: input.errorCode,
    },
  });
}

export async function saveMercadoPagoCredentialsInRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  credentialsEncrypted: string;
  account: MercadoPagoConnectedAccount;
  tokenExpiresAt?: string;
  scope?: string;
}) {
  const current = await getMercadoPagoIntegrationFromRepository(input);
  const previousSettings = current?.settings ?? {};
  const now = new Date().toISOString();

  await upsertMercadoPagoIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'connected',
    credentialsEncrypted: input.credentialsEncrypted,
    settings: {
      ...previousSettings,
      credentialsSource: 'oauth',
      account: input.account,
      connectedAt:
        typeof previousSettings.connectedAt === 'string'
          ? previousSettings.connectedAt
          : now,
      credentialsUpdatedAt: now,
      tokenExpiresAt: input.tokenExpiresAt,
      scope: input.scope,
      checkoutPro: {
        ...(typeof previousSettings.checkoutPro === 'object' &&
        previousSettings.checkoutPro &&
        !Array.isArray(previousSettings.checkoutPro)
          ? (previousSettings.checkoutPro as Record<string, unknown>)
          : {}),
        enabled: true,
        mode: 'checkout_pro',
      },
    },
  });
}

export async function saveMercadoPagoRefreshedCredentialsInRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  credentialsEncrypted: string;
  tokenExpiresAt?: string;
  scope?: string;
}) {
  const current = await getMercadoPagoIntegrationFromRepository(input);
  const previousSettings = current?.settings ?? {};

  await upsertMercadoPagoIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'connected',
    credentialsEncrypted: input.credentialsEncrypted,
    settings: {
      ...previousSettings,
      credentialsSource: 'oauth',
      credentialsUpdatedAt: new Date().toISOString(),
      tokenExpiresAt: input.tokenExpiresAt,
      scope: input.scope,
    },
  });
}

export async function disconnectMercadoPagoIntegrationInRepository(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
}) {
  const current = await getMercadoPagoIntegrationFromRepository(input);
  const previousSettings = current?.settings ?? {};

  await upsertMercadoPagoIntegration({
    storeId: input.storeId,
    environment: input.environment,
    status: 'disconnected',
    credentialsEncrypted: null,
    settings: {
      ...previousSettings,
      disconnectedAt: new Date().toISOString(),
      checkoutPro: {
        ...(typeof previousSettings.checkoutPro === 'object' &&
        previousSettings.checkoutPro &&
        !Array.isArray(previousSettings.checkoutPro)
          ? (previousSettings.checkoutPro as Record<string, unknown>)
          : {}),
        enabled: false,
        mode: 'checkout_pro',
      },
    },
  });
}
