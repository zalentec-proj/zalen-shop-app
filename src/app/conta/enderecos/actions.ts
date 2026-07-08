'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerAccountForUser } from '@/modules/customer-account/customer-account.service';
import {
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  upsertCustomerAddress,
} from '@/modules/customers/customer.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const optionalAddressString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const addressFormSchema = z.object({
  addressId: optionalAddressString,
  label: optionalAddressString,
  recipientName: optionalAddressString,
  phone: optionalAddressString,
  postalCode: z.string().trim().min(8),
  street: z.string().trim().min(2),
  number: z.string().trim().min(1),
  complement: optionalAddressString,
  district: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
  isDefault: z.boolean(),
});

const addressIdSchema = z.object({
  addressId: z.string().trim().min(1),
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value : '';
}

async function requireCustomerAccount(next = '/conta/enderecos') {
  const supabase = await createOptionalClient();

  if (!supabase) {
    redirect(`/conta/entrar?next=${encodeURIComponent(next)}`);
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/conta/entrar?next=${encodeURIComponent(next)}`);
  }

  const store = await resolveCurrentStoreFromHeaders();
  const account = await getCustomerAccountForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
  });

  if (!account) {
    redirect('/conta?enderecos=conta_indisponivel');
  }

  return {
    store,
    account,
  };
}

export async function saveCustomerAddressAction(formData: FormData) {
  const { store, account } = await requireCustomerAccount();
  const parsed = addressFormSchema.safeParse({
    addressId: formString(formData, 'addressId'),
    label: formString(formData, 'label'),
    recipientName: formString(formData, 'recipientName'),
    phone: formString(formData, 'phone'),
    postalCode: formString(formData, 'postalCode'),
    street: formString(formData, 'street'),
    number: formString(formData, 'number'),
    complement: formString(formData, 'complement'),
    district: formString(formData, 'district'),
    city: formString(formData, 'city'),
    state: formString(formData, 'state').toUpperCase(),
    isDefault: formData.get('isDefault') === 'on',
  });

  if (!parsed.success) {
    redirect('/conta/enderecos?enderecos=dados_invalidos');
  }

  await upsertCustomerAddress({
    storeId: store.id,
    customer: account.customer,
    addressId: parsed.data.addressId,
    isDefault: parsed.data.isDefault || account.addresses.length === 0,
    address: {
      label: parsed.data.label,
      recipientName: parsed.data.recipientName,
      phone: parsed.data.phone,
      postalCode: parsed.data.postalCode,
      street: parsed.data.street,
      number: parsed.data.number,
      complement: parsed.data.complement,
      district: parsed.data.district,
      city: parsed.data.city,
      state: parsed.data.state,
      country: 'BR',
    },
  });

  revalidatePath('/conta');
  revalidatePath('/conta/enderecos');
  revalidatePath('/carrinho');
  redirect('/conta/enderecos?enderecos=salvo');
}

export async function setDefaultCustomerAddressAction(formData: FormData) {
  const { store, account } = await requireCustomerAccount();
  const parsed = addressIdSchema.safeParse({
    addressId: formString(formData, 'addressId'),
  });

  if (!parsed.success) {
    redirect('/conta/enderecos?enderecos=dados_invalidos');
  }

  const ok = await setDefaultCustomerAddress({
    storeId: store.id,
    customerId: account.customer.id,
    addressId: parsed.data.addressId,
  });

  revalidatePath('/conta');
  revalidatePath('/conta/enderecos');
  revalidatePath('/carrinho');
  redirect(ok ? '/conta/enderecos?enderecos=padrao' : '/conta/enderecos?enderecos=erro');
}

export async function deleteCustomerAddressAction(formData: FormData) {
  const { store, account } = await requireCustomerAccount();
  const parsed = addressIdSchema.safeParse({
    addressId: formString(formData, 'addressId'),
  });

  if (!parsed.success) {
    redirect('/conta/enderecos?enderecos=dados_invalidos');
  }

  const ok = await deleteCustomerAddress({
    storeId: store.id,
    customerId: account.customer.id,
    addressId: parsed.data.addressId,
  });

  revalidatePath('/conta');
  revalidatePath('/conta/enderecos');
  revalidatePath('/carrinho');
  redirect(ok ? '/conta/enderecos?enderecos=removido' : '/conta/enderecos?enderecos=erro');
}
