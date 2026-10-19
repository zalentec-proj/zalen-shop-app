import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/modules/platform/store-management.service', () => ({ createManagedStore: vi.fn(), publishManagedStore: vi.fn(), saveManagedStore: mocks.save }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { saveStoreAction } from './actions';
import { defaultPresentation, presentationSchema } from '@/modules/storefront/presentation';

describe('presentation form boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ ok: true, revision: 3 }); });
  function form() {
    const data = new FormData();
    const config = defaultPresentation({ id: '', name: 'Editora Teste', slug: 'editora-teste' });
    for (const [key, value] of Object.entries(config)) data.set(key, Array.isArray(value) ? value.join('\n') : value);
    data.set('name', 'Editora Teste'); data.set('revision', '2');
    return data;
  }
  it('accepts a pre-update open form while supplying safe defaults for new optional fields', async () => {
    const data = form();
    for (const key of ['visualStyle', 'announcement', 'heroEyebrow', 'heroHighlight', 'aboutText', 'featuredTopics']) data.delete(key);
    await saveStoreAction('store', {}, data);
    const config = presentationSchema.parse(mocks.save.mock.calls[0][1].config);
    expect(config.visualStyle).toBe('essential');
    expect(config.featuredTopics).toEqual([]);
  });
  it('sends structured topic labels and the draft revision through the existing guarded service', async () => {
    const data = form(); data.set('visualStyle', 'editorial'); data.set('featuredTopics', ' Fé e espiritualidade \n\n Família \n Estudos ');
    await saveStoreAction('store', {}, data);
    const input = mocks.save.mock.calls[0][1];
    expect(input.revision).toBe('2');
    expect(presentationSchema.parse(input.config).featuredTopics).toEqual(['Fé e espiritualidade', 'Família', 'Estudos']);
  });
});
