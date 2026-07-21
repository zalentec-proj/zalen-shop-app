import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlingHomologationClient } from './bling-homologation.client';

describe('BlingHomologationClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia o header JWT exigido na sequência oficial de homologação', async () => {
    let requestUrl: string | URL | Request | undefined;
    let requestHeaders: Headers | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      requestUrl = input;
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
    expect(String(requestUrl)).toBe(
      'https://api.bling.com.br/Api/v3/homologacao/produtos'
    );
    expect(requestHeaders?.get('authorization')).toBe('Bearer access-token');
    expect(requestHeaders?.get('enable-jwt')).toBe('1');
  });

  it('explica quando a conta conectada não é a criadora do aplicativo', async () => {
    const onTokensRefreshed = vi.fn();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            fields: [
              {
                code: 6,
                namespace: 'HOMOLOGACAO',
              },
            ],
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new BlingHomologationClient({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      onTokensRefreshed,
    });

    await expect(client.run(Date.now() + 10_000)).rejects.toMatchObject({
      code: 'homologation_app_company_mismatch',
      statusCode: 400,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(onTokensRefreshed).not.toHaveBeenCalled();
  });
});
