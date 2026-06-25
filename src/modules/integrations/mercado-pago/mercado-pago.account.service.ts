import 'server-only';

import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  isIntegrationCredentialEncryptionConfigured,
} from '../core/credential-vault';
import {
  getDefaultMercadoPagoEnvironment,
  getMercadoPagoConnectPath,
  getMercadoPagoOAuthConfig,
  getMercadoPagoWebhookSecret,
} from './mercado-pago.config';
import {
  disconnectMercadoPagoIntegrationInRepository,
  listMercadoPagoIntegrationsFromRepository,
  markMercadoPagoConnectionAttemptInRepository,
  markMercadoPagoConnectionErrorInRepository,
  saveMercadoPagoCredentialsInRepository,
} from './mercado-pago.repository';
import type {
  MercadoPagoAdminState,
  MercadoPagoConnectedAccount,
  MercadoPagoCredentials,
  MercadoPagoCredentialsSource,
  MercadoPagoEnvironment,
  MercadoPagoEnvironmentAdminState,
  MercadoPagoOAuthTokenResponse,
  MercadoPagoRuntimeStatus,
} from './mercado-pago.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getSettingsRecord(
  settings: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = settings[key];

  return isRecord(value) ? value : {};
}

function toCredentialsSource(
  value: unknown,
  fallback: MercadoPagoCredentialsSource
): MercadoPagoCredentialsSource {
  return value === 'oauth' || value === 'env' ? value : fallback;
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function toAccount(settings: Record<string, unknown>): MercadoPagoConnectedAccount | undefined {
  const account = getSettingsRecord(settings, 'account');

  if (Object.keys(account).length === 0) {
    return undefined;
  }

  return {
    userId: toOptionalString(account.userId),
    email: toOptionalString(account.email),
    nickname: toOptionalString(account.nickname),
    publicKey: toOptionalString(account.publicKey),
    liveMode: toOptionalBoolean(account.liveMode),
  };
}

function isCheckoutEnabled(settings: Record<string, unknown>) {
  return getSettingsRecord(settings, 'checkoutPro').enabled !== false;
}

function isExpired(value: string | undefined) {
  return value ? new Date(value).getTime() < Date.now() : false;
}

function getStatus(input: {
  integrationStatus?: string;
  credentialsEncrypted?: string;
  enabled: boolean;
  tokenExpiresAt?: string;
}): MercadoPagoRuntimeStatus {
  if (!input.enabled || input.integrationStatus === 'disabled') {
    return 'disabled';
  }

  if (input.integrationStatus === 'error') {
    return 'error';
  }

  if (input.integrationStatus === 'disconnected') {
    return 'disconnected';
  }

  if (input.credentialsEncrypted) {
    return isExpired(input.tokenExpiresAt) ? 'expired' : 'connected';
  }

  return 'pending_credentials';
}

function toEnvironmentState(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  integration?: Awaited<ReturnType<typeof listMercadoPagoIntegrationsFromRepository>>[number];
  canStartOAuth: boolean;
}): MercadoPagoEnvironmentAdminState {
  const settings = input.integration?.settings ?? {};
  const tokenExpiresAt = toOptionalString(settings.tokenExpiresAt);
  const webhookSecretConfigured = Boolean(
    getMercadoPagoWebhookSecret(input.environment)
  );
  const enabled =
    input.integration?.status !== 'disabled' &&
    input.integration?.status !== 'disconnected' &&
    isCheckoutEnabled(settings);
  const credentialsSource = toCredentialsSource(settings.credentialsSource, 'oauth');
  const status = getStatus({
    integrationStatus: input.integration?.status,
    credentialsEncrypted: input.integration?.credentialsEncrypted,
    enabled,
    tokenExpiresAt,
  });
  const warnings: string[] = [];

  if (status === 'expired') {
    warnings.push('Token vencido; a próxima operação tentará renovar com refresh token.');
  }

  if (status === 'pending_credentials') {
    warnings.push('Ambiente ainda não autorizado por OAuth.');
  }

  if (!webhookSecretConfigured) {
    warnings.push('Segredo de webhook deste ambiente ainda não está configurado.');
  }

  return {
    environment: input.environment,
    status,
    enabled,
    configured: Boolean(input.integration?.credentialsEncrypted && webhookSecretConfigured),
    credentialsSource,
    integrationStatus: input.integration?.status,
    account: toAccount(settings),
    connectedAt: toOptionalString(settings.connectedAt),
    tokenExpiresAt,
    lastUpdatedAt: input.integration?.updatedAt,
    canStartOAuth: input.canStartOAuth,
    canTestConnection: Boolean(input.integration?.credentialsEncrypted),
    connectPath: getMercadoPagoConnectPath(input.environment),
    warnings,
  };
}

