import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getCategoryBySlug,
  listCategories,
  listCategoryProducts,
} from '@/modules/catalog/product.service';
import CategoryClient from './CategoryClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await listCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: `${category.name} — Brasil Drones & Parts`,
    description: `Explore nossa seleção de ${category.name.toLowerCase()} com qualidade e garantia oficial.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, products, categories] = await Promise.all([
    getCategoryBySlug(slug),
    listCategoryProducts(slug),
    listCategories(),
  ]);

  if (!category) notFound();

  return <CategoryClient category={category} products={products} categories={categories} />;
}
