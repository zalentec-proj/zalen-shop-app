'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { upsertCustomer } from '@/modules/customers/customer.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';

const customerFormSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createAdminCustomerAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user || !(await canAccessStore(user.id, ACTIVE_STORE_ID))) {
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
    storeId: ACTIVE_STORE_ID,
    name: parsed.data.name,
    email: parsed.data.email || undefined,
    phone: parsed.data.phone || undefined,
    document: parsed.data.document || undefined,
    notes: parsed.data.notes || undefined,
    source: 'manual',
  });

  revalidatePath('/admin');
}
