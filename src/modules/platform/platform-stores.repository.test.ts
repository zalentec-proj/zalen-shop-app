import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requirePlatformAccess: vi.fn(), createOptionalAdminClient: vi.fn() }));
vi.mock('./platform-access', () => ({ requirePlatformAccess: mocks.requirePlatformAccess }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.createOptionalAdminClient }));
import { listPlatformStores, parseStoreListQuery } from './platform-stores.repository';

function client(result: unknown) {
  const request = { select: vi.fn(), ilike: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue(result) };
  request.select.mockReturnValue(request);
  request.ilike.mockReturnValue(request);
  request.order.mockReturnValue(request);
  return { from: vi.fn().mockReturnValue(request), request };
}

describe('protected global store listing', () => {
  beforeEach(() => { mocks.requirePlatformAccess.mockResolvedValue({ role: 'platform_owner' }); });

  it('denies access before obtaining any privileged client', async () => {
    mocks.requirePlatformAccess.mockRejectedValue(new Error('denied'));
    await expect(listPlatformStores()).rejects.toThrow('denied');
    expect(mocks.createOptionalAdminClient).not.toHaveBeenCalled();
  });

  it('reads stores across statuses with a bounded stable page', async () => {
    const db = client({ data: [{ id: 'a', status: 'active' }, { id: 'b', status: 'planned' }], count: 40, error: null });
    mocks.createOptionalAdminClient.mockReturnValue(db);
    await expect(listPlatformStores('London', '2')).resolves.toMatchObject({ available: true, total: 40, page: 2, stores: [{ id: 'a' }, { id: 'b' }] });
    expect(db.from).toHaveBeenCalledWith('stores');
    expect(db.request.range).toHaveBeenCalledWith(25, 49);
    expect(db.request.order).toHaveBeenCalledWith('id');
    expect(db.request.ilike).toHaveBeenCalledWith('name', '%London%');
  });

  it('treats search wildcard characters as literal text', async () => {
    const db = client({ data: [], count: 0, error: null });
    mocks.createOptionalAdminClient.mockReturnValue(db);
    await listPlatformStores('100%_shop');
    expect(db.request.ilike).toHaveBeenCalledWith('name', '%100\\%\\_shop%');
  });

  it.each([null, client({ data: null, count: null, error: { message: 'secret details' } })])('shows unavailability instead of a fake empty list', async (db) => {
    mocks.createOptionalAdminClient.mockReturnValue(db);
    await expect(listPlatformStores()).resolves.toMatchObject({ available: false, stores: [], total: 0 });
  });

  it('distinguishes an actual empty list', async () => {
    mocks.createOptionalAdminClient.mockReturnValue(client({ data: [], count: 0, error: null }));
    await expect(listPlatformStores()).resolves.toMatchObject({ available: true, total: 0 });
  });

  it.each(['-1', '0', '2.5', 'Infinity', '200000', 'oops'])('bounds invalid pagination %s', (page) => {
    expect(parseStoreListQuery(' q ', page)).toEqual({ query: 'q', page: 1 });
  });

  it('handles duplicate query parameters and bounds search length', () => {
    expect(parseStoreListQuery(['a', 'b'], ['2', '3'])).toEqual({ query: '', page: 1 });
    expect(parseStoreListQuery('a'.repeat(100)).query).toHaveLength(80);
  });
});
