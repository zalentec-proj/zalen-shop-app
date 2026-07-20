import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlingApiClient } from './bling.api-client';

describe('BlingApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia o header JWT exigido nas chamadas autenticadas', async () => {
    let requestHeaders: Headers | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      requestHeaders = new Headers(init?.headers);

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new BlingApiClient({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      onTokensRefreshed: vi.fn(),
    });

    await client.request('/produtos');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestHeaders?.get('authorization')).toBe('Bearer access-token');
    expect(requestHeaders?.get('enable-jwt')).toBe('1');
  });
});
