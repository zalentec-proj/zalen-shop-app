import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getDroneModelLine,
  listProductsForDroneModelLine,
} from '@/modules/catalog/drone-model.service';
import { listCategories, listStorefrontProducts } from '@/modules/catalog/product.service';
import { toStorefrontCategories } from '@/modules/catalog/storefront-product.adapter';
import { getStorefrontNavigation } from '@/modules/catalog/storefront-navigation';
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
import ModelListingClient from '../../ModelListingClient';

interface ModelLinePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ModelLinePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) return {};

  const line = await getDroneModelLine(store.id, slug);
  if (!line) return {};

  const origin = await getCurrentOrigin();
  return buildStoreMetadata({
    store,
    origin,
    title: `${line.name} — ${store.name}`,
    description: `Peças e acessórios DJI organizados por modelos da ${line.name}.`,
    path: `/modelos/linha/${line.slug}`,
    imageUrl: line.imageUrl,
  });
}

export default async function DroneModelLinePage({ params }: ModelLinePageProps) {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) notFound();

  const line = await getDroneModelLine(store.id, slug);
  if (!line) notFound();

  const [products, categories, catalogProducts, origin] = await Promise.all([
    listProductsForDroneModelLine(store.id, line.id),
    listCategories(store.id),
    listStorefrontProducts(store.id),
    getCurrentOrigin(),
  ]);
  const storefrontCategories = toStorefrontCategories(categories, catalogProducts);
  const navigation = await getStorefrontNavigation(store.id, storefrontCategories);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(origin, [
          { name: 'Início', path: '/' },
          { name: line.name, path: `/modelos/linha/${line.slug}` },
        ])}
      />
      <ModelListingClient
        eyebrow="Modelos DJI"
        title={line.name}
        products={products}
        storefrontCategories={storefrontCategories}
        navigation={navigation}
      />
    </>
  );
}
