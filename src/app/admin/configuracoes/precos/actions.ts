'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import { updateAutomaticPjDiscountPolicy } from '@/modules/pricing/pricing.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

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

export async function updateAutomaticPjDiscountAction(formData: FormData): Promise<AdminActionResult> {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);

  if (!access.allowed) {
    return adminActionError('Você não possui permissão para alterar a política de preços.');
  }

  const parsed = automaticPjDiscountSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    percentage: formData.get('percentage'),
  });

  if (!parsed.success) {
    return adminActionError(parsed.error.issues[0]?.message ?? 'Informe uma política de preços válida.');
  }

  await updateAutomaticPjDiscountPolicy({
    storeId: store.id,
    ...parsed.data,
  });

  revalidatePath('/admin/configuracoes/precos');
  revalidatePath('/carrinho');
  revalidatePath('/');
  return adminActionSuccess('Política de preços salva com sucesso.');
}
