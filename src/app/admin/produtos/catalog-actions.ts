'use server';

import { revalidatePath } from 'next/cache';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { saveManualProduct } from '@/modules/catalog/manual-product.service';
import { manualProductSchema } from '@/modules/catalog/manual-product';

export async function saveManualProductAction(form: FormData) {
  const store = await resolveCurrentStoreFromHeaders();
  const input = Object.fromEntries(Object.keys(manualProductSchema.shape).map(key => [key, form.get(key)]));
  const result = await saveManualProduct(store.id, input);
  if (result.ok) {
    revalidatePath('/admin');
    revalidatePath('/admin/produtos');
    revalidatePath('/admin/produtos/novo');
    revalidatePath(`/admin/produtos/${result.productId}/editar`);
    revalidatePath('/');
    revalidatePath(`/produto/${result.productId}`);
  }
  return result;
}
