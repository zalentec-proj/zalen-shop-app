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

  it('uses all permanent URLs resolved by the media service', () => {
    const imageUrls = [
      'https://project.supabase.co/storage/v1/object/public/product-images/one.webp',
      'https://project.supabase.co/storage/v1/object/public/product-images/two.webp',
    ];
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: baseProduct,
      resolvedImageUrls: imageUrls,
    });

    expect(result.imageUrl).toBe(imageUrls[0]);
    expect(result.imageUrls).toEqual(imageUrls);
  });

  it('converts Bling HTML descriptions to readable plain text', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        descricaoCurta:
          '<p>Peça DJI &amp; original<br>Pronta para uso.</p>\r\n<ul><li>Item A</li><li>Item B</li></ul><script>alert(1)</script>',
      },
    });

    expect(result.description).toBe(
      'Peça DJI & original\nPronta para uso.\n• Item A\n• Item B'
    );
  });

  it('adds new batteries to the commercial battery taxonomy', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        nome: 'Bateria Nova Original Mini 3',
      },
    });

    expect(result.additionalCategorySlugs).toEqual([
      'baterias-e-tampas',
      'novo',
    ]);
    expect(result.managedAdditionalCategorySlugs).toEqual([
      'baterias-e-tampas',
      'novo',
      'semi-novo',
    ]);
  });

  it('adds semi-new batteries to the semi-new taxonomy', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        nome: 'Bateria de voo inteligente SEMI NOVA',
      },
    });

    expect(result.additionalCategorySlugs).toEqual([
      'baterias-e-tampas',
      'semi-novo',
    ]);
  });

  it('does not classify drones sold without a battery as batteries', () => {
    const result = mapBlingProductToCatalogInput({
      storeId: 'store-1',
      product: {
        ...baseProduct,
        nome: 'Drone DJI Avata 2 sem controle e bateria SEMI NOVO',
      },
    });

    expect(result.additionalCategorySlugs).toBeUndefined();
    expect(result.managedAdditionalCategorySlugs).toBeUndefined();
  });
});
