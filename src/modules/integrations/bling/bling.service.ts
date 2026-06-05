import 'server-only';

import {
  encryptIntegrationCredentials,
  isIntegrationCredentialEncryptionConfigured,
} from '../core/credential-vault';
import { BLING_CONNECT_PATH, getBlingOAuthConfig } from './bling.config';
import {
  getBlingIntegrationFromRepository,
  markBlingConnectionAttemptInRepository,
  markBlingConnectionErrorInRepository,
  saveBlingCredentialsInRepository,
} from './bling.repository';
import type { BlingAdminState, BlingTokenResponse } from './bling.types';

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

export async function getBlingAdminState(
  storeId: string
): Promise<BlingAdminState> {
  const config = getBlingOAuthConfig();
  const integration = await getBlingIntegrationFromRepository(storeId);
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
