'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  updateProductStatus,
  updateProductStock,
} from '@/modules/catalog/product.service';
import { updateVariantBusinessPrice } from '@/modules/pricing/pricing.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const statusSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(['active', 'inactive', 'draft']),
});

const stockSchema = z.object({
  productId: z.string().uuid(),
  stock: z.coerce.number().int().min(0).max(999_999),
});

const businessPriceSchema = z.object({
  variantId: z.string().uuid(),
  price: z.coerce.number().min(0).max(9_999_999),
});

async function canManageProducts(): Promise<boolean> {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(
    store.id,
    writableStoreRoles
  );

  return access.allowed;
}

export async function updateProductStatusAction(
  formData: FormData
): Promise<AdminActionResult> {
  if (!(await canManageProducts())) {
    return adminActionError('Você não possui permissão para alterar produtos.');
  }

  const parsed = statusSchema.safeParse({
    productId: formData.get('productId'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return adminActionError('O status selecionado é inválido.');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const result = await updateProductStatus({
    storeId: store.id,
    productId: parsed.data.productId,
    status: parsed.data.status,
  });

  if (!result.ok) {
    return adminActionError('Não foi possível atualizar a publicação do produto.');
  }

  revalidatePath('/admin');
  revalidatePath('/admin/produtos');
  return adminActionSuccess('Publicação do produto atualizada.');
}

export async function updateProductStockAction(
  formData: FormData
): Promise<AdminActionResult> {
  if (!(await canManageProducts())) {
    return adminActionError('Você não possui permissão para alterar produtos.');
  }

  const parsed = stockSchema.safeParse({
    productId: formData.get('productId'),
    stock: formData.get('stock'),
  });

  if (!parsed.success) {
    return adminActionError('Informe um estoque válido.');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const result = await updateProductStock({
    storeId: store.id,
    productId: parsed.data.productId,
    stock: parsed.data.stock,
  });

  if (!result.ok) {
    return adminActionError('Não foi possível atualizar o estoque do produto.');
  }

  revalidatePath('/admin');
  revalidatePath('/admin/produtos');
  return adminActionSuccess('Estoque do produto atualizado.');
}

export async function updateProductBusinessPriceAction(
  formData: FormData
): Promise<AdminActionResult> {
  if (!(await canManageProducts())) {
    return adminActionError('Você não possui permissão para alterar produtos.');
  }

  const parsed = businessPriceSchema.safeParse({
    variantId: formData.get('variantId'),
    price: formData.get('price'),
  });

  if (!parsed.success) {
    return adminActionError('Informe um preço PJ válido.');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const result = await updateVariantBusinessPrice({
    storeId: store.id,
    variantId: parsed.data.variantId,
    price: parsed.data.price,
  });

  if (!result) {
    return adminActionError('Não foi possível atualizar o preço PJ.');
  }

  revalidatePath('/admin');
  revalidatePath('/admin/produtos');
  return adminActionSuccess('Preço PJ atualizado.');
}
