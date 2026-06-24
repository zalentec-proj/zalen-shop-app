import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getCategoryBySlug,
  listCategories,
  listCategoryProducts,
} from '@/modules/catalog/product.service';
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
  return {
    title: `${category.name} — ${store.name}`,
    description: `Explore nossa seleção de ${category.name.toLowerCase()} com qualidade e garantia oficial.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) notFound();

  const [category, products, categories] = await Promise.all([
    getCategoryBySlug(store.id, slug),
    listCategoryProducts(store.id, slug),
    listCategories(store.id),
  ]);

  if (!category) notFound();

  return <CategoryClient category={category} products={products} categories={categories} />;
}
