import { droneAccessoriesImage } from '@/assets/images';
import type {
  Product as StorefrontProduct,
  StorefrontCategory,
} from '@/types';
import type {
  Category as CatalogCategory,
  Product as CatalogProduct,
} from './product.types';
import {
  getCategoryGroupKey,
  isCategoryGroupRoot,
} from './category-groups';

const fallbackImageUrl = droneAccessoriesImage;

function buildFallbackSpecs(product: CatalogProduct): StorefrontProduct['specs'] {
  const variant = product.variants[0];
  const specs = [
    product.brand ? { label: 'Marca', value: product.brand } : null,
    variant?.sku ? { label: 'SKU', value: variant.sku } : null,
    variant ? { label: 'Estoque', value: `${variant.stock} un.` } : null,
    product.freeShipping
      ? { label: 'Frete', value: 'Grátis' }
      : product.requiresShipping
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
  const categories = product.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
  }));
  const primaryCategory = categories[0];

  return {
    id: product.slug,
    catalogProductId: product.id,
    variantId: variant?.id,
    sku: variant?.sku,
    name: product.name,
    subtitle: product.seoDescription ?? product.brand,
    price: variant?.promotionalPrice ?? variant?.price ?? 0,
    originalPrice: variant?.promotionalPrice ? variant.price : undefined,
    stock: variant?.stock ?? 0,
    isAvailable: (variant?.stock ?? 0) > 0,
    rating: product.rating ?? 4.8,
    reviewsCount: product.reviewsCount ?? 0,
    image: images[0] ?? fallbackImageUrl,
    images: images.length > 0 ? images : [fallbackImageUrl],
    category: primaryCategory?.name ?? 'Catálogo',
    categorySlug: primaryCategory?.slug,
    categories,
    description: product.description ?? product.seoDescription ?? product.name,
    specs: product.specs?.length ? product.specs : buildFallbackSpecs(product),
    isBestSeller: product.isBestSeller,
    isNew: product.isNew,
  };
}

export function toStorefrontProducts(
  products: CatalogProduct[]
): StorefrontProduct[] {
  return products
    .map(toStorefrontProduct)
    .sort((left, right) => Number(right.isAvailable) - Number(left.isAvailable));
}

export function toStorefrontCategories(
  categories: CatalogCategory[],
  products: CatalogProduct[]
): StorefrontCategory[] {
  const productIdsBySlug = new Map<string, Set<string>>();
  const categoriesBySlug = new Map<string, StorefrontCategory>();
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const childrenByParentId = new Map<string, CatalogCategory[]>();

  for (const category of categories) {
    if (category.parentId) {
      const siblings = childrenByParentId.get(category.parentId) ?? [];
      siblings.push(category);
      childrenByParentId.set(category.parentId, siblings);
    }

    categoriesBySlug.set(category.slug, {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      externalId: category.externalId,
      position: category.position,
      productCount: 0,
      descendantSlugs: [],
    });
  }

  for (const product of products) {
    for (const category of product.categories) {
      const productIds = productIdsBySlug.get(category.slug) ?? new Set<string>();
      productIds.add(product.id);
      productIdsBySlug.set(category.slug, productIds);

      if (!categoriesBySlug.has(category.slug)) {
        categoriesBySlug.set(category.slug, {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          externalId: category.externalId,
          position: category.position,
          productCount: 0,
          descendantSlugs: [],
        });
      }
    }
  }

  const collectDescendantSlugs = (categoryId: string): string[] => {
    const children = childrenByParentId.get(categoryId) ?? [];

    return children.flatMap((child) => [
      child.slug,
      ...collectDescendantSlugs(child.id),
    ]);
  };

  return Array.from(categoriesBySlug.values()).map((category) => {
    const syntheticGroupKey = isCategoryGroupRoot(category)
      ? getCategoryGroupKey(category)
      : null;
    const syntheticDescendantSlugs = syntheticGroupKey
      ? Array.from(categoriesBySlug.values())
          .filter((candidate) => {
            return (
              candidate.slug !== category.slug &&
              getCategoryGroupKey(candidate) === syntheticGroupKey
            );
          })
          .map((candidate) => candidate.slug)
      : [];
    const descendantSlugs = [
      ...new Set([
        ...(categoriesById.has(category.id)
          ? collectDescendantSlugs(category.id)
          : []),
        ...syntheticDescendantSlugs,
      ]),
    ];
    const productIds = new Set<string>();

    [category.slug, ...descendantSlugs].forEach((slug) => {
      productIdsBySlug.get(slug)?.forEach((productId) => productIds.add(productId));
    });

    return {
      ...category,
      descendantSlugs,
      productCount: productIds.size,
    };
  }).sort((left, right) => {
    const leftRoot = isCategoryGroupRoot(left);
    const rightRoot = isCategoryGroupRoot(right);

    if (leftRoot !== rightRoot) {
      return leftRoot ? -1 : 1;
    }

    return right.productCount - left.productCount;
  });
}
