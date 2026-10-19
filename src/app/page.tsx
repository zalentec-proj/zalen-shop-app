import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import App from '@/App';
import { getPublishedPresentation } from '@/modules/storefront/presentation.repository';
import { NeutralStorefront } from '@/components/storefront/NeutralStorefront';
import { getServerEnv } from '@/lib/env/server';
import {
  listCategories,
  listStorefrontProducts,
} from '@/modules/catalog/product.service';
import {
  toStorefrontCategories,
  toStorefrontProducts,
} from '@/modules/catalog/storefront-product.adapter';
import { getStorefrontNavigation } from '@/modules/catalog/storefront-navigation';
import { MarketingDataLayer } from '@/modules/marketing/MarketingDataLayer';
import { MarketingScripts } from '@/modules/marketing/MarketingScripts';
import { getMarketingRuntimeConfig } from '@/modules/marketing/marketing.service';
import {
  JsonLd,
  buildOrganizationJsonLd,
  buildStoreMetadata,
  buildWebSiteJsonLd,
  getCurrentOrigin,
} from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import { getAutomaticPjDiscountPolicy } from '@/modules/pricing/pricing.service';

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await resolveStoreFromHeaders();
  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';

  if (
    resolution.kind === 'reserved' ||
    (resolution.kind === 'fallback' && resolution.host === rootDomain)
  ) {
    return {
      title: 'Zalen Shop',
      description:
        'Plataforma Zalen Shop para lojas, produtos, pedidos e integrações.',
    };
  }

  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    return {
      title: 'Loja não encontrada — Zalen Shop',
      description: 'Este endereço de loja não está ativo na Zalen Shop.',
    };
  }

  const presentation = await getPublishedPresentation(store);
  return {
    ...(await buildStoreMetadata({
      store,
      origin: await getCurrentOrigin(),
      title: presentation.seoTitle || presentation.brandName,
      description: presentation.seoDescription,
      path: '/',
      imageUrl: presentation.bannerUrl || (presentation.renderer === 'brasil-drones' ? '/og-image.png' : undefined),
    })),
    verification: presentation.renderer === 'brasil-drones' && getServerEnv().GOOGLE_SITE_VERIFICATION
      ? { google: getServerEnv().GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const resolution = await resolveStoreFromHeaders();
  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';

  if (
    resolution.kind === 'reserved' ||
    (resolution.kind === 'fallback' && resolution.host === rootDomain)
  ) {
    redirect('/login');
  }

  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    notFound();
  }

  const [catalogProducts, catalogCategories] = await Promise.all([
    listStorefrontProducts(store.id),
    listCategories(store.id),
  ]);
  const presentation = await getPublishedPresentation(store);
  const products = toStorefrontProducts(catalogProducts);
  const categories = toStorefrontCategories(catalogCategories, catalogProducts);
  const [origin, marketingConfig, navigation, pjDiscountPolicy] = await Promise.all([
    getCurrentOrigin(),
    getMarketingRuntimeConfig(store),
    getStorefrontNavigation(store.id, categories),
    getAutomaticPjDiscountPolicy(store.id),
  ]);

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <JsonLd data={buildOrganizationJsonLd({ ...store, name: presentation.brandName }, origin)} />
      <JsonLd data={buildWebSiteJsonLd({ ...store, name: presentation.brandName }, origin)} />
      <MarketingDataLayer
        config={marketingConfig}
        event={{
          event: 'view_item_list',
          event_id: `view_item_list:${store.id}:home`,
          ecommerce: {
            currency: 'BRL',
            items: catalogProducts.slice(0, 24).map((product) => {
              const variant = product.variants[0];

              return {
                item_id: variant?.sku ?? variant?.id ?? product.id,
                item_name: product.name,
                item_brand: product.brand,
                item_category: product.categories[0]?.name,
                price: variant?.promotionalPrice ?? variant?.price,
                quantity: 1,
              };
            }),
          },
        }}
      />
      {presentation.renderer === 'neutral' ? <NeutralStorefront presentation={presentation} products={products} categories={categories} initialQuery={typeof params?.q === 'string' ? params.q.slice(0, 100) : ''} /> : <App
        products={products}
        categories={categories}
        navigation={navigation}
        businessDiscountPercentage={
          pjDiscountPolicy?.automaticDiscountEnabled
            ? pjDiscountPolicy.automaticDiscountPercentage
            : undefined
        }
      />}
    </>
  );
}
