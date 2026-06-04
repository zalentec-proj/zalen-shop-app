import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getProductBySlug,
  listProducts,
  listRelatedProducts,
} from '@/modules/catalog/product.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await listProducts(ACTIVE_STORE_ID);
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(ACTIVE_STORE_ID, slug);
  if (!product) return {};
  return {
    title: product.seoTitle ?? `${product.name} — Brasil Drones & Parts`,
    description: product.seoDescription ?? product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(ACTIVE_STORE_ID, slug);
  if (!product) notFound();

  const relatedProducts = await listRelatedProducts(ACTIVE_STORE_ID, slug, 3);

  return <ProductDetailClient product={product} relatedProducts={relatedProducts} />;
}
