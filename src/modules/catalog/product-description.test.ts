import { describe, expect, it } from 'vitest';
import {
  normalizeProductDescription,
  parseProductDescription,
} from './product-description';

describe('product description formatting', () => {
  it('turns Bling HTML into safe, readable structured content', () => {
    const blocks = parseProductDescription(
      '<h2>Hub de Carregamento Original</h2><p class="isSelectedEnd"><strong>Produto DJI</strong>, ideal para a linha Mini.</p><h3>Compatibilidade</h3><ul><li>DJI Mini 3</li><li>DJI Mini 4 Pro</li></ul><script>alert(1)</script>'
    );

    expect(blocks).toEqual([
      { type: 'heading', content: 'Hub de Carregamento Original' },
      { type: 'paragraph', content: 'Produto DJI, ideal para a linha Mini.' },
      { type: 'heading', content: 'Compatibilidade' },
      { type: 'list', items: ['DJI Mini 3', 'DJI Mini 4 Pro'] },
    ]);
  });

  it('keeps Markdown readable without exposing its formatting markers', () => {
    expect(
      parseProductDescription('## Destaques\n\n- **Original DJI**\n- [Ver manual](https://example.com)')
    ).toEqual([
      { type: 'heading', content: 'Destaques' },
      { type: 'list', items: ['Original DJI', 'Ver manual'] },
    ]);
  });

  it('normalizes entities and does not keep executable provider markup', () => {
    expect(normalizeProductDescription('<p>Peça &amp; original</p><style>body{display:none}</style>')).toBe(
      'Peça & original'
    );
  });
});
