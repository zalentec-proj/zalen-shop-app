import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/cart/StorefrontCartProvider', () => ({ useStorefrontCart: () => ({ cart: { items: [] }, toggleCart: () => {} }) }));
import { EditorialStorefront } from '@/components/storefront/EditorialStorefront';
import { StorefrontIdentity } from './StorefrontIdentity';
import { defaultPresentation, presentationSchema } from './presentation';
import type { Product, StorefrontCategory } from '@/types';

const config = presentationSchema.parse({
  ...defaultPresentation({ id: 'publisher', name: 'Editora Teste', slug: 'editora-teste' }),
  visualStyle: 'editorial', primaryColor: '#335C43', accentColor: '#2F543E',
  heroTitle: 'Sua próxima leitura começa aqui.', heroHighlight: 'leitura',
  announcement: 'Um novo capítulo começa aqui.', featuredTopics: ['Família', 'Estudos'],
  bannerUrl: '/brand/editora-rochedo/hero-editorial-v1.webp',
});
function render(products: Product[] = [], categories: StorefrontCategory[] = []) {
  return renderToStaticMarkup(createElement(StorefrontIdentity, { presentation: config, children: createElement(EditorialStorefront, { presentation: config, products, categories, preview: true }) }));
}
describe('editorial publishing template', () => {
  it('shows a branded empty catalog without inventing products, contacts or newsletter collection', () => {
    const html = render();
    expect(html).toContain('storefront-editorial');
    expect(html).toContain('--color-brand-bg:#ffffff');
    expect(html).toContain('Editora Teste');
    expect(html).toContain('O próximo capítulo está sendo preparado.');
    expect(html).toContain('capas ilustrativas');
    expect(html).not.toMatch(/<article|type="email"|mailto:|wa.me|Brasil Drones|Metanoia|Casamento Sem Filtro/);
  });
  it('links a topic only when the current store supplies a matching real category', () => {
    const html = render([], [{ id: 'own-category', name: 'Família', slug: 'familia', productCount: 0 }]);
    expect(html).toContain('href="/categoria/familia"');
    expect(html).not.toContain('href="/categoria/estudos"');
  });
  it('renders actual catalog items rather than the covers from the visual reference', () => {
    const product: Product = { id: 'own-product', name: 'Publicação cadastrada', price: 49.9, stock: 1, isAvailable: true, image: '', category: 'Estudos', description: '', specs: [], rating: 0, reviewsCount: 0 };
    const html = render([product]);
    expect(html).toContain('Publicação cadastrada');
    expect(html).toContain('49,90');
    expect(html).not.toContain('O próximo capítulo está sendo preparado.');
    expect(html).not.toMatch(/Metanoia|Espiritualidade por trás das finanças/);
  });
  it('escapes editorial text instead of rendering supplied markup', () => {
    const untrusted = { ...config, announcement: '<script>alert(1)</script>' };
    const html = renderToStaticMarkup(createElement(StorefrontIdentity, { presentation: untrusted, children: createElement(EditorialStorefront, { presentation: untrusted, products: [], categories: [] }) }));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('never applies the light scope to the Brasil Drones custom renderer', () => {
    const presentation = { ...config, renderer: 'brasil-drones' as const };
    const html = renderToStaticMarkup(createElement(StorefrontIdentity, { presentation, children: createElement('p', null, 'Brasil Drones') }));
    expect(html).not.toContain('storefront-editorial');
    expect(html).not.toContain('--color-brand-bg:#ffffff');
  });
});
