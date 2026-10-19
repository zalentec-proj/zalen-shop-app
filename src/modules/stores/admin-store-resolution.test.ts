import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), role: vi.fn(), stores: vi.fn(), admin: vi.fn(), publicStore: vi.fn(), headers: vi.fn() }));
const fallback = { id: 'brasil', name: 'Brasil', shortName: 'Brasil', slug: 'brasil-drones', status: 'active', source: 'static', storefrontPath: '/' };
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/env/server', () => ({ getServerEnv: () => ({ PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br' }) }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.admin }));
vi.mock('@/modules/auth/auth.service', () => ({ getCurrentUser: mocks.user, getPlatformRole: mocks.role }));
vi.mock('@/modules/auth/store-access.repository', () => ({ listUserStores: mocks.stores }));
vi.mock('@/modules/domains/domain.repository', () => ({ getActivePrimaryStoreDomain: vi.fn() }));
vi.mock('./store.repository', () => ({ getStaticActiveStoreContext: () => fallback, getStoreBySlugFromRepository: mocks.publicStore, getStoreByCustomHostnameFromRepository: vi.fn(), toStoreContext: (row: object) => ({ ...row, source: 'supabase' }) }));
import { resolveAdminStoreFromHost, resolveStoreFromHeaders, resolveStoreFromHost } from './store-resolution';
const planned = { id: 'publisher-id', name: 'Publisher', slug: 'publisher', status: 'planned' };
describe('private operation of stores in preparation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: 'verified-user' }); mocks.role.mockResolvedValue(null);
    mocks.stores.mockResolvedValue([planned]); mocks.publicStore.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(new Headers({ host: 'publisher.zalenshop.com.br', 'x-zalen-request-path': '/admin/produtos' }));
  });
  it('allows only an authorized store membership and never obtains the global privileged client', async () => {
    await expect(resolveStoreFromHeaders()).resolves.toMatchObject({ kind: 'store', store: { id: planned.id } });
    expect(mocks.stores).toHaveBeenCalledWith('verified-user'); expect(mocks.admin).not.toHaveBeenCalled();
    mocks.stores.mockResolvedValue([]);
    await expect(resolveAdminStoreFromHost('publisher.zalenshop.com.br', 'unlinked')).resolves.toMatchObject({ kind: 'not_found' });
  });
  it('keeps public pages unavailable even to an authenticated store owner', async () => {
    mocks.publicStore.mockResolvedValue(planned);
    await expect(resolveStoreFromHost('publisher.zalenshop.com.br')).resolves.toMatchObject({ kind: 'not_found' });
    mocks.headers.mockResolvedValue(new Headers({ host: 'publisher.zalenshop.com.br', 'x-zalen-request-path': '/' }));
    await expect(resolveStoreFromHeaders()).resolves.toMatchObject({ kind: 'not_found' });
    expect(mocks.stores).not.toHaveBeenCalled();
  });
  it('does not resolve planned admin data for a guest or an inactive membership', async () => {
    mocks.user.mockResolvedValue(null);
    await expect(resolveStoreFromHeaders()).resolves.toMatchObject({ kind: 'not_found' });
    expect(mocks.stores).not.toHaveBeenCalled();
    mocks.stores.mockResolvedValue([{ ...planned, status: 'inactive' }]);
    await expect(resolveAdminStoreFromHost('publisher.zalenshop.com.br', 'user')).resolves.toMatchObject({ kind: 'not_found' });
  });
  it('requires a global role before reading the global store registry', async () => {
    mocks.role.mockResolvedValue('platform_owner');
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: planned, error: null }) };
    mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
    await expect(resolveAdminStoreFromHost('publisher.zalenshop.com.br', 'owner')).resolves.toMatchObject({ kind: 'store' });
    expect(query.eq).toHaveBeenCalledWith('slug', 'publisher'); expect(mocks.stores).not.toHaveBeenCalled();
  });
});
