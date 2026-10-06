import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/modules/catalog/product.types';
const mocks = vi.hoisted(() => ({ product: vi.fn(), priceList: vi.fn(), variantPrice: vi.fn() }));
vi.mock('@/modules/catalog/product.service', () => ({ getProductById: mocks.product }));
vi.mock('./pricing.repository', () => ({ getDefaultPriceListFromRepository: mocks.priceList, getVariantPriceFromRepository: mocks.variantPrice }));
import { CheckoutStockError, resolveCheckoutPricing } from './pricing.service';

const storeId = 'store-a';
const product: Product = {
  id: 'product-a', storeId, name: 'Produto', slug: 'produto', status: 'active',
  requiresShipping: true, freeShipping: false, createdAt: '', updatedAt: '', images: [], categories: [],
  variants: [{ id: 'variant-a', productId: 'product-a', storeId, price: 100, promotionalPrice: 90, stock: 3, attributes: {}, createdAt: '' }],
};
const price = (quantities: number[]) => resolveCheckoutPricing({ storeId, customerType: 'pf', items: quantities.map(quantity => ({ productId: product.id, variantId: product.variants[0].id, quantity })) });

describe('server checkout stock validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.product.mockResolvedValue(product);
    mocks.priceList.mockResolvedValue(null);
  });
  it('accepts the available quantity and retains the catalog promotion', async () => {
    const result = await price([3]);
    expect(result.total).toBe(270);
    expect(result.items[0].unitPrice).toBe(90);
    expect(mocks.product).toHaveBeenCalledWith(storeId, product.id);
  });
  it('rejects quantities above stock before resolving prices', async () => {
    await expect(price([4])).rejects.toBeInstanceOf(CheckoutStockError);
    expect(mocks.priceList).not.toHaveBeenCalled();
  });
  it('aggregates repeated variant lines instead of validating them independently', async () => {
    await expect(price([2, 2])).rejects.toBeInstanceOf(CheckoutStockError);
    expect((await price([1, 2])).total).toBe(270);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 100])('rejects invalid quantity %s before reading the catalog', async quantity => {
    await expect(price([quantity])).rejects.toBeInstanceOf(CheckoutStockError);
    expect(mocks.product).not.toHaveBeenCalled();
  });
  it('rejects an empty cart', async () => {
    await expect(price([])).rejects.toBeInstanceOf(CheckoutStockError);
  });
  it.each([0, NaN, Infinity])('rejects unavailable or invalid stock %s', async stock => {
    mocks.product.mockResolvedValue({ ...product, variants: [{ ...product.variants[0], stock }] });
    await expect(price([1])).rejects.toBeInstanceOf(CheckoutStockError);
  });
  it.each([null, { ...product, status: 'inactive' }, { ...product, storeId: 'other-store' }, { ...product, variants: [] }, { ...product, variants: [{ ...product.variants[0], storeId: 'other-store' }] }, { ...product, variants: [{ ...product.variants[0], productId: 'other-product' }] }])('rejects unavailable or cross-store product/variant', async record => {
    mocks.product.mockResolvedValue(record);
    await expect(price([1])).rejects.toBeInstanceOf(CheckoutStockError);
    expect(mocks.priceList).not.toHaveBeenCalled();
  });
});
