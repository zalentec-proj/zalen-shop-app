import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/modules/catalog/product.types';
vi.mock('@/modules/cart/StorefrontCartProvider', () => ({ useStorefrontCart: () => ({ addCartItem: vi.fn(), goToCheckout: vi.fn() }) }));
vi.mock('@/components/layout/Footer', () => ({ default: () => null }));
vi.mock('@/components/product/ProductWhatsAppQuestionLink', () => ({ ProductWhatsAppQuestionLink: () => null }));
import ProductDetailClient from './ProductDetailClient';
const product: Product = {
  id: 'product-a', storeId: 'store-a', name: 'Produto de teste', slug: 'produto-teste', status: 'active', requiresShipping: true, freeShipping: false,
  createdAt: '', updatedAt: '', images: [], categories: [],
  variants: [{ id: 'variant-a', productId: 'product-a', storeId: 'store-a', price: 100, promotionalPrice: 90, stock: 2, attributes: {}, createdAt: '' }],
};
describe('product route commercial promises', () => {
  it('displays the catalog promotion, never the unimplemented Pix discount', () => {
    const html = renderToStaticMarkup(createElement(ProductDetailClient, { product, relatedProducts: [], businessDiscountPercentage: 10, productUrl: 'https://example.com/produto/produto-teste' }));
    expect(html).toContain('90,00');
    expect(html).toContain('7,50');
    expect(html).not.toContain('5% off');
    expect(html).not.toContain('85,50');
    expect(html).toContain('Desconto para empresas com CNPJ');
    expect(html).toContain('10');
  });
});
