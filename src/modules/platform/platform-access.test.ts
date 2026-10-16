import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getPlatformRole: vi.fn(), redirect: vi.fn() }));
vi.mock('@/modules/auth/auth.service', () => mocks);
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
import { requirePlatformAccess } from './platform-access';

describe('platform authorization', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'verified-user', email: 'owner@example.test' });
    mocks.getPlatformRole.mockResolvedValue(null);
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  });

  it('returns unauthenticated requests to login before querying roles', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(requirePlatformAccess()).rejects.toThrow('redirect:/login?next=/platform/lojas');
    expect(mocks.getPlatformRole).not.toHaveBeenCalled();
  });

  it('denies store-only users, regardless of account metadata', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'store-owner', user_metadata: { role: 'platform_owner' } });
    await expect(requirePlatformAccess()).rejects.toThrow('redirect:/lojas?acesso=restrito');
  });

  it.each(['platform_owner', 'platform_admin'])('accepts the verified global role %s', async (role) => {
    mocks.getPlatformRole.mockResolvedValue(role);
    await expect(requirePlatformAccess()).resolves.toMatchObject({ user: { id: 'verified-user' }, role });
    expect(mocks.getPlatformRole).toHaveBeenCalledWith('verified-user');
  });
});
