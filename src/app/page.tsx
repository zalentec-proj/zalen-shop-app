import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import App from '@/App';
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
  storefrontDescription,
} from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';

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

  return {
    ...(await buildStoreMetadata({
      store,
      origin: await getCurrentOrigin(),
      title: `${store.name} — Drones e Peças DJI`,
      description: storefrontDescription,
      path: '/',
    })),
  };
}

function StoreNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A1730]/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Loja não encontrada
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Este endereço não está ativo
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Verifique o subdomínio da loja ou acesse o painel pela Zalen Shop.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-blue-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f68ff]"
        >
          Ir para o login
        </Link>
      </section>
    </main>
  );
}

export default async function HomePage() {
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
    return <StoreNotFound />;
  }

  const [catalogProducts, catalogCategories] = await Promise.all([
    listStorefrontProducts(store.id),
    listCategories(store.id),
  ]);
  const products = toStorefrontProducts(catalogProducts);
  const categories = toStorefrontCategories(catalogCategories, catalogProducts);
  const [origin, marketingConfig, navigation] = await Promise.all([
    getCurrentOrigin(),
    getMarketingRuntimeConfig(store),
    getStorefrontNavigation(store.id, categories),
  ]);

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <JsonLd data={buildOrganizationJsonLd(store, origin)} />
      <JsonLd data={buildWebSiteJsonLd(store, origin)} />
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
      <App products={products} categories={categories} navigation={navigation} />
    </>
  );
}
