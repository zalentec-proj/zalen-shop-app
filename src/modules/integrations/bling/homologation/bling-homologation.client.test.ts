import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlingHomologationClient } from './bling-homologation.client';

describe('BlingHomologationClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia o header JWT exigido na sequência oficial de homologação', async () => {
    let requestHeaders: Headers | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      requestHeaders = new Headers(init?.headers);

      return new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-bling-homologacao': 'next-step',
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new BlingHomologationClient({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      onTokensRefreshed: vi.fn(),
    });

    await expect(client.run(Date.now() + 10_000)).rejects.toMatchObject({
      code: 'invalid_get_payload',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestHeaders?.get('authorization')).toBe('Bearer access-token');
    expect(requestHeaders?.get('enable-jwt')).toBe('1');
  });
});
