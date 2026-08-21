import { describe, expect, it } from 'vitest';
import {
  buildDescriptionPatch,
  containsMundroneReference,
  countMundroneReferences,
  sanitizeBrasilDronesDescription,
} from '../../../../scripts/bling/brasil-drones-description-sanitizer.mjs';

describe('Brasil Drones description sanitizer', () => {
  it('replaces the competitor name without changing surrounding content', () => {
    expect(
      sanitizeBrasilDronesDescription(
        'Garantia Mundrone. Aqui na MUNDRONE você encontra peças.'
      )
    ).toBe(
      'Garantia Brasil Drones & Parts. Aqui na Brasil Drones & Parts você encontra peças.'
    );
  });

  it('replaces competitor URLs before replacing the standalone name', () => {
    expect(
      sanitizeBrasilDronesDescription(
        '<a href="https://www.mundrone.com.br/produto">www.mundrone.com.br</a>'
      )
    ).toBe(
      '<a href="https://www.brasildroneseparts.com.br/produto">www.brasildroneseparts.com.br</a>'
    );
  });

  it('builds a patch containing description fields only', () => {
    const product = {
      id: 123,
      nome: 'Nome original',
      preco: 99,
      descricaoCurta: 'Produto vendido pela Mundrone.',
      descricaoComplementar: 'Sem referência concorrente.',
    };

    expect(buildDescriptionPatch(product)).toEqual({
      descricaoCurta: 'Produto vendido pela Brasil Drones & Parts.',
    });
    expect(product.nome).toBe('Nome original');
    expect(product.preco).toBe(99);
  });

  it('detects and counts references case-insensitively', () => {
    expect(containsMundroneReference('MUNDRONE e mundrone')).toBe(true);
    expect(countMundroneReferences('MUNDRONE e mundrone')).toBe(2);
    expect(buildDescriptionPatch({ descricaoCurta: 'Brasil Drones & Parts' })).toEqual({});
  });
});
