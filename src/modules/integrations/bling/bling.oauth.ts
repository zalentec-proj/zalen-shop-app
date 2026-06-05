import 'server-only';

import { z } from 'zod';
import type { BlingOAuthConfig, BlingTokenResponse } from './bling.types';

const blingTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});

export class BlingOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'BlingOAuthError';
  }
}

export function buildBlingAuthorizationUrl(
  config: BlingOAuthConfig,
  state: string
) {
  if (!config.clientId) {
    throw new BlingOAuthError(
      'Bling OAuth client ID is not configured.',
      'missing_client_id'
    );
  }

  const url = new URL(config.authorizationUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', config.redirectUri);

  if (config.scopes.length > 0) {
    url.searchParams.set('scope', config.scopes.join(' '));
  }

  return url;
}

export async function exchangeBlingAuthorizationCode(
  config: BlingOAuthConfig,
  code: string
): Promise<BlingTokenResponse> {
  if (!config.clientId || !config.clientSecret) {
    throw new BlingOAuthError(
      'Bling OAuth credentials are not configured.',
      'missing_oauth_credentials'
    );
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'enable-jwt': '1',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new BlingOAuthError(
      'Bling OAuth token exchange failed.',
      'token_exchange_failed',
      response.status
    );
  }

  const parsed = blingTokenResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new BlingOAuthError(
      'Bling OAuth token response is invalid.',
      'invalid_token_response',
      response.status
    );
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in,
    tokenType: parsed.data.token_type,
    scope: parsed.data.scope,
    receivedAt: new Date().toISOString(),
  };
}
