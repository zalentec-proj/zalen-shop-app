'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  requestCustomerLoginCode,
  verifyCustomerLoginCode,
} from '@/modules/customer-account/customer-auth.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

export type CustomerAuthState = {
  step: 'email' | 'code';
  email?: string;
  next?: string;
  error?: string;
  message?: string;
};

const emailSchema = z.object({
  email: z.string().trim().email(),
  next: z.string().optional(),
});

const codeSchema = emailSchema.extend({
  token: z.string().trim().min(4).max(12),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/conta';
  }

  if (value.startsWith('/admin') || value.startsWith('/platform')) {
    return '/conta';
  }

  return value;
}

async function getBaseUrl() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get('origin') ??
    process.env.APP_URL ??
    'http://localhost:3000'
  );
}

export async function customerOtpAction(
  previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const intent = formValue(formData, 'intent');
  const next = getSafeNextPath(formValue(formData, 'next') || previousState.next);

  if (intent === 'verify') {
    const parsed = codeSchema.safeParse({
      email: formValue(formData, 'email') || previousState.email,
      token: formValue(formData, 'token'),
      next,
    });

    if (!parsed.success) {
      return {
        step: 'code',
        email: previousState.email,
        next,
        error: 'Informe o código recebido por e-mail.',
      };
    }

    const store = await resolveCurrentStoreFromHeaders();
    const result = await verifyCustomerLoginCode({
      storeId: store.id,
      email: parsed.data.email,
      token: parsed.data.token,
    });

    if (!result.ok) {
      return {
        step: 'code',
        email: parsed.data.email,
        next,
        error: 'Código inválido ou expirado. Solicite um novo código.',
      };
    }

    redirect(next);
  }

  const parsed = emailSchema.safeParse({
    email: formValue(formData, 'email'),
    next,
  });

  if (!parsed.success) {
    return {
      step: 'email',
      next,
      error: 'Informe um e-mail válido.',
    };
  }

  try {
    const store = await resolveCurrentStoreFromHeaders();
    await requestCustomerLoginCode({
      storeId: store.id,
      storeName: store.name,
      email: parsed.data.email,
      baseUrl: await getBaseUrl(),
      next,
    });
  } catch {
    return {
      step: 'email',
      next,
      error: 'Não foi possível enviar o código agora. Tente novamente em instantes.',
    };
  }

  return {
    step: 'code',
    email: parsed.data.email.trim().toLowerCase(),
    next,
    message: 'Enviamos um código de acesso para o seu e-mail.',
  };
}
