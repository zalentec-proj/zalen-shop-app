import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/modules/auth/auth.service', () => ({ checkStoreRole: mocks.role }));
vi.mock('@/modules/stores/store-resolution', () => ({ resolveCurrentStoreFromHeaders: async () => ({ id: 'store-a' }) }));
vi.mock('@/modules/catalog/drone-model.service', () => ({ replaceProductDroneModels: mocks.save }));
import { saveProductDroneModelsAction } from './actions';

const form = (count: number) => {
  const data = new FormData();
  data.set('productId', '11111111-1111-4111-8111-111111111111');
  for (let i = 0; i < count; i++) data.append('modelIds', `22222222-2222-4222-8222-${i.toString(16).padStart(12, '0')}`);
  return data;
};
describe('compatibility mutation feedback and catalog size', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.role.mockResolvedValue({ allowed: true }); mocks.save.mockResolvedValue({ ok: true }); });
  it('saves 34 models without the old 31-model validation cap', async () => {
    const result = await saveProductDroneModelsAction(form(34));
    expect(result).toEqual({ ok: true, message: 'Compatibilidade salva: 34 modelos vinculados.' });
    expect(mocks.save.mock.calls[0][0].modelIds).toHaveLength(34);
    expect(mocks.save.mock.calls[0][0].storeId).toBe('store-a');
  });
  it('never mutates for an unauthorized role', async () => {
    mocks.role.mockResolvedValue({ allowed: false });
    expect((await saveProductDroneModelsAction(form(1))).ok).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('reports persistence/scope failure as an error, not success', async () => {
    mocks.save.mockResolvedValue({ ok: false, error: 'invalid-product-or-model-scope' });
    expect((await saveProductDroneModelsAction(form(1))).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('rejects invalid identifiers before persistence', async () => {
    const data = form(0); data.append('modelIds', 'invalid');
    expect((await saveProductDroneModelsAction(data)).ok).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
