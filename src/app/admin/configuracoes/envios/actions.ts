'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  updateShippingMethod,
  upsertShippingOrigin,
} from '@/modules/shipping/shipment.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().nonnegative().optional()
);

const optionalPositiveMoney = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().positive().optional()
);

const originSchema = z.object({
  senderName: z.string().trim().min(2),
  postalCode: z.string().trim().min(8),
  street: z.string().trim().min(2),
  number: z.string().trim().min(1),
  complement: optionalText,
  district: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
  country: z.string().trim().min(2).default('BR'),
  phone: optionalText,
  status: z.enum(['active', 'disabled']),
});

const methodSchema = z
  .object({
    methodId: z.string().trim().uuid(),
    status: z.enum(['active', 'disabled']),
    price: z.coerce.number().nonnegative(),
    freeOverSubtotal: optionalPositiveMoney,
    minDeliveryDays: optionalNumber,
    maxDeliveryDays: optionalNumber,
  })
  .superRefine((method, context) => {
    if (
      method.minDeliveryDays !== undefined &&
      method.maxDeliveryDays !== undefined &&
      method.minDeliveryDays > method.maxDeliveryDays
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxDeliveryDays'],
        message: 'Prazo máximo deve ser maior ou igual ao mínimo.',
      });
    }
  });

async function ensureWritableAccess() {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);

  return {
    store,
    allowed: access.allowed,
  };
}

export async function upsertShippingOriginAction(formData: FormData): Promise<AdminActionResult> {
  const { store, allowed } = await ensureWritableAccess();

  if (!allowed) {
    return adminActionError('Você não possui permissão para alterar a origem de envio.');
  }

  const parsed = originSchema.safeParse({
    senderName: formData.get('senderName'),
    postalCode: formData.get('postalCode'),
    street: formData.get('street'),
    number: formData.get('number'),
    complement: formData.get('complement'),
    district: formData.get('district'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country') || 'BR',
    phone: formData.get('phone'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return adminActionError('Revise os dados obrigatórios da origem de envio.');
  }

  await upsertShippingOrigin({
    storeId: store.id,
    ...parsed.data,
  });

  revalidatePath('/admin/configuracoes/envios');
  return adminActionSuccess('Origem de envio salva com sucesso.');
}

export async function updateShippingMethodAction(formData: FormData): Promise<AdminActionResult> {
  const { store, allowed } = await ensureWritableAccess();

  if (!allowed) {
    return adminActionError('Você não possui permissão para alterar métodos de envio.');
  }

  const parsed = methodSchema.safeParse({
    methodId: formData.get('methodId'),
    status: formData.get('status'),
    price: formData.get('price'),
    freeOverSubtotal: formData.get('freeOverSubtotal'),
    minDeliveryDays: formData.get('minDeliveryDays'),
    maxDeliveryDays: formData.get('maxDeliveryDays'),
  });

  if (!parsed.success) {
    return adminActionError(parsed.error.issues[0]?.message ?? 'Revise os valores e prazos do método de envio.');
  }

  await updateShippingMethod({
    storeId: store.id,
    ...parsed.data,
  });

  revalidatePath('/admin/configuracoes/envios');
  return adminActionSuccess('Método de envio salvo com sucesso.');
}
