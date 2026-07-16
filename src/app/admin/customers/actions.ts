'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  checkStoreRole,
  storeOperationalRoles,
} from '@/modules/auth/auth.service';
import { upsertCustomer } from '@/modules/customers/customer.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const customerFormSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createAdminCustomerAction(formData: FormData) {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, storeOperationalRoles);

  if (!access.allowed) {
    return;
  }

  const parsed = customerFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    document: formData.get('document'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    return;
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
}
