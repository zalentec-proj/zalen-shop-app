import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOptionalPublicServerClient: vi.fn(),
  getStoreDomainByHostname: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createOptionalPublicServerClient: mocks.createOptionalPublicServerClient,
}));

vi.mock('@/lib/logging/dev', () => ({
  logDevOnce: vi.fn(),
}));

vi.mock('@/modules/domains/domain.repository', () => ({
  getStoreDomainByHostname: mocks.getStoreDomainByHostname,
}));

import { getStoreByCustomHostnameFromRepository, getStoreBySlugFromRepository } from './store.repository';

function createStoreLookupClient(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => result),
        })),
      })),
    })),
  };
}

describe('store repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não reativa a Brasil Drones por fallback quando o banco não publica a loja', async () => {
    mocks.createOptionalPublicServerClient.mockReturnValue(
      createStoreLookupClient({ data: null, error: null })
    );

    await expect(
      getStoreBySlugFromRepository('brasil-drones')
    ).resolves.toBeNull();
  });

  it('não aplica fallback a uma loja desconhecida', async () => {
    mocks.createOptionalPublicServerClient.mockReturnValue(
      createStoreLookupClient({ data: null, error: null })
    );

    await expect(
      getStoreBySlugFromRepository('loja-desconhecida')
    ).resolves.toBeNull();
  });

  it('não reativa uma loja por domínio próprio ainda ativo quando a loja saiu da leitura pública', async () => {
    mocks.getStoreDomainByHostname.mockResolvedValue({ storeId: '00000000-0000-0000-0000-000000000001', status: 'active' });
    mocks.createOptionalPublicServerClient.mockReturnValue(createStoreLookupClient({ data: null, error: null }));
    await expect(getStoreByCustomHostnameFromRepository('www.brasildroneseparts.com.br')).resolves.toBeNull();
  });

  it('falha fechado quando a consulta da Brasil Drones encontra erro', async () => {
    mocks.createOptionalPublicServerClient.mockReturnValue(createStoreLookupClient({ data: null, error: { code: 'unavailable' } }));
    await expect(getStoreBySlugFromRepository('brasil-drones')).resolves.toBeNull();
  });
});
