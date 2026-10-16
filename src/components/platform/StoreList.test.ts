import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoreList } from './StoreList';

describe('store list presentation', () => {
  it('links only active stores to their own administrative subdomain', () => {
    const html = renderToStaticMarkup(createElement(StoreList, {
      requestOrigin: 'https://app.zalenshop.com.br', rootDomain: 'zalenshop.com.br',
      stores: [
        { id: '1', name: 'London', slug: 'lb-london', status: 'active' },
        { id: '2', name: 'Pilot', slug: 'pilot', status: 'planned' },
        { id: '3', name: 'Paused', slug: 'paused', status: 'inactive' },
      ],
    }));
    expect(html).toContain('https://lb-london.zalenshop.com.br/admin');
    expect(html).toContain('Em preparação');
    expect(html).toContain('Inativa');
    expect(html).not.toContain('https://pilot.');
    expect(html).not.toContain('https://paused.');
  });

  it('escapes stored names and rejects an invalid administrative hostname', () => {
    const html = renderToStaticMarkup(createElement(StoreList, {
      requestOrigin: 'https://app.zalenshop.com.br', rootDomain: 'zalenshop.com.br',
      stores: [{ id: '1', name: '<script>bad</script>', slug: 'evil.example', status: 'active' }],
    }));
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).not.toContain('<script>bad');
    expect(html).not.toContain('href=');
  });
});
