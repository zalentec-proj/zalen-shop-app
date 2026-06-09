/**
 * Dados mockados do catálogo.
 * Substitui a fonte de dados real (Bling/Supabase) enquanto a integração não está pronta.
 * NÃO usar em produção com dados reais.
 */

import {
  droneAccessoriesImage,
  mavic3ProImage,
  mini4ProImage,
} from '../../assets/images';
import { ACTIVE_MOCK_STORE_ID } from '../stores/current-store';
import { Category, Product, ProductSummary } from './product.types';

const STORE_ID = ACTIVE_MOCK_STORE_ID;

export const mockProducts: Product[] = [
  {
    id: 'dji-mavic-3-pro',
    storeId: STORE_ID,
    name: 'DJI Mavic 3 Pro',
    slug: 'dji-mavic-3-pro',
    description:
      'Drone profissional com câmera Hasselblad, autonomia avançada e sistema inteligente de detecção para voos mais seguros e precisos. Câmera tripla Hasselblad. Performance incomparável. Criado para capturar imagens profissionais com estabilidade, alcance e precisão.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    seoTitle: 'DJI Mavic 3 Pro — Drone Profissional com Câmera Hasselblad',
    seoDescription:
      'Compre o DJI Mavic 3 Pro com câmera Hasselblad 4/3 CMOS, autonomia de 46 min e transmissão de 15km.',
    variants: [
      {
        id: 'dji-mavic-3-pro-v1',
        storeId: STORE_ID,
        productId: 'dji-mavic-3-pro',
        sku: 'DJI-M3P-001',
        price: 12999.0,
        stock: 5,
        weight: 895,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-mavic-3-pro-1',
        storeId: STORE_ID,
        productId: 'dji-mavic-3-pro',
        url: mavic3ProImage,
        position: 0,
        alt: 'DJI Mavic 3 Pro',
      },
      {
        id: 'img-mavic-3-pro-2',
        storeId: STORE_ID,
        productId: 'dji-mavic-3-pro',
        url: mini4ProImage,
        position: 1,
        alt: 'DJI Mavic 3 Pro — vista lateral',
      },
    ],
    categories: [
      { id: 'cat-drones', storeId: STORE_ID, name: 'Drones', slug: 'drones', position: 0 },
    ],
    specs: [
      { label: 'Câmera Hasselblad', value: '4/3 CMOS' },
      { label: 'Autonomia', value: 'Até 46 min' },
      { label: 'Transmissão', value: '15km (O3+)' },
      { label: 'Detecção', value: '360°' },
    ],
    rating: 4.9,
    reviewsCount: 128,
    isBestSeller: true,
    isNew: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'dji-mini-4-pro',
    storeId: STORE_ID,
    name: 'DJI Mini 4 Pro',
    slug: 'dji-mini-4-pro',
    description:
      'Nosso mini drone mais avançado até hoje. Integra poderosos recursos de imagem, detecção de obstáculos omnidirecional, ActiveTrack 360° e transmissão de vídeo FHD a 20 km.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    seoTitle: 'DJI Mini 4 Pro — Mini Drone com Máxima Performance',
    seoDescription:
      'DJI Mini 4 Pro: câmera 1/1.3" CMOS, peso abaixo de 249g, autonomia de 34 min e detecção omnidirecional.',
    variants: [
      {
        id: 'dji-mini-4-pro-v1',
        storeId: STORE_ID,
        productId: 'dji-mini-4-pro',
        sku: 'DJI-M4P-001',
        price: 6999.0,
        stock: 8,
        weight: 249,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-mini-4-pro-1',
        storeId: STORE_ID,
        productId: 'dji-mini-4-pro',
        url: mini4ProImage,
        position: 0,
        alt: 'DJI Mini 4 Pro',
      },
    ],
    categories: [
      { id: 'cat-drones', storeId: STORE_ID, name: 'Drones', slug: 'drones', position: 0 },
    ],
    specs: [
      { label: 'Câmera principal', value: '1/1.3" CMOS' },
      { label: 'Peso', value: 'Abaixo de 249g' },
      { label: 'Autonomia', value: 'Até 34 min' },
      { label: 'Detecção', value: 'Omnidirecional' },
    ],
    rating: 4.8,
    reviewsCount: 94,
    isBestSeller: true,
    isNew: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'dji-air-3-fly-more',
    storeId: STORE_ID,
    name: 'DJI Air 3 Fly More Combo',
    slug: 'dji-air-3-fly-more',
    description:
      'Com um sistema de câmeras duplas primárias, o DJI Air 3 traz detalhes incríveis de longo alcance e perspectivas amplas. Inclui 3 baterias adicionais, hélices extras, hub de carregamento e bolsa de transporte.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'dji-air-3-v1',
        storeId: STORE_ID,
        productId: 'dji-air-3-fly-more',
        sku: 'DJI-AIR3-FM',
        price: 10999.0,
        stock: 3,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-air-3-1',
        storeId: STORE_ID,
        productId: 'dji-air-3-fly-more',
        url: mavic3ProImage,
        position: 0,
        alt: 'DJI Air 3 Fly More Combo',
      },
    ],
    categories: [
      { id: 'cat-kits', storeId: STORE_ID, name: 'Kits e Combos', slug: 'kits-e-combos', position: 0 },
    ],
    specs: [
      { label: 'Câmera dupla', value: 'Duplo 1/1.3" CMOS' },
      { label: 'Autonomia', value: 'Até 46 min' },
      { label: 'Transmissão', value: '20km (O4)' },
      { label: 'Baterias', value: '3 Inclusas' },
    ],
    rating: 4.9,
    reviewsCount: 42,
    isBestSeller: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'bateria-dji-mini-3-pro',
    storeId: STORE_ID,
    name: 'Bateria DJI Mini 3 Pro',
    slug: 'bateria-dji-mini-3-pro',
    description:
      'Bateria de Voo Inteligente DJI original para Mini 3 Pro e Mini 4 Pro. Fornece energia estável, monitoramento de status em tempo real e tempo de voo estendido.',
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
        weight: 80.5,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-bateria-1',
        storeId: STORE_ID,
        productId: 'bateria-dji-mini-3-pro',
        url: droneAccessoriesImage,
        position: 0,
        alt: 'Bateria DJI Mini 3 Pro',
      },
    ],
    categories: [
      { id: 'cat-baterias', storeId: STORE_ID, name: 'Baterias', slug: 'baterias', position: 0 },
    ],
    specs: [
      { label: 'Capacidade', value: '2453 mAh' },
      { label: 'Tipo', value: 'LiPo 2S' },
      { label: 'Peso', value: '80.5g' },
      { label: 'Garantia', value: 'Oficial DJI' },
    ],
    rating: 4.7,
    reviewsCount: 165,
    isBestSeller: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'helices-dji-air-3',
    storeId: STORE_ID,
    name: 'Hélices DJI Air 3 (Par)',
    slug: 'helices-dji-air-3',
    description:
      'Hélices de reposição originais para DJI Air 3. Projetadas para produzir menos ruído, maior eficiência aerodinâmica e excelente força de tração rotacional.',
    brand: 'DJI',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'helices-dji-air-3-v1',
        storeId: STORE_ID,
        productId: 'helices-dji-air-3',
        sku: 'DJI-HEL-AIR3',
        price: 199.0,
        stock: 50,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-helices-1',
        storeId: STORE_ID,
        productId: 'helices-dji-air-3',
        url: droneAccessoriesImage,
        position: 0,
        alt: 'Hélices DJI Air 3',
      },
    ],
    categories: [
      { id: 'cat-pecas', storeId: STORE_ID, name: 'Peças', slug: 'pecas', position: 0 },
    ],
    specs: [
      { label: 'Compatibilidade', value: 'DJI Air 3' },
      { label: 'Construção', value: 'Fibra de Carbono' },
      { label: 'Tipo', value: 'Baixo Ruído' },
      { label: 'Conteúdo', value: '1 Par' },
    ],
    rating: 4.6,
    reviewsCount: 88,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'case-impermeavel',
    storeId: STORE_ID,
    name: 'Case Impermeável Pro',
    slug: 'case-impermeavel',
    description:
      "Maleta rígida hermética à prova d'água, poeira e impactos externos. Espuma interna recortada a laser de alta densidade, compatível com múltiplos modelos de drones compactos.",
    brand: 'Brasil Drones',
    status: 'active',
    requiresShipping: true,
    variants: [
      {
        id: 'case-impermeavel-v1',
        storeId: STORE_ID,
        productId: 'case-impermeavel',
        sku: 'BD-CASE-PRO',
        price: 349.0,
        stock: 15,
        weight: 1200,
        attributes: {},
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    images: [
      {
        id: 'img-case-1',
        storeId: STORE_ID,
        productId: 'case-impermeavel',
        url: droneAccessoriesImage,
        position: 0,
        alt: 'Case Impermeável Pro',
      },
    ],
    categories: [
      { id: 'cat-acessorios', storeId: STORE_ID, name: 'Acessórios', slug: 'acessorios', position: 0 },
    ],
    specs: [
      { label: 'Proteção', value: 'IP67 Impermeável' },
      { label: 'Espuma', value: 'Recortada a laser' },
      { label: 'Válvula', value: 'Pressão automática' },
      { label: 'Peso', value: '1.2 kg' },
    ],
    rating: 4.8,
    reviewsCount: 31,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

export const mockCategories: Category[] = [
  { id: 'cat-drones', storeId: STORE_ID, name: 'Drones', slug: 'drones', position: 0 },
  { id: 'cat-pecas', storeId: STORE_ID, name: 'Peças', slug: 'pecas', position: 1 },
  { id: 'cat-acessorios', storeId: STORE_ID, name: 'Acessórios', slug: 'acessorios', position: 2 },
  { id: 'cat-baterias', storeId: STORE_ID, name: 'Baterias', slug: 'baterias', position: 3 },
  { id: 'cat-kits', storeId: STORE_ID, name: 'Kits e Combos', slug: 'kits-e-combos', position: 4 },
];

export function toProductSummary(product: Product): ProductSummary {
  const primaryVariant = product.variants[0];

  return {
    id: product.id,
    variantId: primaryVariant?.id,
    externalProvider: product.externalProvider,
    externalId: product.externalId,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    status: product.status,
    price: primaryVariant?.price ?? 0,
    promotionalPrice: primaryVariant?.promotionalPrice,
    stock: primaryVariant?.stock ?? 0,
    imageUrl: product.images[0]?.url,
    categories: product.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    isBestSeller: product.isBestSeller,
    isNew: product.isNew,
  };
}

export function getMockProductSummaries(): ProductSummary[] {
  return mockProducts.map(toProductSummary);
}

export function getMockCategoryBySlug(slug: string): Category | undefined {
  return mockCategories.find((category) => category.slug === slug);
}

export function getMockProductBySlug(slug: string): Product | undefined {
  return mockProducts.find((p) => p.slug === slug);
}

export function getMockProductsByCategory(categorySlug: string): Product[] {
  return mockProducts.filter((p) =>
    p.categories.some((c) => c.slug === categorySlug)
  );
}

export function getMockRelatedProducts(
  productSlug: string,
  limit = 3
): Product[] {
  const product = getMockProductBySlug(productSlug);

  if (!product) {
    return [];
  }

  const categorySlugs = new Set(product.categories.map((category) => category.slug));

  return mockProducts
    .filter(
      (candidate) =>
        candidate.slug !== product.slug &&
        candidate.categories.some((category) => categorySlugs.has(category.slug))
    )
    .slice(0, limit);
}
