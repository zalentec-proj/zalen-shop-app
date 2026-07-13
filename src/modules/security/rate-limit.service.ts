import 'server-only';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { createOptionalAdminClient } from '@/lib/supabase/server';

export type RateLimitScope =
  | 'customer_otp_send'
  | 'customer_otp_verify'
  | 'checkout_account_lookup'
  | 'postal_code_lookup'
  | 'shipping_quote'
  | 'checkout_create'
  | 'payment_submit'
  | 'payment_status_poll';

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

export const rateLimitPolicies: Record<RateLimitScope, RateLimitPolicy> = {
  customer_otp_send: { limit: 3, windowSeconds: 15 * 60 },
  customer_otp_verify: { limit: 5, windowSeconds: 15 * 60 },
  checkout_account_lookup: { limit: 10, windowSeconds: 15 * 60 },
  postal_code_lookup: { limit: 30, windowSeconds: 60 },
  shipping_quote: { limit: 20, windowSeconds: 5 * 60 },
  checkout_create: { limit: 10, windowSeconds: 10 * 60 },
  payment_submit: { limit: 5, windowSeconds: 10 * 60 },
  payment_status_poll: { limit: 45, windowSeconds: 2 * 60 },
};

export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('rate_limit_exceeded');
    this.name = 'RateLimitExceededError';
  }
}

function getClientIp(requestHeaders: Headers) {
  const forwarded =
    requestHeaders.get('x-vercel-forwarded-for') ??
    requestHeaders.get('x-forwarded-for') ??
    requestHeaders.get('x-real-ip');

  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function getHashSecret() {
  const env = getServerEnv();
  const secret = env.RATE_LIMIT_HASH_SECRET ?? env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('rate_limit_hash_secret_missing');
  }

  return secret;
}

function hashKey(value: string) {
  return createHmac('sha256', getHashSecret()).update(value).digest('hex');
}

async function consume(input: {
  scope: RateLimitScope;
  key: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('rate_limit_storage_unavailable');
  }

  const policy = rateLimitPolicies[input.scope];
  const { data, error } = await supabase.rpc('consume_security_rate_limit', {
    p_scope: input.scope,
    p_key_hash: hashKey(input.key),
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error('rate_limit_storage_unavailable');
  }

  const result = data[0] as {
    allowed?: boolean;
    retry_after_seconds?: number;
  };

  if (!result.allowed) {
    throw new RateLimitExceededError(
      Math.max(Number(result.retry_after_seconds ?? 0), 1)
    );
  }
}

export async function enforceRateLimit(input: {
  scope: RateLimitScope;
  storeId?: string;
  subject?: string;
}) {
  const requestHeaders = await headers();
  const prefix = `${input.scope}:${input.storeId ?? 'global'}`;
  const keys = [`${prefix}:ip:${getClientIp(requestHeaders)}`];

  if (input.subject?.trim()) {
    keys.push(`${prefix}:subject:${input.subject.trim().toLowerCase()}`);
  }

  for (const key of keys) {
    await consume({ scope: input.scope, key });
  }
}

export function getRateLimitErrorMessage(error: unknown) {
  if (error instanceof RateLimitExceededError) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  return 'Não foi possível concluir esta solicitação agora. Tente novamente em instantes.';
}

export function getRateLimitFailureCode(error: unknown) {
  if (error instanceof RateLimitExceededError) {
    return 'rate_limit_exceeded';
  }

  if (
    error instanceof Error &&
    (error.message === 'rate_limit_hash_secret_missing' ||
      error.message === 'rate_limit_storage_unavailable')
  ) {
    return error.message;
  }

  return 'rate_limit_unavailable';
}
