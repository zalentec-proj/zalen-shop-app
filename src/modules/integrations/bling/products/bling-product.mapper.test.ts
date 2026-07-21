import { describe, expect, it } from 'vitest';
import { mapBlingProductToCatalogInput } from './bling-product.mapper';

const baseProduct = {
  id: 123,
  nome: 'Produto de teste',
  codigo: 'PROD-123',
  preco: 10,
  situacao: 'A',
  pesoBruto: 0.1,
  dimensoes: {
    largura: 3,
    altura: 3,
    profundidade: 3,
    unidadeMedida: 1,
  },
};

describe('mapBlingProductToCatalogInput', () => {
  it('maps the official freteGratis flag to the catalog', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        freteGratis: true,
      },
    });

    expect(result).toMatchObject({
      requiresShipping: true,
      freeShipping: true,
    });
  });

  it('keeps paid shipping when Bling omits freteGratis', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: baseProduct,
    });

    expect(result.freeShipping).toBe(false);
  });
});
