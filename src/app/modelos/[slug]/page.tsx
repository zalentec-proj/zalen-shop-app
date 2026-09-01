import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketingDataLayer } from '@/modules/marketing/MarketingDataLayer';
import { MarketingScripts } from '@/modules/marketing/MarketingScripts';
import { getMarketingRuntimeConfig } from '@/modules/marketing/marketing.service';
import {
  getDroneModel,
  listDroneModelCatalog,
  listProductsForDroneModel,
} from '@/modules/catalog/drone-model.service';
import { listCategories, listStorefrontProducts } from '@/modules/catalog/product.service';
import { toStorefrontCategories } from '@/modules/catalog/storefront-product.adapter';
import { getStorefrontNavigation } from '@/modules/catalog/storefront-navigation';
import { toStorefrontSearchPreviews } from '@/modules/catalog/storefront-search';
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildStoreMetadata,
  getCurrentOrigin,
} from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import ModelListingClient from '../ModelListingClient';

interface ModelPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) return {};

  const entry = await getDroneModel(store.id, slug);
  if (!entry) return {};

  const origin = await getCurrentOrigin();
  return buildStoreMetadata({
    store,
    origin,
    title: `Peças compatíveis com DJI ${entry.model.name} — ${store.name}`,
    description: `Peças e acessórios DJI compatíveis com ${entry.model.name}. Confira a posição e a compatibilidade antes da compra.`,
    path: `/modelos/${entry.model.slug}`,
    imageUrl: entry.model.imageUrl,
  });
}

export default async function DroneModelPage({ params }: ModelPageProps) {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) notFound();

  const entry = await getDroneModel(store.id, slug);
  if (!entry) notFound();

  const [products, categories, catalogProducts, origin, marketingConfig] = await Promise.all([
    listProductsForDroneModel(store.id, entry.model.id),
    listCategories(store.id),
    listStorefrontProducts(store.id),
    getCurrentOrigin(),
    getMarketingRuntimeConfig(store),
  ]);
  const storefrontCategories = toStorefrontCategories(categories, catalogProducts);
  const navigation = await getStorefrontNavigation(store.id, storefrontCategories);
  const breadcrumb = [
    { name: 'Início', path: '/' },
    { name: entry.line.name, path: `/modelos/linha/${entry.line.slug}` },
    { name: entry.model.name, path: `/modelos/${entry.model.slug}` },
  ];

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <JsonLd data={buildBreadcrumbJsonLd(origin, breadcrumb)} />
      <MarketingDataLayer
        config={marketingConfig}
        event={{
          event: 'view_item_list',
          event_id: `view_item_list:${store.id}:model:${entry.model.id}`,
          ecommerce: {
            currency: 'BRL',
            items: products.slice(0, 24).map((product) => ({
              item_id: product.variants[0]?.sku ?? product.id,
              item_name: product.name,
              item_brand: product.brand,
              item_category: entry.model.name,
              price: product.variants[0]?.promotionalPrice ?? product.variants[0]?.price,
              quantity: 1,
            })),
          },
        }}
      />
      <ModelListingClient
        eyebrow={entry.line.name}
        title={`DJI ${entry.model.name}`}
        products={products}
        searchProductPreviews={toStorefrontSearchPreviews(catalogProducts)}
        storefrontCategories={storefrontCategories}
        navigation={navigation}
      />
    </>
  );
}

export async function generateStaticParams() {
  const lines = await listDroneModelCatalog(ACTIVE_STORE_ID);
  return lines.flatMap((line) => line.models.map((model) => ({ slug: model.slug })));
}
