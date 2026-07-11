import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupBrazilianPostalCode } from './postal-code.service';

describe('ViaCEP lookup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects CEPs that do not have eight digits without calling ViaCEP', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupBrazilianPostalCode('123')).resolves.toEqual({
      ok: false,
      errorCode: 'invalid_postal_code',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes a successful provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            cep: '85801-210',
            logradouro: 'Rua Pio XII',
            bairro: 'Centro',
            localidade: 'Cascavel',
            uf: 'pr',
          }),
          { status: 200 }
        )
      )
    );

    await expect(lookupBrazilianPostalCode('85801210')).resolves.toEqual({
      ok: true,
      postalCode: '85801210',
      street: 'Rua Pio XII',
      district: 'Centro',
      city: 'Cascavel',
      state: 'PR',
    });
  });

  it('maps provider and address failures without exposing provider details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
    );
    await expect(lookupBrazilianPostalCode('85801210')).resolves.toEqual({
      ok: false,
      errorCode: 'postal_code_lookup_failed',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ erro: true }), { status: 200 })
      )
    );
    await expect(lookupBrazilianPostalCode('85801210')).resolves.toEqual({
      ok: false,
      errorCode: 'postal_code_not_found',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable'))
    );
    await expect(lookupBrazilianPostalCode('85801210')).resolves.toEqual({
      ok: false,
      errorCode: 'postal_code_lookup_failed',
    });
  });

  it('requires complete city and state details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ localidade: 'Cascavel' }), { status: 200 })
      )
    );

    await expect(lookupBrazilianPostalCode('85801210')).resolves.toEqual({
      ok: false,
      errorCode: 'postal_code_incomplete',
    });
  });
});
