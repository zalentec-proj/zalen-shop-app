import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.admin, createOptionalClient: mocks.client }));
import { listUserStores } from './store-access.repository';

function database(rows: Record<string, { data: unknown; error: unknown; count?: number }>) {
  const queries: Record<string, { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> }> = {};
  const from = vi.fn((table: string) => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue(rows[table]) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.order.mockReturnValue(query);
    queries[table] = query;
    return query;
  });
  return { from, queries };
}

describe('user store scope', () => {
  beforeEach(() => { mocks.admin.mockReturnValue(null); });

  it('queries only the verified user and only the stores from valid membership roles', async () => {
    const db = database({
      store_memberships: { data: [{ store_id: 'mine', role: 'store_owner' }, { store_id: 'other', role: 'platform_owner' }], error: null },
      stores: { data: [{ id: 'mine', name: 'My shop' }], error: null },
    });
    mocks.client.mockResolvedValue(db);
    await expect(listUserStores('verified-user')).resolves.toEqual([{ id: 'mine', name: 'My shop' }]);
    expect(db.queries.store_memberships.eq).toHaveBeenCalledWith('user_id', 'verified-user');
    expect(db.queries.stores.in).toHaveBeenCalledWith('id', ['mine']);
    expect(db.from).not.toHaveBeenCalledWith('memberships');
  });

  it('preserves legacy access without granting it to unrecognized roles', async () => {
    const db = database({
      store_memberships: { data: [{ store_id: 'mine', role: 'store_viewer' }], error: null },
      memberships: { data: [{ store_id: 'mine', role: 'admin' }, { store_id: 'legacy', role: 'owner' }, { store_id: 'unknown', role: 'member' }], error: null },
      stores: { data: [{ id: 'mine' }, { id: 'legacy' }], error: null },
    });
    mocks.admin.mockReturnValue(db);
    await listUserStores('user');
    expect(db.queries.memberships.eq).toHaveBeenCalledWith('user_id', 'user');
    expect(db.queries.stores.in).toHaveBeenCalledWith('id', ['mine', 'legacy']);
  });

  it('does not query the store registry for an unlinked account', async () => {
    const db = database({ store_memberships: { data: [], error: null } });
    mocks.client.mockResolvedValue(db);
    await expect(listUserStores('user')).resolves.toEqual([]);
    expect(db.from).not.toHaveBeenCalledWith('stores');
  });

  it('fails closed on missing configuration or membership query failure', async () => {
    mocks.client.mockResolvedValue(null);
    await expect(listUserStores('user')).rejects.toThrow('Store access unavailable.');
    mocks.client.mockResolvedValue(database({ store_memberships: { data: null, error: { message: 'private' } } }));
    await expect(listUserStores('user')).rejects.toThrow('Store access unavailable.');
  });
});
