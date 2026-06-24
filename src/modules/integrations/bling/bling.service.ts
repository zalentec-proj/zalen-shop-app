import 'server-only';

import {
  encryptIntegrationCredentials,
  isIntegrationCredentialEncryptionConfigured,
} from '../core/credential-vault';
import { BLING_CONNECT_PATH, getBlingOAuthConfig } from './bling.config';
import {
  getBlingIntegrationFromRepository,
  getBlingWebhookOperationalSummaryFromRepository,
  markBlingConnectionAttemptInRepository,
  markBlingConnectionErrorInRepository,
  saveBlingCredentialsInRepository,
} from './bling.repository';
import type { BlingAdminState, BlingTokenResponse } from './bling.types';

type BlingHomologationAdminState = NonNullable<BlingAdminState['homologation']>;
type BlingProductSyncAdminState = NonNullable<BlingAdminState['productSync']>;
type BlingInventorySyncAdminState = NonNullable<BlingAdminState['inventorySync']>;
type BlingOrderSendAdminState = BlingAdminState['orderSend'];

function toBlingConnectionStatus(status: string | undefined) {
  if (
    status === 'planned' ||
    status === 'pending_credentials' ||
    status === 'connected' ||
    status === 'error' ||
    status === 'disconnected'
  ) {
    return status;
  }

  return 'pending_credentials';
}

function toBlingHomologationState(settings: Record<string, unknown>) {
  const homologation = settings.homologation;

  if (!homologation || typeof homologation !== 'object') {
    return undefined;
  }

  const record = homologation as Record<string, unknown>;
  const status = record.status;

  if (status !== 'running' && status !== 'success' && status !== 'error') {
    return undefined;
  }

  return {
    status,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    summary:
      record.summary && typeof record.summary === 'object'
        ? (record.summary as BlingHomologationAdminState['summary'])
        : undefined,
  } satisfies BlingHomologationAdminState;
}

function toBlingProductSyncState(settings: Record<string, unknown>) {
  const productSync = settings.productSync;

  if (!productSync || typeof productSync !== 'object') {
    return undefined;
  }

  const record = productSync as Record<string, unknown>;
  const status = record.status;

  if (status !== 'running' && status !== 'success' && status !== 'error') {
    return undefined;
  }

  return {
    status,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    summary:
      record.summary && typeof record.summary === 'object'
        ? (record.summary as BlingProductSyncAdminState['summary'])
        : undefined,
  } satisfies BlingProductSyncAdminState;
}

function toBlingInventorySyncState(settings: Record<string, unknown>) {
  const inventorySync = settings.inventorySync;

  if (!inventorySync || typeof inventorySync !== 'object') {
    return undefined;
  }

  const record = inventorySync as Record<string, unknown>;
  const status = record.status;

  if (status !== 'running' && status !== 'success' && status !== 'error') {
    return undefined;
  }

  return {
    status,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    summary:
      record.summary && typeof record.summary === 'object'
        ? (record.summary as BlingInventorySyncAdminState['summary'])
        : undefined,
  } satisfies BlingInventorySyncAdminState;
}

function toBlingOrderSendState(
  settings: Record<string, unknown>
): BlingOrderSendAdminState {
  const orderSend = settings.orderSend;

  if (!orderSend || typeof orderSend !== 'object') {
    return { enabled: false };
  }

  const record = orderSend as Record<string, unknown>;
  const status = record.status;

  return {
    enabled: record.enabled === true,
    status:
      status === 'running' || status === 'success' || status === 'error'
        ? status
        : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    summary:
      record.summary && typeof record.summary === 'object'
        ? (record.summary as BlingOrderSendAdminState['summary'])
        : undefined,
  };
}

export async function getBlingAdminState(
  storeId: string
): Promise<BlingAdminState> {
  const config = getBlingOAuthConfig();
  const [integration, webhooks] = await Promise.all([
    getBlingIntegrationFromRepository(storeId),
    getBlingWebhookOperationalSummaryFromRepository(storeId),
  ]);
  const warnings: string[] = [];

  if (!config.isConfigured) {
    warnings.push('Configuração do Bling pendente no ambiente.');
  }

  if (!config.isEncryptionConfigured) {
    warnings.push('Criptografia de credenciais pendente no ambiente.');
  }

  return {
    providerKey: 'bling',
    status: toBlingConnectionStatus(integration?.status),
    environment: integration?.environment ?? config.environment,
    lastSyncAt: integration?.lastSyncAt,
    lastUpdatedAt: integration?.updatedAt,
    isOAuthConfigured: config.isConfigured,
    isEncryptionConfigured: config.isEncryptionConfigured,
    canStartOAuth: config.isConfigured && config.isEncryptionConfigured,
    connectPath: BLING_CONNECT_PATH,
    warnings,
    homologation: integration
      ? toBlingHomologationState(integration.settings)
      : undefined,
    productSync: integration
      ? toBlingProductSyncState(integration.settings)
      : undefined,
    inventorySync: integration
      ? toBlingInventorySyncState(integration.settings)
      : undefined,
    orderSend: integration
      ? toBlingOrderSendState(integration.settings)
      : { enabled: false },
    webhooks,
  };
}

export async function recordBlingConnectionAttempt(input: {
  storeId: string;
  userId: string;
}) {
  const config = getBlingOAuthConfig();

  try {
    await markBlingConnectionAttemptInRepository({
      storeId: input.storeId,
      environment: config.environment,
      userId: input.userId,
    });
  } catch {
    // Best-effort operational marker. Never block OAuth before external redirect.
  }
}

export async function recordBlingConnectionError(input: {
  storeId: string;
  errorCode: string;
}) {
  const config = getBlingOAuthConfig();

  try {
    await markBlingConnectionErrorInRepository({
      storeId: input.storeId,
      environment: config.environment,
      errorCode: input.errorCode,
    });
  } catch {
    // Best-effort operational marker. Keep failures controlled and token-free.
  }
}

export async function saveBlingOAuthTokens(input: {
  storeId: string;
  tokens: BlingTokenResponse;
}) {
  const config = getBlingOAuthConfig();

  if (!isIntegrationCredentialEncryptionConfigured()) {
    await recordBlingConnectionError({
      storeId: input.storeId,
      errorCode: 'encryption_not_configured',
    });

    throw new Error('Integration credential encryption is not configured.');
  }

  const credentialsEncrypted = encryptIntegrationCredentials({
    provider: 'bling',
    environment: config.environment,
    accessToken: input.tokens.accessToken,
    refreshToken: input.tokens.refreshToken,
    tokenType: input.tokens.tokenType,
    scope: input.tokens.scope,
    expiresIn: input.tokens.expiresIn,
    receivedAt: input.tokens.receivedAt,
  });

  await saveBlingCredentialsInRepository({
    storeId: input.storeId,
    environment: config.environment,
    credentialsEncrypted,
    expiresIn: input.tokens.expiresIn,
    scope: input.tokens.scope,
  });
}
