import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOrderFixture as order } from '../../../tests/fixtures/admin-order';
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createOptionalAdminClient: mocks.client, createOptionalClient: vi.fn(), isSupabaseAdminConfigured: vi.fn() }));
import { claimOrderBlingSendInRepository } from './order.repository';

describe('atomic order send claim', () => {
  beforeEach(() => vi.resetAllMocks());
  function setup(result: { data: unknown; error: unknown }) {
    const query = { update: vi.fn(), eq: vi.fn(), neq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
    for (const key of ['update', 'eq', 'neq', 'is', 'select'] as const) query[key].mockReturnValue(query);
    mocks.client.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    return query;
  }
  it('claims only an unpaid-link-free paid order in the resolved store', async () => {
    const query = setup({ data: { id: order.id }, error: null });
    expect(await claimOrderBlingSendInRepository(order)).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('store_id', order.storeId);
    expect(query.eq).toHaveBeenCalledWith('id', order.id);
    expect(query.eq).toHaveBeenCalledWith('payment_status', 'paid');
    expect(query.neq).toHaveBeenCalledWith('status', 'cancelled');
    expect(query.is).toHaveBeenCalledWith('external_erp_id', null);
    expect(query.is).toHaveBeenCalledWith('external_erp_last_error', null);
  });
  it('uses compare-and-swap for a failed previous send', async () => {
    const query = setup({ data: null, error: null });
    expect(await claimOrderBlingSendInRepository({ ...order, externalErpLastError: 'old_failure' })).toBe(false);
    expect(query.eq).toHaveBeenCalledWith('external_erp_last_error', 'old_failure');
  });
  it('fails closed if the database is unavailable', async () => {
    mocks.client.mockReturnValue(null);
    await expect(claimOrderBlingSendInRepository(order)).rejects.toThrow('order_send_storage_unavailable');
  });
});
