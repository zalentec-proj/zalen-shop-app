import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ headers: vi.fn(), resolveStoreFromHost: vi.fn(), canAccessStore: vi.fn() }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/env/server', () => ({ getServerEnv: () => ({ PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br', APP_URL: 'https://app.zalenshop.com.br' }) }));
vi.mock('@/modules/stores/store-resolution', () => ({
  resolveStoreFromHost: mocks.resolveStoreFromHost,
  getOptionalStoreFromResolution: (resolution: { kind: string; store: unknown }) => resolution.kind === 'store' ? resolution.store : null,
}));
vi.mock('./auth.service', () => ({ canAccessStore: mocks.canAccessStore }));

import { resolveLoginDestination } from './login-destination.service';

describe('authorized cross-host login destination', () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'app.zalenshop.com.br', 'x-forwarded-proto': 'https' }));
    mocks.resolveStoreFromHost.mockResolvedValue({ kind: 'store', store: { id: 'store-id', slug: 'brasil-drones' } });
    mocks.canAccessStore.mockResolvedValue(true);
  });

  it('checks the authenticated identity against the resolved store before redirecting', async () => {
    await expect(resolveLoginDestination('verified-user', '/admin/pedidos?page=2')).resolves.toBe('https://brasil-drones.zalenshop.com.br/admin/pedidos?page=2');
    expect(mocks.resolveStoreFromHost).toHaveBeenCalledWith('brasil-drones.zalenshop.com.br');
    expect(mocks.canAccessStore).toHaveBeenCalledWith('verified-user', 'store-id');
  });

  it('denies a valid account without permission', async () => {
    mocks.canAccessStore.mockResolvedValue(false);
    await expect(resolveLoginDestination('other-user')).resolves.toBeNull();
  });

  it('does not fall back to Brasil Drones for an unknown store host', async () => {
    mocks.resolveStoreFromHost.mockResolvedValue({ kind: 'not_found' });
    await expect(resolveLoginDestination('verified-user', 'https://unknown.zalenshop.com.br/admin')).resolves.toBeNull();
    expect(mocks.canAccessStore).not.toHaveBeenCalled();
  });

  it('authorizes the requested other store, not the default store', async () => {
    mocks.resolveStoreFromHost.mockResolvedValue({ kind: 'store', store: { id: 'london-id' } });
    await expect(resolveLoginDestination('london-user', 'https://lb-london.zalenshop.com.br/admin')).resolves.toBe('https://lb-london.zalenshop.com.br/admin');
    expect(mocks.canAccessStore).toHaveBeenCalledWith('london-user', 'london-id');
  });

  it.each(['localhost:3000', 'branch-preview.vercel.app', 'brasil-drones.zalenshop.com.br'])('keeps same-host navigation and existing admin guards on %s', async (host) => {
    mocks.headers.mockResolvedValue(new Headers({ host, 'x-forwarded-proto': host.startsWith('localhost') ? 'http' : 'https' }));
    await expect(resolveLoginDestination('verified-user', '/admin/produtos')).resolves.toBe('/admin/produtos');
    expect(mocks.resolveStoreFromHost).not.toHaveBeenCalled();
    expect(mocks.canAccessStore).not.toHaveBeenCalled();
  });
});
