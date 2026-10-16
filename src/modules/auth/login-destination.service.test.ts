import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ headers: vi.fn(), resolveStoreFromHost: vi.fn(), canAccessStore: vi.fn(), getPlatformRole: vi.fn(), listUserStores: vi.fn() }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/env/server', () => ({ getServerEnv: () => ({ PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br', APP_URL: 'https://app.zalenshop.com.br' }) }));
vi.mock('@/modules/stores/store-resolution', () => ({
  resolveStoreFromHost: mocks.resolveStoreFromHost,
  getOptionalStoreFromResolution: (resolution: { kind: string; store: unknown }) => ['store', 'fallback'].includes(resolution.kind) ? resolution.store : null,
}));
vi.mock('./auth.service', () => ({ canAccessStore: mocks.canAccessStore, getPlatformRole: mocks.getPlatformRole }));
vi.mock('./store-access.repository', () => ({ listUserStores: mocks.listUserStores }));

import { resolveLoginDestination } from './login-destination.service';

const london = { id: 'london-id', slug: 'lb-london', name: 'LB London', status: 'active' };
const brazil = { id: 'brazil-id', slug: 'brasil-drones', name: 'Brasil Drones', status: 'active' };

describe('authorized login destination', () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'app.zalenshop.com.br', 'x-forwarded-proto': 'https' }));
    mocks.resolveStoreFromHost.mockResolvedValue({ kind: 'store', store: london });
    mocks.canAccessStore.mockResolvedValue(true);
    mocks.getPlatformRole.mockResolvedValue(null);
    mocks.listUserStores.mockResolvedValue([london]);
  });

  it.each(['platform_owner', 'platform_admin'])('routes %s to the platform without resolving a store', async (role) => {
    mocks.getPlatformRole.mockResolvedValue(role);
    await expect(resolveLoginDestination('verified-user')).resolves.toBe('https://app.zalenshop.com.br/platform');
    expect(mocks.resolveStoreFromHost).not.toHaveBeenCalled();
    expect(mocks.listUserStores).not.toHaveBeenCalled();
  });

  it('sends a single-store user to their own store', async () => {
    await expect(resolveLoginDestination('london-user')).resolves.toBe('https://lb-london.zalenshop.com.br/admin');
    expect(mocks.listUserStores).toHaveBeenCalledWith('london-user');
  });

  it('preserves an admin route on the authorized single store', async () => {
    await expect(resolveLoginDestination('london-user', '/admin/pedidos?page=2#detalhes')).resolves.toBe('https://lb-london.zalenshop.com.br/admin/pedidos?page=2#detalhes');
  });

  it('offers a selector instead of choosing an arbitrary store', async () => {
    mocks.listUserStores.mockResolvedValue([london, brazil]);
    const destination = new URL((await resolveLoginDestination('multi-user', '/admin/produtos?page=2'))!);
    expect(destination.pathname).toBe('/lojas');
    expect(destination.searchParams.get('next')).toBe('/admin/produtos?page=2');
  });

  it.each([{ stores: [] }, { stores: [{ ...london, status: 'inactive' }] }])('handles no active membership without a fallback store', async ({ stores }) => {
    mocks.listUserStores.mockResolvedValue(stores);
    await expect(resolveLoginDestination('unlinked-user')).resolves.toBe('https://app.zalenshop.com.br/lojas');
  });

  it('does not interpret a failed membership query as an empty account', async () => {
    mocks.listUserStores.mockRejectedValue(new Error('unavailable'));
    await expect(resolveLoginDestination('user')).rejects.toThrow('unavailable');
  });

  it('honors a specific authorized store for a global user', async () => {
    mocks.getPlatformRole.mockResolvedValue('platform_owner');
    await expect(resolveLoginDestination('owner', 'https://lb-london.zalenshop.com.br/admin')).resolves.toBe('https://lb-london.zalenshop.com.br/admin');
    expect(mocks.canAccessStore).toHaveBeenCalledWith('owner', 'london-id');
  });

  it('rejects a store-specific next without permission', async () => {
    mocks.canAccessStore.mockResolvedValue(false);
    await expect(resolveLoginDestination('user', 'https://lb-london.zalenshop.com.br/admin')).resolves.toBeNull();
  });

  it('does not fall back when the requested store does not exist', async () => {
    mocks.resolveStoreFromHost.mockResolvedValue({ kind: 'not_found' });
    await expect(resolveLoginDestination('user', 'https://unknown.zalenshop.com.br/admin')).resolves.toBeNull();
    expect(mocks.canAccessStore).not.toHaveBeenCalled();
  });

  it('checks permission for a relative next on the same store host', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'lb-london.zalenshop.com.br', 'x-forwarded-proto': 'https' }));
    mocks.canAccessStore.mockResolvedValue(false);
    await expect(resolveLoginDestination('other-user', '/admin')).resolves.toBeNull();
  });

  it.each(['/platform/lojas', 'https://app.zalenshop.com.br/platform/lojas'])('denies store-only accounts a platform next: %s', async (next) => {
    await expect(resolveLoginDestination('store-owner', next)).resolves.toBeNull();
    expect(mocks.listUserStores).not.toHaveBeenCalled();
  });

  it('preserves authorized platform filters', async () => {
    mocks.getPlatformRole.mockResolvedValue('platform_owner');
    await expect(resolveLoginDestination('owner', '/platform/lojas?q=London&page=2')).resolves.toBe('https://app.zalenshop.com.br/platform/lojas?q=London&page=2');
  });

  it('uses the local application for global access', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'localhost:3000' }));
    mocks.getPlatformRole.mockResolvedValue('platform_owner');
    await expect(resolveLoginDestination('owner')).resolves.toBe('http://localhost:3000/platform');
  });

  it('builds a local store subdomain for a single membership', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'localhost:3000' }));
    await expect(resolveLoginDestination('user')).resolves.toBe('http://lb-london.lvh.me:3000/admin');
  });

  it('does not follow a next back to login or an external host', async () => {
    await expect(resolveLoginDestination('user', '/login')).resolves.toBe('https://lb-london.zalenshop.com.br/admin');
    await expect(resolveLoginDestination('user', 'https://evil.example/admin')).resolves.toBe('https://lb-london.zalenshop.com.br/admin');
  });
});
