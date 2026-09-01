import type { Product } from './product.types';

export interface StorefrontSearchProductPreview {
  id: string;
  name: string;
  href: string;
  imageUrl?: string;
  price?: number;
  searchText?: string;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toStorefrontSearchPreviews(
  products: Product[]
): StorefrontSearchProductPreview[] {
  return products.map((product) => {
    const variant = product.variants[0];

    return {
      id: product.id,
      name: product.name,
      href: `/produto/${product.slug}`,
      imageUrl: product.images[0]?.url,
      price: variant?.promotionalPrice ?? variant?.price,
      searchText: [
        variant?.sku,
        product.brand,
        ...product.categories.flatMap((category) => [
          category.name,
          category.slug,
        ]),
      ]
        .filter(Boolean)
        .join(' '),
    };
  });
}

export function getStorefrontSearchResults(
  products: StorefrontSearchProductPreview[],
  query: string,
  limit = 6
) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];

  return products
    .filter((product) => {
      const haystack = normalizeSearchText(
        `${product.name} ${product.searchText ?? ''}`
      );

      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}
