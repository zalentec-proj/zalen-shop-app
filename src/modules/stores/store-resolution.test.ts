import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fallbackStore,
  getStoreBySlugFromRepository,
  getStoreByCustomHostnameFromRepository,
} = vi.hoisted(() => ({
  fallbackStore: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Brasil Drones & Parts',
    shortName: 'Brasil Drones',
    slug: 'brasil-drones',
    status: 'active',
    storefrontPath: '/',
    source: 'static' as const,
  },
  getStoreBySlugFromRepository: vi.fn(),
  getStoreByCustomHostnameFromRepository: vi.fn(),
}));

vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => ({ PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br' }),
}));

vi.mock('@/modules/domains/domain.repository', () => ({
  getActivePrimaryStoreDomain: vi.fn(async () => null),
}));

vi.mock('./store.repository', () => ({
  getStaticActiveStoreContext: () => fallbackStore,
  getStoreBySlugFromRepository,
  getStoreByCustomHostnameFromRepository,
}));

import { resolveStoreFromHost } from './store-resolution';

describe('resolveStoreFromHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantém fallback somente para localhost', async () => {
    await expect(resolveStoreFromHost('localhost:3000')).resolves.toMatchObject({
      kind: 'fallback',
      store: fallbackStore,
    });
  });

  it('nunca abre Brasil Drones para host externo desconhecido', async () => {
    getStoreByCustomHostnameFromRepository.mockResolvedValue(null);

    await expect(resolveStoreFromHost('desconhecido.com.br')).resolves.toMatchObject({
      kind: 'not_found',
      host: 'desconhecido.com.br',
    });
  });

  it('resolve domínio externo somente quando está ativo no banco', async () => {
    getStoreByCustomHostnameFromRepository.mockResolvedValue({
      store: { ...fallbackStore, source: 'supabase' },
      domain: {
        id: 'domain-id',
        status: 'active',
        hostname: 'www.brasildrones.com.br',
      },
    });

    await expect(
      resolveStoreFromHost('www.brasildrones.com.br')
    ).resolves.toMatchObject({
      kind: 'store',
      slug: 'brasil-drones',
      domain: { id: 'domain-id', status: 'active' },
    });
  });
});
