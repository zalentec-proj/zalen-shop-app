import { randomUUID } from 'node:crypto';
import { AdminEmptyState, AdminPageFrame, AdminPageHeader } from '@/components/admin/AdminLayout';
import { checkStoreRole, storeOperationalRoles } from '@/modules/auth/auth.service';
import { emptyManualProduct } from '@/modules/catalog/manual-product';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { ProductEditor } from '../ProductEditor';

export const metadata = { title: 'Novo produto — Zalen Shop' };
export default async function NewProductPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, storeOperationalRoles);
  if (!access.allowed) return <AdminEmptyState title="Acesso restrito" description="Sua conta não pode cadastrar produtos nesta loja." />;
  const initial = emptyManualProduct(randomUUID());
  return <AdminPageFrame><AdminPageHeader eyebrow="Catálogo" title="Novo produto" description={`Cadastre um produto em ${store.name}.`} /><ProductEditor initial={initial} /></AdminPageFrame>;
}
