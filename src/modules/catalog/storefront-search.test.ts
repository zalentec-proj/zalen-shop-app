import { describe, expect, it } from 'vitest';
import { getStorefrontSearchResults } from './storefront-search';

const products = [
  {
    id: 'mini-4-arm',
    name: 'Braço Dianteiro Mini 4 Pro',
    href: '/produto/braco-mini-4',
    searchText: 'BDP-401 DJI Peças Originais',
  },
  {
    id: 'camera-avata',
    name: 'Módulo da Câmera Avata 2',
    href: '/produto/camera-avata-2',
    searchText: 'CAM-202 DJI Câmeras',
  },
];

describe('storefront search', () => {
  it('matches product names without depending on accents or word order', () => {
    expect(getStorefrontSearchResults(products, 'mini braço')).toEqual([
      products[0],
    ]);
  });

  it('matches SKU and category metadata', () => {
    expect(getStorefrontSearchResults(products, 'bdp 401')).toEqual([
      products[0],
    ]);
    expect(getStorefrontSearchResults(products, 'cameras')).toEqual([
      products[1],
    ]);
  });

  it('returns an empty list for an empty query', () => {
    expect(getStorefrontSearchResults(products, '   ')).toEqual([]);
  });
});
