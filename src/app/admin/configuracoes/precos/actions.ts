'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import { updateAutomaticPjDiscountPolicy } from '@/modules/pricing/pricing.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const automaticPjDiscountSchema = z
  .object({
    enabled: z.boolean(),
    percentage: z.coerce.number().min(0).max(100),
  })
  .superRefine((policy, context) => {
    if (policy.enabled && policy.percentage <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['percentage'],
        message: 'Informe um percentual maior que zero.',
      });
    }
  });

export async function updateAutomaticPjDiscountAction(formData: FormData) {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);

  if (!access.allowed) {
    return;
  }

  const parsed = automaticPjDiscountSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    percentage: formData.get('percentage'),
  });

  if (!parsed.success) {
    return;
  }

  await updateAutomaticPjDiscountPolicy({
    storeId: store.id,
    ...parsed.data,
  });

  revalidatePath('/admin/configuracoes/precos');
  revalidatePath('/carrinho');
  revalidatePath('/');
}
