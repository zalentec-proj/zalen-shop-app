import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getManagedStore } from '@/modules/platform/store-management.service';
import { StorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import { NeutralStorefront } from '@/components/storefront/NeutralStorefront';
import { listCategories } from '@/modules/catalog/product.service';
import { listPlatformPreviewProducts } from '@/modules/catalog/product.repository';
import { toStorefrontCategories, toStorefrontProducts } from '@/modules/catalog/storefront-product.adapter';
import App from '@/App';
import { StorefrontPreview } from '@/components/storefront/StorefrontPreview';

export const metadata = { title: 'Prévia privada — Zalen Shop', robots: { index: false, follow: false } };
export default async function StorePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  // This guard also runs with a direct request or an RSC request to the page.
  const detail = await getManagedStore((await params).id);
  if (!detail) notFound();
  const [catalogProducts, catalogCategories] = await Promise.all([
    listPlatformPreviewProducts(detail.store.id), listCategories(detail.store.id),
  ]);
  const products = toStorefrontProducts(catalogProducts);
  const categories = toStorefrontCategories(catalogCategories, catalogProducts);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-amber-200">Prévia privada do rascunho · versão {detail.revision}</p><Link href={`/platform/lojas/${detail.store.id}`} className="text-blue-300">Voltar à personalização</Link></div>
    <p className="mb-5 text-xs text-slate-400">Confira a identidade visual. A navegação de compra estará disponível no endereço da loja após a ativação.</p>
    <StorefrontPreview>
      <StorefrontIdentity presentation={detail.config}>
        {detail.config.renderer === 'brasil-drones' ? <App products={products} categories={categories} /> : <NeutralStorefront presentation={detail.config} products={products} categories={categories} preview />}
      </StorefrontIdentity>
    </StorefrontPreview>
  </>;
}
