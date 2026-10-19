import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorefrontIdentity } from './StorefrontIdentity';
import { defaultPresentation } from './presentation';
import Logo from '@/components/ui/Logo';
import Footer from '@/components/layout/Footer';
import { ProductWhatsAppQuestionLink } from '@/components/product/ProductWhatsAppQuestionLink';
import { NeutralHeader } from '@/components/storefront/NeutralStorefront';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';

const config = { ...defaultPresentation({ id: 'pilot', name: 'Aurora', slug: 'aurora' }), primaryColor: '#b25331', footerText: 'Criação artesanal.', email: 'contato@aurora.example' };
function render(child: ReturnType<typeof createElement>, presentation = config) {
  return renderToStaticMarkup(createElement(StorefrontIdentity, { presentation, children: child }));
}
describe('shared storefront brand', () => {
  it('uses the current identity in the shared account/cart logo and footer', () => {
    for (const child of [createElement(Logo), createElement(Footer)]) {
      const html = render(child);
      expect(html).toContain('Aurora');
      expect(html).toContain('--color-blue-primary:#b25331');
      expect(html).not.toMatch(/Brasil Drones|droneseparts|5545999431780|Peças e Componentes/);
    }
    expect(render(createElement(Footer))).toContain('contato@aurora.example');
  });
  it('uses only the passed categories in the shared product/category header', () => {
    const html = render(createElement(NeutralHeader, { categories: [{ name: 'Artesanato', slug: 'artesanato' }], cartItemsCount: 0, onCartToggle: () => {}, searchQuery: '', onSearchChange: () => {} }));
    expect(html).toContain('/categoria/artesanato');
    expect(html).not.toMatch(/Brasil Drones|DJI|Baterias|Instagram/);
  });
  it('does not use the Brasil Drones logo when a product has no image', () => {
    const html = render(createElement(SafeCatalogImage, { src: '', alt: 'Produto Aurora' }));
    expect(html).toContain('Aurora');
    expect(html).not.toMatch(/Brasil|brasil/);
  });
  it('hides product contact when the new store has no WhatsApp configured', () => {
    expect(render(createElement(ProductWhatsAppQuestionLink, { productName: 'Peça Aurora' }))).not.toContain('wa.me');
  });
  it('uses the configured destination and brand on product contact', () => {
    const html = render(createElement(ProductWhatsAppQuestionLink, { productName: 'Peça Aurora' }), { ...config, whatsapp: '5511999999999' });
    expect(html).toContain('wa.me/5511999999999');
    expect(html).toContain('Aurora');
    expect(html).not.toContain('5545999431780');
  });
});
