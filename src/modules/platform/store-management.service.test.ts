import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), admin: vi.fn(), rpc: vi.fn() }));
vi.mock('./platform-access', () => ({ requirePlatformAccess: mocks.guard }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.admin }));
import { createManagedStore, getManagedStore, publishManagedStore } from './store-management.service';

const input = { requestId: '30000000-0000-4000-8000-000000000001', name: 'Loja independente', slug: 'loja-independente', ownerEmail: 'loja@example.test' };
describe('platform store mutations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ user: { id: 'actor-from-session' }, role: 'platform_owner' });
    mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  });
  it('checks the global guard before reading any privileged data', async () => {
    mocks.guard.mockRejectedValue(new Error('redirect: denied'));
    await expect(getManagedStore(input.requestId)).rejects.toThrow('denied');
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('denies support creation and publication even with valid client input', async () => {
    mocks.guard.mockResolvedValue({ user: { id: 'support' }, role: 'platform_admin' });
    expect((await createManagedStore(input)).ok).toBe(false);
    expect((await publishManagedStore(input.requestId, 1)).ok).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('derives the actor from the session and provisions only neutral isolated config', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, storeId: input.requestId, revision: 1 }, error: null });
    expect((await createManagedStore({ ...input, actorId: 'forged' })).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('platform_store_command', expect.objectContaining({ p_actor_id: 'actor-from-session', p_action: 'create', p_request_id: input.requestId, p_payload: expect.objectContaining({ config: expect.objectContaining({ renderer: 'neutral', whatsapp: '', instagramUrl: '' }) }) }));
  });
  it('does not create partial writes after validation failure', async () => {
    expect((await createManagedStore({ ...input, slug: 'app' })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('preserves safe expected database errors and suppresses internal details', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ok: false, code: 'slug_taken' }, error: null });
    expect((await createManagedStore(input)).message).toContain('outra loja');
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'private SQL diagnostic' } });
    expect(JSON.stringify(await createManagedStore(input))).not.toContain('private SQL');
  });
  it('passes the draft revision to the atomic publication command', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, revision: 7 }, error: null });
    await publishManagedStore(input.requestId, 7);
    expect(mocks.rpc).toHaveBeenCalledWith('platform_store_command', expect.objectContaining({ p_action: 'publish', p_store_id: input.requestId, p_payload: { revision: 7 } }));
  });
});
