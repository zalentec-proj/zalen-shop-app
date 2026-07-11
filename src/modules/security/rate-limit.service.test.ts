import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getHeaders: vi.fn(),
  env: {
    RATE_LIMIT_HASH_SECRET: 'rate-limit-test-secret' as string | undefined,
    INTEGRATION_TOKEN_ENCRYPTION_KEY: undefined as string | undefined,
  },
}));

vi.mock('next/headers', () => ({
  headers: mocks.getHeaders,
}));

vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => mocks.env,
}));

vi.mock('@/lib/supabase/server', () => ({
  createOptionalAdminClient: () => ({ rpc: mocks.rpc }),
}));

import {
  enforceRateLimit,
  getRateLimitErrorMessage,
  rateLimitPolicies,
  RateLimitExceededError,
} from './rate-limit.service';

describe('rate limit', () => {
  beforeEach(() => {
    mocks.env.RATE_LIMIT_HASH_SECRET = 'rate-limit-test-secret';
    mocks.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = undefined;
    mocks.getHeaders.mockResolvedValue(
      new Headers({ 'x-vercel-forwarded-for': '198.51.100.8, 10.0.0.1' })
    );
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: true, retry_after_seconds: 0 }],
      error: null,
    });
  });

  it('defines the release limits expected for sensitive scopes', () => {
    expect(rateLimitPolicies.customer_otp_send).toEqual({
      limit: 3,
      windowSeconds: 15 * 60,
    });
    expect(rateLimitPolicies.payment_submit).toEqual({
      limit: 5,
      windowSeconds: 10 * 60,
    });
    expect(rateLimitPolicies.shipping_quote).toEqual({
      limit: 20,
      windowSeconds: 5 * 60,
    });
  });

  it('consumes separate hashed buckets for IP and account subject', async () => {
    await enforceRateLimit({
      scope: 'customer_otp_send',
      storeId: 'store-a',
      subject: 'Buyer@Example.com',
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    const first = mocks.rpc.mock.calls[0]?.[1];
    const second = mocks.rpc.mock.calls[1]?.[1];
    expect(first.p_scope).toBe('customer_otp_send');
    expect(first.p_limit).toBe(3);
    expect(first.p_window_seconds).toBe(900);
    expect(first.p_key_hash).not.toContain('198.51.100.8');
    expect(second.p_key_hash).not.toContain('buyer@example.com');
    expect(first.p_key_hash).not.toBe(second.p_key_hash);
  });

  it('stops requests when the durable bucket is exhausted', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: false, retry_after_seconds: 43 }],
      error: null,
    });

    await expect(
      enforceRateLimit({ scope: 'payment_submit', subject: 'customer-order' })
    ).rejects.toMatchObject({
      name: 'RateLimitExceededError',
      retryAfterSeconds: 43,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the rate-limit storage is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });

    await expect(
      enforceRateLimit({ scope: 'postal_code_lookup' })
    ).rejects.toThrow('rate_limit_storage_unavailable');
  });

  it('requires a server-side hashing secret', async () => {
    mocks.env.RATE_LIMIT_HASH_SECRET = undefined;

    await expect(
      enforceRateLimit({ scope: 'postal_code_lookup' })
    ).rejects.toThrow('rate_limit_hash_secret_missing');
  });

  it('uses a safe generic response when a bucket is exhausted', () => {
    expect(getRateLimitErrorMessage(new RateLimitExceededError(30))).toContain(
      'Muitas tentativas'
    );
  });

  it('does not expose storage details for other failures', () => {
    expect(getRateLimitErrorMessage(new Error('database unavailable'))).toBe(
      'Não foi possível concluir esta solicitação agora. Tente novamente em instantes.'
    );
  });
});
