import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import { isIntegrationCredentialEncryptionConfigured } from '../core/credential-vault';
import type {
  MercadoPagoEnvironment,
  MercadoPagoOAuthConfig,
} from './mercado-pago.types';

export const MERCADO_PAGO_PROVIDER_KEY = 'mercado_pago';
export const MERCADO_PAGO_ADMIN_DETAIL_PATH = '/admin/integracoes/mercado-pago';

const MERCADO_PAGO_AUTHORIZATION_URL =
  'https://auth.mercadopago.com/authorization';
const MERCADO_PAGO_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';

export function toMercadoPagoEnvironment(
  value: string | null | undefined
): MercadoPagoEnvironment {
  return value === 'production' ? 'production' : 'test';
}

export function parseMercadoPagoEnvironment(
  value: string | null | undefined
): MercadoPagoEnvironment | null {
  return value === 'test' || value === 'production' ? value : null;
}

export function getDefaultMercadoPagoEnvironment(): MercadoPagoEnvironment {
  return toMercadoPagoEnvironment(getServerEnv().MERCADO_PAGO_ENV);
}

export function getMercadoPagoOAuthConfig(): MercadoPagoOAuthConfig {
  const env = getServerEnv();
  const appUrl = env.APP_URL ?? 'http://localhost:3000';
  const redirectUri =
    env.MERCADO_PAGO_REDIRECT_URI ??
    `${appUrl}/api/integrations/mercado-pago/callback`;

  return {
    authorizationUrl: MERCADO_PAGO_AUTHORIZATION_URL,
    tokenUrl: MERCADO_PAGO_TOKEN_URL,
    clientId: env.MERCADO_PAGO_CLIENT_ID,
    clientSecret: env.MERCADO_PAGO_CLIENT_SECRET,
    redirectUri,
    scopes: ['offline_access'],
    isConfigured: Boolean(
      env.MERCADO_PAGO_CLIENT_ID && env.MERCADO_PAGO_CLIENT_SECRET
    ),
    isEncryptionConfigured: isIntegrationCredentialEncryptionConfigured(),
  };
}

export function getMercadoPagoConnectPath(
  environment: MercadoPagoEnvironment
) {
  return `/api/integrations/mercado-pago/connect?environment=${environment}`;
}

export function getMercadoPagoWebhookSecret(
  environment: MercadoPagoEnvironment
) {
  const env = getServerEnv();

  if (environment === 'production') {
    return (
      env.MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION ??
      env.MERCADO_PAGO_WEBHOOK_SECRET
    );
  }

  return env.MERCADO_PAGO_WEBHOOK_SECRET_TEST ?? env.MERCADO_PAGO_WEBHOOK_SECRET;
}
