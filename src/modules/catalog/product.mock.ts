/**
 * Dados mockados do catálogo.
 * Substitui a fonte de dados real (Bling/Supabase) enquanto a integração não está pronta.
 * NÃO usar em produção com dados reais.
 */

import { Product, ProductSummary } from './product.types';

const STORE_ID = 'brasil-drones-store-001';

export const mockProducts: Product[] = [
  {
    id: 'dji-mavic-3-pro',
    storeId: STORE_ID,
    name: 'DJI Mavic 3 Pro',
    slug: 'dji-mavic-3-pro',
    description:
      'Drone profissional com câmera Hasselblad, autonomia avançada e sistema inteligente de detecção para voos mais seguros e precisos.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'dji-mavic-3-pro-v1',
        storeId: STORE_ID,
        productId: 'dji-mavic-3-pro',
        sku: 'DJI-M3P-001',
        price: 12999.0,
        stock: 5,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-mavic-3-pro-1',
        storeId: STORE_ID,
        productId: 'dji-mavic-3-pro',
        url: '/images/mavic_3_pro.png',
        position: 0,
        alt: 'DJI Mavic 3 Pro',
      },
    ],
    categories: [
      {
        id: 'cat-drones',
        storeId: STORE_ID,
        name: 'Drones',
        slug: 'drones',
        position: 0,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'dji-mini-4-pro',
    storeId: STORE_ID,
    name: 'DJI Mini 4 Pro',
    slug: 'dji-mini-4-pro',
    description:
      'Nosso mini drone mais avançado até hoje. Integra poderosos recursos de imagem e detecção de obstáculos omnidirecional.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'dji-mini-4-pro-v1',
        storeId: STORE_ID,
        productId: 'dji-mini-4-pro',
        sku: 'DJI-M4P-001',
        price: 6999.0,
        stock: 8,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-mini-4-pro-1',
        storeId: STORE_ID,
        productId: 'dji-mini-4-pro',
        url: '/images/mini_4_pro.png',
        position: 0,
        alt: 'DJI Mini 4 Pro',
      },
    ],
    categories: [
      {
        id: 'cat-drones',
        storeId: STORE_ID,
        name: 'Drones',
        slug: 'drones',
        position: 0,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'bateria-dji-mini-3-pro',
    storeId: STORE_ID,
    name: 'Bateria DJI Mini 3 Pro',
    slug: 'bateria-dji-mini-3-pro',
    description:
      'Bateria de Voo Inteligente DJI original para Mini 3 Pro e Mini 4 Pro.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'bateria-dji-mini-3-pro-v1',
        storeId: STORE_ID,
        productId: 'bateria-dji-mini-3-pro',
        sku: 'DJI-BAT-M3P',
        price: 899.0,
        stock: 20,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-bateria-1',
        storeId: STORE_ID,
        productId: 'bateria-dji-mini-3-pro',
        url: '/images/drone_accessories.png',
        position: 0,
        alt: 'Bateria DJI Mini 3 Pro',
      },
    ],
    categories: [
      {
        id: 'cat-baterias',
        storeId: STORE_ID,
        name: 'Baterias',
        slug: 'baterias',
        position: 0,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

export function getMockProductSummaries(): ProductSummary[] {
  return mockProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    status: p.status,
    price: p.variants[0]?.price ?? 0,
    promotionalPrice: p.variants[0]?.promotionalPrice,
    stock: p.variants[0]?.stock ?? 0,
    imageUrl: p.images[0]?.url,
    categories: p.categories.map((c) => c.name),
  }));
}

export function getMockProductBySlug(slug: string): Product | undefined {
  return mockProducts.find((p) => p.slug === slug);
}
