import 'server-only';

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';
import type {
  MercadoPagoEnvironment,
  MercadoPagoOAuthConfig,
  MercadoPagoOAuthState,
  MercadoPagoOAuthTokenResponse,
} from './mercado-pago.types';

const mercadoPagoTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  public_key: z.string().optional(),
  live_mode: z.boolean().optional(),
});

const mercadoPagoOAuthStateSchema = z.object({
  storeId: z.string().min(1),
  environment: z.enum(['test', 'production']),
  nonce: z.string().min(16),
  returnTo: z.string().startsWith('/'),
  expiresAt: z.number().int().positive(),
});

export class MercadoPagoOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'MercadoPagoOAuthError';
  }
}

function requireOAuthConfig(config: MercadoPagoOAuthConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth credentials are not configured.',
      'missing_oauth_credentials'
    );
  }
}

function encodeStatePayload(payload: MercadoPagoOAuthState) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeStatePayload(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signValue(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.byteLength === receivedBuffer.byteLength &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function toExpiresAt(expiresIn: number | undefined, receivedAt: Date) {
  if (!expiresIn || expiresIn <= 0) {
    return undefined;
  }

  return new Date(receivedAt.getTime() + expiresIn * 1000).toISOString();
}

function toTokenResponse(
  raw: z.infer<typeof mercadoPagoTokenResponseSchema>
): MercadoPagoOAuthTokenResponse {
  const receivedAt = new Date();

  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in,
    tokenType: raw.token_type,
    scope: raw.scope,
    userId:
      typeof raw.user_id === 'number' || typeof raw.user_id === 'string'
        ? String(raw.user_id)
        : undefined,
    publicKey: raw.public_key,
    liveMode: raw.live_mode,
    receivedAt: receivedAt.toISOString(),
    expiresAt: toExpiresAt(raw.expires_in, receivedAt),
  };
}

async function parseTokenResponse(
  response: Response,
  errorCode: string
): Promise<MercadoPagoOAuthTokenResponse> {
  if (!response.ok) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth request failed.',
      errorCode,
      response.status
    );
  }

  const parsed = mercadoPagoTokenResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth response is invalid.',
      'invalid_token_response',
      response.status
    );
  }

  return toTokenResponse(parsed.data);
}

export function createMercadoPagoOAuthState(input: {
  config: MercadoPagoOAuthConfig;
  storeId: string;
  environment: MercadoPagoEnvironment;
  returnTo: string;
}) {
  requireOAuthConfig(input.config);

  const payload: MercadoPagoOAuthState = {
    storeId: input.storeId,
    environment: input.environment,
    nonce: randomBytes(24).toString('base64url'),
    returnTo: input.returnTo.startsWith('/admin/')
      ? input.returnTo
      : '/admin/integracoes/mercado-pago',
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const encodedPayload = encodeStatePayload(payload);
  const signature = signValue(input.config.clientSecret!, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyMercadoPagoOAuthState(
  config: MercadoPagoOAuthConfig,
  state: string
): MercadoPagoOAuthState {
  requireOAuthConfig(config);

  const [encodedPayload, signature] = state.split('.');

  if (!encodedPayload || !signature) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth state is malformed.',
      'invalid_state'
    );
  }

  const expectedSignature = signValue(config.clientSecret!, encodedPayload);

  if (!signaturesMatch(expectedSignature, signature)) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth state signature is invalid.',
      'invalid_state_signature'
    );
  }

  const parsed = mercadoPagoOAuthStateSchema.safeParse(
    decodeStatePayload(encodedPayload)
  );

  if (!parsed.success || parsed.data.expiresAt < Date.now()) {
    throw new MercadoPagoOAuthError(
      'Mercado Pago OAuth state is invalid or expired.',
      'invalid_or_expired_state'
    );
  }

  return parsed.data;
}

export function buildMercadoPagoAuthorizationUrl(input: {
  config: MercadoPagoOAuthConfig;
  state: string;
}) {
  requireOAuthConfig(input.config);

  const url = new URL(input.config.authorizationUrl);
  url.searchParams.set('client_id', input.config.clientId!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', input.state);
  url.searchParams.set('redirect_uri', input.config.redirectUri);

  if (input.config.scopes.length > 0) {
    url.searchParams.set('scope', input.config.scopes.join(' '));
  }

  return url;
}

export async function exchangeMercadoPagoAuthorizationCode(input: {
  config: MercadoPagoOAuthConfig;
  code: string;
  environment: MercadoPagoEnvironment;
}): Promise<MercadoPagoOAuthTokenResponse> {
  requireOAuthConfig(input.config);

  const response = await fetch(input.config.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.config.redirectUri,
      test_token: input.environment === 'test',
    }),
    cache: 'no-store',
  });

  return parseTokenResponse(response, 'token_exchange_failed');
}

export async function refreshMercadoPagoAccessToken(input: {
  config: MercadoPagoOAuthConfig;
  refreshToken: string;
}): Promise<MercadoPagoOAuthTokenResponse> {
  requireOAuthConfig(input.config);

  const response = await fetch(input.config.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
    }),
    cache: 'no-store',
  });

  return parseTokenResponse(response, 'token_refresh_failed');
}
