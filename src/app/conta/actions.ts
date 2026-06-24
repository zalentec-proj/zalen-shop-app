'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isValidCpfOrCnpj } from '@/modules/customers/br-document';
import { upsertCustomer } from '@/modules/customers/customer.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

export type CustomerAuthState = {
  error?: string;
  message?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  next: z.string().optional(),
});

const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  document: z
    .string()
    .trim()
    .min(11)
    .refine(isValidCpfOrCnpj, 'CPF ou CNPJ inválido.'),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/carrinho';
  }

  if (value.startsWith('/admin') || value.startsWith('/platform')) {
    return '/carrinho';
  }

  return value;
}

export async function customerLoginAction(
  _previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, 'email'),
    password: formValue(formData, 'password'),
    next: formValue(formData, 'next'),
  });

  if (!parsed.success) {
    return { error: 'Informe e-mail e senha válidos.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: 'Não foi possível entrar com esses dados.' };
  }

  redirect(getSafeNextPath(parsed.data.next));
}

export async function customerSignupAction(
  _previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const parsed = signupSchema.safeParse({
    name: formValue(formData, 'name'),
    email: formValue(formData, 'email'),
    phone: formValue(formData, 'phone'),
    document: formValue(formData, 'document'),
    password: formValue(formData, 'password'),
    next: formValue(formData, 'next'),
  });

  if (!parsed.success) {
    return { error: 'Revise nome, e-mail, telefone, documento e senha.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.name,
        phone: parsed.data.phone,
        document: parsed.data.document,
      },
    },
  });

  if (error || !data.user) {
    return { error: 'Não foi possível criar sua conta agora.' };
  }

  const store = await resolveCurrentStoreFromHeaders();
  await upsertCustomer({
    storeId: store.id,
    authUserId: data.user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    document: parsed.data.document,
    source: 'checkout',
  });

  if (!data.session) {
    return {
      message: 'Conta criada. Verifique seu e-mail para confirmar o acesso antes de finalizar a compra.',
    };
  }

  redirect(getSafeNextPath(parsed.data.next));
}
