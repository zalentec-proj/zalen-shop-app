import 'server-only';

import { z } from 'zod';
import { decryptIntegrationCredentials } from '../core/credential-vault';
import { getBlingOAuthConfig } from './bling.config';
import { refreshBlingAccessToken } from './bling.oauth';
import { getBlingEncryptedCredentialsFromRepository } from './bling.repository';
import { saveBlingOAuthTokens } from './bling.service';
import type { BlingTokenResponse } from './bling.types';

const baseUrl = 'https://api.bling.com.br/Api/v3';
const minimumRequestIntervalMs = 350;
const maxRateLimitRetries = 3;

const blingCredentialsSchema = z.object({
  provider: z.literal('bling'),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.string().optional(),
  scope: z.string().optional(),
  expiresIn: z.number().optional(),
  receivedAt: z.string().optional(),
});

type BlingApiClientInput = {
  accessToken: string;
  refreshToken: string;
  onTokensRefreshed: (tokens: BlingTokenResponse) => Promise<void>;
};

export class BlingApiClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number
  ) {
    super(code);
    this.name = 'BlingApiClientError';
  }
}

function parseJson(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractErrorCode(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const error = record.error;

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const type = errorRecord.type;
    const code = errorRecord.code;

    if (typeof type === 'string') {
      return type;
    }

    if (typeof code === 'string') {
      return code;
    }
  }

  return undefined;
}

function shouldAttemptRefresh(status: number, body: unknown) {
  const errorCode = extractErrorCode(body);

  return (
    status === 401 &&
    (!errorCode ||
      errorCode === 'invalid_token' ||
      errorCode === 'expired_token' ||
      errorCode === 'unauthorized')
  );
}

export class BlingApiClient {
  private accessToken: string;
  private refreshToken: string;
  private didRefresh = false;
  private tokenRefreshed = false;
  private lastRequestAt = 0;

  constructor(private readonly input: BlingApiClientInput) {
    this.accessToken = input.accessToken;
    this.refreshToken = input.refreshToken;
  }

  hasRefreshedToken() {
    return this.tokenRefreshed;
  }

  private async refreshTokenOnce() {
    if (this.didRefresh) {
      throw new BlingApiClientError('token_refresh_already_attempted');
    }

    this.didRefresh = true;

    const tokens = await refreshBlingAccessToken(
      getBlingOAuthConfig(),
      this.refreshToken
    );

    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenRefreshed = true;
    await this.input.onTokensRefreshed(tokens);
  }

  private async respectRateLimit() {
    const elapsed = Date.now() - this.lastRequestAt;

    if (elapsed < minimumRequestIntervalMs) {
      await new Promise((resolve) => {
        setTimeout(resolve, minimumRequestIntervalMs - elapsed);
      });
    }
  }

  async request<T>(
    path: string,
    init: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      query?: Record<string, string | number | Array<string | number> | undefined>;
      body?: unknown;
    } = {},
    retried = false,
    rateLimitRetries = 0
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);

    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
      'enable-jwt': '1',
    });

    if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    await this.respectRateLimit();
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    this.lastRequestAt = Date.now();
    const body = parseJson(await response.text());

    if (!response.ok && !retried && shouldAttemptRefresh(response.status, body)) {
      await this.refreshTokenOnce();
      return this.request<T>(path, init, true);
    }

    if (response.status === 429 && rateLimitRetries < maxRateLimitRetries) {
      const delay = 500 * 2 ** rateLimitRetries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(path, init, retried, rateLimitRetries + 1);
    }

    if (!response.ok) {
      throw new BlingApiClientError(
        extractErrorCode(body) ?? 'bling_request_failed',
        response.status
      );
    }

    return body as T;
  }
}

export async function createBlingApiClientForStore(storeId: string) {
  const encryptedCredentials =
    await getBlingEncryptedCredentialsFromRepository(storeId);

  if (!encryptedCredentials) {
    throw new BlingApiClientError('bling_not_connected');
  }

  const parsed = blingCredentialsSchema.safeParse(
    decryptIntegrationCredentials(encryptedCredentials.credentialsEncrypted)
  );

  if (!parsed.success) {
    throw new BlingApiClientError('invalid_bling_credentials');
  }

  return {
    client: new BlingApiClient({
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      onTokensRefreshed: (tokens) => saveBlingOAuthTokens({ storeId, tokens }),
    }),
    environment: encryptedCredentials.environment,
  };
}
