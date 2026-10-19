import { notFound } from 'next/navigation';
import { AdminPageFrame, AdminPageHeader } from '@/components/admin/AdminLayout';
import { getManualProduct } from '@/modules/catalog/manual-product.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { ProductEditor } from '../../ProductEditor';

export const metadata = { title: 'Editar produto — Zalen Shop' };
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const store = await resolveCurrentStoreFromHeaders();
  const { id } = await params;
  const product = await getManualProduct(store.id, id);
  if (!product) notFound();
  return <AdminPageFrame><AdminPageHeader eyebrow="Catálogo" title="Editar produto" description={`${product.name} · ${store.name}`} /><ProductEditor key={product.productId} initial={product} /></AdminPageFrame>;
}
