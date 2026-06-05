import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import { isIntegrationCredentialEncryptionConfigured } from '../core/credential-vault';
import type { BlingEnvironment, BlingOAuthConfig } from './bling.types';

export const BLING_PROVIDER_KEY = 'bling';
export const BLING_CONNECT_PATH = '/api/integrations/bling/connect';
export const BLING_ADMIN_DETAIL_PATH = '/admin/integracoes/bling';

const BLING_AUTHORIZATION_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';

function toBlingEnvironment(value: string | undefined): BlingEnvironment {
  return value === 'production' ? 'production' : 'sandbox';
}

function splitScopes(value: string | undefined) {
  return value
    ?.split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean) ?? [];
}

export function getBlingOAuthConfig(): BlingOAuthConfig {
  const env = getServerEnv();
  const appUrl = env.APP_URL ?? 'http://localhost:3000';
  const redirectUri =
    env.BLING_REDIRECT_URI ?? `${appUrl}/api/integrations/bling/callback`;
  const environment = toBlingEnvironment(env.BLING_ENV);

  return {
    authorizationUrl: BLING_AUTHORIZATION_URL,
    tokenUrl: BLING_TOKEN_URL,
    clientId: env.BLING_CLIENT_ID,
    clientSecret: env.BLING_CLIENT_SECRET,
    redirectUri,
    scopes: splitScopes(env.BLING_SCOPES),
    environment,
    isConfigured: Boolean(env.BLING_CLIENT_ID && env.BLING_CLIENT_SECRET),
    isEncryptionConfigured: isIntegrationCredentialEncryptionConfigured(),
  };
}
