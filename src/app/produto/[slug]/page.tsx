import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getProductBySlug,
  listProducts,
  listRelatedProducts,
} from '@/modules/catalog/product.service';
import { MarketingDataLayer } from '@/modules/marketing/MarketingDataLayer';
import { MarketingScripts } from '@/modules/marketing/MarketingScripts';
import { getMarketingRuntimeConfig } from '@/modules/marketing/marketing.service';
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductBreadcrumb,
  buildProductJsonLd,
  buildStoreMetadata,
  getCurrentOrigin,
} from '@/modules/seo/seo.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import ProductDetailClient from './ProductDetailClient';
import { getAutomaticPjDiscountPolicy } from '@/modules/pricing/pricing.service';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await listProducts(ACTIVE_STORE_ID);
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) return {};

  const product = await getProductBySlug(store.id, slug);
  if (!product) return {};
  const origin = await getCurrentOrigin();
  return buildStoreMetadata({
    store,
    origin,
    title: product.seoTitle ?? `${product.name} — ${store.name}`,
    description: product.seoDescription ?? product.description,
    path: `/produto/${product.slug}`,
    imageUrl: product.images[0]?.url,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) notFound();

  const product = await getProductBySlug(store.id, slug);
  if (!product) notFound();

  const relatedProducts = await listRelatedProducts(store.id, slug, 3);
  const [origin, marketingConfig, pjDiscountPolicy] = await Promise.all([
    getCurrentOrigin(),
    getMarketingRuntimeConfig(store),
    getAutomaticPjDiscountPolicy(store.id),
  ]);
  const variant = product.variants[0];
  const price = variant?.promotionalPrice ?? variant?.price;

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <JsonLd data={buildOrganizationJsonLd(store, origin)} />
      <JsonLd data={buildBreadcrumbJsonLd(origin, buildProductBreadcrumb(product))} />
      <JsonLd data={buildProductJsonLd(store, origin, product)} />
      <MarketingDataLayer
        config={marketingConfig}
        event={{
          event: 'view_item',
          event_id: `view_item:${store.id}:${product.id}`,
          ecommerce: {
            currency: 'BRL',
            value: price,
            items: [
              {
                item_id: variant?.sku ?? variant?.id ?? product.id,
                item_name: product.name,
                item_brand: product.brand,
                item_category: product.categories[0]?.name,
                price,
                quantity: 1,
              },
            ],
          },
          meta: {
            eventName: 'ViewContent',
            contentIds: [variant?.sku ?? variant?.id ?? product.id],
            contentName: product.name,
          },
        }}
      />
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        businessDiscountPercentage={
          pjDiscountPolicy?.automaticDiscountEnabled
            ? pjDiscountPolicy.automaticDiscountPercentage
            : undefined
        }
      />
    </>
  );
}