function getConnectedAccount(
  tokens: MercadoPagoOAuthTokenResponse
): MercadoPagoConnectedAccount {
  return {
    userId: tokens.userId,
    publicKey: tokens.publicKey,
    liveMode: tokens.liveMode,
  };
}

export async function getMercadoPagoAdminState(
  storeId: string
): Promise<MercadoPagoAdminState> {
  const config = getMercadoPagoOAuthConfig();
  const integrations = await listMercadoPagoIntegrationsFromRepository(storeId);
  const byEnvironment = new Map(
    integrations.map((integration) => [
      integration.environment as MercadoPagoEnvironment,
      integration,
    ])
  );
  const warnings: string[] = [];

  if (!config.isConfigured) {
    warnings.push('Configuração OAuth Mercado Pago pendente no ambiente.');
  }

  if (!config.isEncryptionConfigured) {
    warnings.push('Criptografia de credenciais pendente no ambiente.');
  }

  return {
    providerKey: 'mercado_pago',
    isOAuthConfigured: config.isConfigured,
    isEncryptionConfigured: config.isEncryptionConfigured,
    warnings,
    environments: (['test', 'production'] as MercadoPagoEnvironment[]).map(
      (environment) =>
        toEnvironmentState({
          storeId,
          environment,
          integration: byEnvironment.get(environment),
          canStartOAuth: config.isConfigured && config.isEncryptionConfigured,
        })
    ),
  };
}

export async function recordMercadoPagoConnectionAttempt(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  userId: string;
}) {
  try {
    await markMercadoPagoConnectionAttemptInRepository(input);
  } catch {
    // Best-effort operational marker. Never block OAuth before external redirect.
  }
}

export async function recordMercadoPagoConnectionError(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  errorCode: string;
}) {
  try {
    await markMercadoPagoConnectionErrorInRepository(input);
  } catch {
    // Best-effort operational marker. Keep failures controlled and token-free.
  }
}

export async function saveMercadoPagoOAuthTokens(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
  tokens: MercadoPagoOAuthTokenResponse;
}) {
  if (!isIntegrationCredentialEncryptionConfigured()) {
    await recordMercadoPagoConnectionError({
      storeId: input.storeId,
      environment: input.environment,
      errorCode: 'encryption_not_configured',
    });

    throw new Error('Integration credential encryption is not configured.');
  }

  const credentials: MercadoPagoCredentials = {
    provider: 'mercado_pago',
    environment: input.environment,
    ...input.tokens,
  };
  const credentialsEncrypted = encryptIntegrationCredentials(credentials);

  await saveMercadoPagoCredentialsInRepository({
    storeId: input.storeId,
    environment: input.environment,
    credentialsEncrypted,
    account: getConnectedAccount(input.tokens),
    tokenExpiresAt: input.tokens.expiresAt,
    scope: input.tokens.scope,
  });
}

export async function disconnectMercadoPagoIntegration(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
}) {
  await disconnectMercadoPagoIntegrationInRepository(input);
}

export function decryptMercadoPagoCredentials(
  credentialsEncrypted: string
): MercadoPagoCredentials {
  return decryptIntegrationCredentials<MercadoPagoCredentials>(
    credentialsEncrypted
  );
}

export function getMercadoPagoAdminDefaultEnvironment() {
  return getDefaultMercadoPagoEnvironment();
}
