import 'server-only';

import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { Category, Product } from '@/modules/catalog/product.types';
import type { StoreContext } from '@/modules/stores/store.types';
import { getRequestHost } from '@/modules/stores/host-resolution';
import {
  getCurrentStorefrontOrigin,
  resolveStoreFromHost,
} from '@/modules/stores/store-resolution';

export const storefrontDescription =
  'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.';

function trimText(value: string | undefined, maxLength = 280) {
  return value?.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function protocolForHost(host: string) {
  return host.includes('localhost') || host.includes('lvh.me') || host.startsWith('127.')
    ? 'http'
    : 'https';
}

export async function getCurrentOrigin() {
  const headerStore = await headers();
  const host = getRequestHost(headerStore);
  const forwardedProto = headerStore.get('x-forwarded-proto');

  if (!host) {
    return 'http://localhost:3000';
  }

  const currentOrigin = `${forwardedProto ?? protocolForHost(host)}://${host}`;
  const resolution = await resolveStoreFromHost(host);

  if (resolution.kind === 'store' || resolution.kind === 'fallback') {
    return getCurrentStorefrontOrigin(resolution.store);
  }

  return currentOrigin;
}

export function absoluteStoreUrl(origin: string, path = '/') {
  return new URL(path, origin).toString();
}

export function buildStoreMetadata(input: {
  store: StoreContext;
  origin: string;
  title: string;
  description?: string;
  path?: string;
  imageUrl?: string;
}): Metadata {
  const description = trimText(input.description) ?? storefrontDescription;
  const canonical = absoluteStoreUrl(input.origin, input.path ?? '/');
  const images = input.imageUrl ? [{ url: input.imageUrl }] : undefined;

  return {
    metadataBase: new URL(input.origin),
    title: input.title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      title: input.title,
      description,
      siteName: input.store.name,
      locale: 'pt_BR',
      images,
    },
    twitter: {
      card: input.imageUrl ? 'summary_large_image' : 'summary',
      title: input.title,
      description,
      images: input.imageUrl ? [input.imageUrl] : undefined,
    },
  };
}

export const noindexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export function buildOrganizationJsonLd(store: StoreContext, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: store.name,
    url: absoluteStoreUrl(origin, '/'),
  };
}

export function buildWebSiteJsonLd(store: StoreContext, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: store.name,
    url: absoluteStoreUrl(origin, '/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteStoreUrl(origin, '/')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbJsonLd(
  origin: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteStoreUrl(origin, item.path),
    })),
  };
}

export function buildProductJsonLd(
  store: StoreContext,
  origin: string,
  product: Product
) {
  const variant = product.variants[0];
  const imageUrls = product.images.map((image) => image.url).filter(Boolean);
  const category = product.categories[0];
  const price = variant?.promotionalPrice ?? variant?.price;

  if (!variant || !price || imageUrls.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: trimText(product.description ?? product.seoDescription),
    sku: variant.sku,
    brand: product.brand
      ? {
          '@type': 'Brand',
          name: product.brand,
        }
      : undefined,
    category: category?.name,
    image: imageUrls,
    offers: {
      '@type': 'Offer',
      url: absoluteStoreUrl(origin, `/produto/${product.slug}`),
      priceCurrency: 'BRL',
      price: price.toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      availability:
        variant.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: store.name,
      },
    },
  };
}

export function buildCategoryBreadcrumb(
  category: Category
): Array<{ name: string; path: string }> {
  return [
    { name: 'Início', path: '/' },
    { name: category.name, path: `/categoria/${category.slug}` },
  ];
}

export function buildProductBreadcrumb(
  product: Product
): Array<{ name: string; path: string }> {
  const category = product.categories[0];

  return [
    { name: 'Início', path: '/' },
    ...(category
      ? [{ name: category.name, path: `/categoria/${category.slug}` }]
      : []),
    { name: product.name, path: `/produto/${product.slug}` },
  ];
}

export function JsonLd({ data }: { data: unknown }) {
  if (!data) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
