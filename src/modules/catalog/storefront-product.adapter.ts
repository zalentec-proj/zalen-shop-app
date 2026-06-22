import { droneAccessoriesImage } from '@/assets/images';
import type { Product as StorefrontProduct } from '@/types';
import type { Product as CatalogProduct } from './product.types';

const fallbackImageUrl = droneAccessoriesImage;

function buildFallbackSpecs(product: CatalogProduct): StorefrontProduct['specs'] {
  const variant = product.variants[0];
  const specs = [
    product.brand ? { label: 'Marca', value: product.brand } : null,
    variant?.sku ? { label: 'SKU', value: variant.sku } : null,
    variant ? { label: 'Estoque', value: `${variant.stock} un.` } : null,
    product.requiresShipping
      ? { label: 'Entrega', value: 'Produto físico' }
      : { label: 'Entrega', value: 'Digital' },
  ];

  return specs.filter((spec): spec is StorefrontProduct['specs'][number] =>
    Boolean(spec)
  );
}

export function toStorefrontProduct(product: CatalogProduct): StorefrontProduct {
  const variant = product.variants[0];
  const images = product.images.map((image) => image.url);
  const category = product.categories[0]?.name ?? 'Catálogo';

  return {
    id: product.slug,
    catalogProductId: product.id,
    variantId: variant?.id,
    sku: variant?.sku,
    name: product.name,
    subtitle: product.seoDescription ?? product.brand,
    price: variant?.promotionalPrice ?? variant?.price ?? 0,
    originalPrice: variant?.promotionalPrice ? variant.price : undefined,
    rating: product.rating ?? 4.8,
    reviewsCount: product.reviewsCount ?? 0,
    image: images[0] ?? fallbackImageUrl,
    images: images.length > 0 ? images : [fallbackImageUrl],
    category,
    description: product.description ?? product.seoDescription ?? product.name,
    specs: product.specs?.length ? product.specs : buildFallbackSpecs(product),
    isBestSeller: product.isBestSeller,
    isNew: product.isNew,
  };
}

export function toStorefrontProducts(
  products: CatalogProduct[]
): StorefrontProduct[] {
  return products.map(toStorefrontProduct);
}
