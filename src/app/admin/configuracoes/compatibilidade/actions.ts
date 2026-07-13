'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import { replaceProductDroneModels } from '@/modules/catalog/drone-model.service';
import { setStorefrontModelNavigationEnabled } from '@/modules/catalog/storefront-navigation';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const formSchema = z.object({
  productId: z.string().uuid(),
  modelIds: z.array(z.string().uuid()).max(31),
});

export async function saveProductDroneModelsAction(formData: FormData) {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);
  if (!access.allowed) return;

  const parsed = formSchema.safeParse({
    productId: formData.get('productId'),
    modelIds: Array.from(new Set(formData.getAll('modelIds').map(String))),
  });
  if (!parsed.success) return;

  const result = await replaceProductDroneModels({
    storeId: store.id,
    productId: parsed.data.productId,
    modelIds: parsed.data.modelIds,
    source: 'manual',
    confidence: 'confirmed',
  });
  if (!result.ok) return;

  revalidatePath('/admin/configuracoes/compatibilidade');
  revalidatePath('/modelos/[slug]', 'page');
  revalidatePath('/modelos/linha/[slug]', 'page');
}

export async function activateDroneModelNavigationAction() {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);
  if (!access.allowed) return;

  const result = await setStorefrontModelNavigationEnabled(store.id, true);
  if (!result.ok) return;

  revalidatePath('/');
  revalidatePath('/admin/configuracoes/loja-online');
  revalidatePath('/admin/configuracoes/compatibilidade');
  revalidatePath('/modelos/[slug]', 'page');
  revalidatePath('/modelos/linha/[slug]', 'page');
}
