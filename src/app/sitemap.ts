import type { MetadataRoute } from 'next';
import {
  listCategories,
  listStorefrontProducts,
} from '@/modules/catalog/product.service';
import {
  absoluteStoreUrl,
  getCurrentOrigin,
} from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, resolution] = await Promise.all([
    getCurrentOrigin(),
    resolveStoreFromHeaders(),
  ]);
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    return [];
  }

  const [categories, products] = await Promise.all([
    listCategories(store.id),
    listStorefrontProducts(store.id),
  ]);

  return [
    {
      url: absoluteStoreUrl(origin, '/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categories.map((category) => ({
      url: absoluteStoreUrl(origin, `/categoria/${category.slug}`),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products
      .filter((product) => product.status === 'active')
      .map((product) => ({
        url: absoluteStoreUrl(origin, `/produto/${product.slug}`),
        lastModified: new Date(product.updatedAt ?? product.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
  ];
}
