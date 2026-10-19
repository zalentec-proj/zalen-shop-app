import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ check: vi.fn(), admin: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.admin }));
vi.mock('@/modules/auth/auth.service', () => ({ checkStoreRole: mocks.check, storeOperationalRoles: ['store_owner', 'store_admin', 'store_operator'] }));
import { saveManualProduct } from './manual-product.service';
import { emptyManualProduct } from './manual-product';
const input = { ...emptyManualProduct('10000000-0000-4000-8000-000000000001'), name: 'Fé e vida', price: '39,90', stock: '5' };
describe('manual product authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.check.mockResolvedValue({ allowed: true, user: { id: 'verified-user' } });
    mocks.admin.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  });
  it('does not obtain a privileged client for viewers or unauthenticated users', async () => {
    mocks.check.mockResolvedValue({ allowed: false, user: null });
    expect((await saveManualProduct('store-a', input)).ok).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('derives actor and store outside untrusted fields and validates before writing', async () => {
    await saveManualProduct('store-a', input);
    expect(mocks.rpc).toHaveBeenCalledWith('save_manual_product', expect.objectContaining({ p_actor_id: 'verified-user', p_store_id: 'store-a', p_payload: expect.objectContaining({ price: 39.9, slug: 'fe-e-vida' }) }));
    mocks.rpc.mockClear();
    expect((await saveManualProduct('store-a', { ...input, storeId: 'store-b' })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('surfaces a duplicate SKU without leaking database errors', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: 'sku_taken' }, error: null });
    expect(await saveManualProduct('store-a', input)).toMatchObject({ ok: false, message: expect.stringContaining('SKU já existe') });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private payload' } });
    expect(JSON.stringify(await saveManualProduct('store-a', input))).not.toContain('private payload');
  });
});
