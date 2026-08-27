'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  checkStoreRole,
  storeOperationalRoles,
} from '@/modules/auth/auth.service';
import { upsertCustomer } from '@/modules/customers/customer.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

const customerFormSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createAdminCustomerAction(formData: FormData): Promise<AdminActionResult> {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, storeOperationalRoles);

  if (!access.allowed) {
    return adminActionError('Você não possui permissão para cadastrar clientes.');
  }

  const parsed = customerFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    document: formData.get('document'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    return adminActionError('Revise o nome e o e-mail informados.');
  }

  await upsertCustomer({
    storeId: store.id,
    name: parsed.data.name,
    email: parsed.data.email || undefined,
    phone: parsed.data.phone || undefined,
    document: parsed.data.document || undefined,
    notes: parsed.data.notes || undefined,
    source: 'manual',
  });

  revalidatePath('/admin');
  revalidatePath('/admin/clientes');
  return adminActionSuccess('Cliente cadastrado com sucesso.');
}
