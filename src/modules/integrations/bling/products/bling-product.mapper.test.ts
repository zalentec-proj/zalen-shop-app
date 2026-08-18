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

  it('rejects temporary signed Bling image URLs', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        imagemURL:
          'https://orgbling.s3.amazonaws.com/catalog/image?AWSAccessKeyId=temporary&Expires=1786989721&Signature=value',
      },
    });

    expect(result.imageUrl).toBeUndefined();
  });

  it('keeps permanent public catalog image URLs', () => {
    const imageUrl =
      'https://project.supabase.co/storage/v1/object/public/product-images/catalog/image.webp';
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        imagemURL: imageUrl,
      },
    });

    expect(result.imageUrl).toBe(imageUrl);
  });
});
