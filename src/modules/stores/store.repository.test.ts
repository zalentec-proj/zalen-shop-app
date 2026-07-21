import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOptionalPublicServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createOptionalPublicServerClient: mocks.createOptionalPublicServerClient,
}));

vi.mock('@/lib/logging/dev', () => ({
  logDevOnce: vi.fn(),
}));

vi.mock('@/modules/domains/domain.repository', () => ({
  getStoreDomainByHostname: vi.fn(),
}));

import { getStoreBySlugFromRepository } from './store.repository';

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

  it('mantém a loja estática conhecida quando a consulta pública retorna vazia', async () => {
    mocks.createOptionalPublicServerClient.mockReturnValue(
      createStoreLookupClient({ data: null, error: null })
    );

    await expect(
      getStoreBySlugFromRepository('brasil-drones')
    ).resolves.toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'brasil-drones',
      status: 'active',
      source: 'static',
    });
  });

  it('não aplica fallback a uma loja desconhecida', async () => {
    mocks.createOptionalPublicServerClient.mockReturnValue(
      createStoreLookupClient({ data: null, error: null })
    );

    await expect(
      getStoreBySlugFromRepository('loja-desconhecida')
    ).resolves.toBeNull();
  });
});
