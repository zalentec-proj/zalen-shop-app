import { describe, expect, it } from 'vitest';
import { catalogSlug, emptyManualProduct, manualProductSchema } from './manual-product';

const valid = { ...emptyManualProduct('10000000-0000-4000-8000-000000000001'), name: 'Livro real', price: '39,90', stock: '7' };
describe('manual catalog input', () => {
  it('starts private and parses Brazilian amounts without silently coercing empty input to zero', () => {
    expect(manualProductSchema.parse(valid)).toMatchObject({ status: 'draft', price: 39.9, stock: 7, weight: null });
    for (const price of ['', '-1', '1.000,00', '0.001', 'Infinity']) expect(manualProductSchema.safeParse({ ...valid, price }).success).toBe(false);
    for (const stock of ['', '1.5', '-2', '1000000']) expect(manualProductSchema.safeParse({ ...valid, stock }).success).toBe(false);
    expect(manualProductSchema.parse({ ...valid, price: '0' }).price).toBe(0);
  });
  it('rejects arbitrary fields and unsafe cover addresses', () => {
    expect(manualProductSchema.safeParse({ ...valid, storeId: 'other' }).success).toBe(false);
    for (const imageUrl of ['javascript:alert(1)', 'http://example.com/a.png', 'https://example.com/a.svg', 'https://user:pass@example.com/a.jpg']) expect(manualProductSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
    expect(manualProductSchema.safeParse({ ...valid, imageUrl: 'https://example.com/cover.webp' }).success).toBe(true);
  });
  it('supports optional publishing metadata and measured packages', () => {
    expect(manualProductSchema.parse({ ...valid, author: 'Autora', isbn: '978-85-00000-00-0', weight: '0,350' })).toMatchObject({ author: 'Autora', weight: 0.35 });
    expect(catalogSlug('Fé e espiritualidade')).toBe('fe-e-espiritualidade');
  });
});
