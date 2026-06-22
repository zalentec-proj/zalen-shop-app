'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  updateProductStatus,
  updateProductStock,
} from '@/modules/catalog/product.service';
import { updateVariantBusinessPrice } from '@/modules/pricing/pricing.service';

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
  const access = await checkStoreRole(
    ACTIVE_STORE_ID,
    writableStoreRoles
  );

  return access.allowed;
}

export async function updateProductStatusAction(
  formData: FormData
): Promise<void> {
  if (!(await canManageProducts())) {
    return;
  }

  const parsed = statusSchema.safeParse({
    productId: formData.get('productId'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return;
  }

  const result = await updateProductStatus({
    storeId: ACTIVE_STORE_ID,
    productId: parsed.data.productId,
    status: parsed.data.status,
  });

  if (!result.ok) {
    return;
  }

  revalidatePath('/admin');
}

export async function updateProductStockAction(
  formData: FormData
): Promise<void> {
  if (!(await canManageProducts())) {
    return;
  }

  const parsed = stockSchema.safeParse({
    productId: formData.get('productId'),
    stock: formData.get('stock'),
  });

  if (!parsed.success) {
    return;
  }

  const result = await updateProductStock({
    storeId: ACTIVE_STORE_ID,
    productId: parsed.data.productId,
    stock: parsed.data.stock,
  });

  if (!result.ok) {
    return;
  }

  revalidatePath('/admin');
}

export async function updateProductBusinessPriceAction(
  formData: FormData
): Promise<void> {
  if (!(await canManageProducts())) {
    return;
  }

  const parsed = businessPriceSchema.safeParse({
    variantId: formData.get('variantId'),
    price: formData.get('price'),
  });

  if (!parsed.success) {
    return;
  }

  const result = await updateVariantBusinessPrice({
    storeId: ACTIVE_STORE_ID,
    variantId: parsed.data.variantId,
    price: parsed.data.price,
  });

  if (!result) {
    return;
  }

  revalidatePath('/admin');
}
