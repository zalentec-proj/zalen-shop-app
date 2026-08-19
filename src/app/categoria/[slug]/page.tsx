import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getCategoryBySlug,
  listCategories,
  listCategoryProducts,
  listStorefrontProducts,
} from '@/modules/catalog/product.service';
import {
  toStorefrontCategories,
} from '@/modules/catalog/storefront-product.adapter';
import { getStorefrontNavigation } from '@/modules/catalog/storefront-navigation';
import { MarketingDataLayer } from '@/modules/marketing/MarketingDataLayer';
import { MarketingScripts } from '@/modules/marketing/MarketingScripts';
import { getMarketingRuntimeConfig } from '@/modules/marketing/marketing.service';
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCategoryBreadcrumb,
  buildStoreMetadata,
  getCurrentOrigin,
} from '@/modules/seo/seo.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import CategoryClient from './CategoryClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await listCategories(ACTIVE_STORE_ID);
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) return {};

  const category = await getCategoryBySlug(store.id, slug);
  if (!category) return {};
  const origin = await getCurrentOrigin();
  return buildStoreMetadata({
    store,
    origin,
    title: `${category.name} — ${store.name}`,
    description: `Explore nossa seleção de ${category.name.toLowerCase()} com qualidade e garantia oficial.`,
    path: `/categoria/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) notFound();

  const [category, products, categories, catalogProducts] = await Promise.all([
    getCategoryBySlug(store.id, slug),
    listCategoryProducts(store.id, slug),
    listCategories(store.id),
    listStorefrontProducts(store.id),
  ]);

  if (!category) notFound();

  const storefrontCategories = toStorefrontCategories(categories, catalogProducts);

  const [origin, marketingConfig, navigation] = await Promise.all([
    getCurrentOrigin(),
    getMarketingRuntimeConfig(store),
    getStorefrontNavigation(store.id, storefrontCategories),
  ]);

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <JsonLd data={buildBreadcrumbJsonLd(origin, buildCategoryBreadcrumb(category))} />
      <MarketingDataLayer
        config={marketingConfig}
        event={{
          event: 'view_item_list',
          event_id: `view_item_list:${store.id}:category:${category.id}`,
          ecommerce: {
            currency: 'BRL',
            items: products.slice(0, 24).map((product) => {
              const variant = product.variants[0];

              return {
                item_id: variant?.sku ?? variant?.id ?? product.id,
                item_name: product.name,
                item_brand: product.brand,
                item_category: category.name,
                price: variant?.promotionalPrice ?? variant?.price,
                quantity: 1,
              };
            }),
          },
        }}
      />
      <CategoryClient
        category={category}
        products={products}
        storefrontCategories={storefrontCategories}
        navigation={navigation}
      />
    </>
  );
}
