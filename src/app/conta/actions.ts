'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createOptionalClient } from '@/lib/supabase/server';
import { isValidCnpj, onlyDigits } from '@/modules/customers/br-document';
import { CustomerPersistenceError } from '@/modules/customers/customer.repository';
import {
  findCustomerByAuthUserId,
  upsertCustomer,
} from '@/modules/customers/customer.service';
import {
  requestCustomerLoginCode,
  verifyCustomerLoginCode,
} from '@/modules/customer-account/customer-auth.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { getRateLimitErrorMessage } from '@/modules/security/rate-limit.service';
import {
  confirmCustomerWhatsAppVerification,
  requestCustomerWhatsAppVerification,
} from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';

export type WhatsAppContactState = { step?: 'phone' | 'code'; phone?: string; error?: string; message?: string };

export type CustomerAuthState = {
  step: 'email' | 'code';
  email?: string;
  next?: string;
  error?: string;
  message?: string;
  registration?: {
    mode: 'login' | 'signup';
    customerType: 'pf' | 'pj';
    name?: string;
    document?: string;
    legalName?: string;
    stateRegistration?: string;
    stateRegistrationExempt?: boolean;
  };
};

export type BusinessProfileState = {
  ok?: boolean;
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

const registrationSchema = z
  .object({
    mode: z.enum(['login', 'signup']),
    customerType: z.enum(['pf', 'pj']).default('pf'),
    name: z.string().trim().optional(),
    document: z.string().trim().optional(),
    legalName: z.string().trim().optional(),
    stateRegistration: z.string().trim().optional(),
    stateRegistrationExempt: z.boolean().default(false),
  })
  .superRefine((registration, context) => {
    if (
      registration.mode !== 'signup' ||
      registration.customerType !== 'pj'
    ) {
      return;
    }

    if (!registration.name || registration.name.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Informe o nome do responsável.',
      });
    }

    if (!isValidCnpj(registration.document)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document'],
        message: 'Informe um CNPJ válido.',
      });
    }

    if (!registration.legalName || registration.legalName.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['legalName'],
        message: 'Informe a razão social.',
      });
    }

    if (
      !registration.stateRegistrationExempt &&
      !registration.stateRegistration
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateRegistration'],
        message: 'Informe a inscrição estadual ou marque isento.',
      });
    }
  });

const businessProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome do responsável.'),
    document: z
      .string()
      .trim()
      .refine(isValidCnpj, 'Informe um CNPJ válido.'),
    legalName: z.string().trim().min(2, 'Informe a razão social.'),
    stateRegistration: z.string().trim().optional(),
    stateRegistrationExempt: z.boolean().default(false),
  })
  .superRefine((profile, context) => {
    if (!profile.stateRegistrationExempt && !profile.stateRegistration) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateRegistration'],
        message: 'Informe a inscrição estadual ou marque isento.',
      });
    }
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

function parseRegistration(
  formData: FormData,
  previousState: CustomerAuthState
) {
  return registrationSchema.safeParse({
    mode: formValue(formData, 'mode') || previousState.registration?.mode || 'login',
    customerType:
      formValue(formData, 'customerType') ||
      previousState.registration?.customerType ||
      'pf',
    name: formValue(formData, 'name') || previousState.registration?.name,
    document:
      formValue(formData, 'document') || previousState.registration?.document,
    legalName:
      formValue(formData, 'legalName') || previousState.registration?.legalName,
    stateRegistration:
      formValue(formData, 'stateRegistration') ||
      previousState.registration?.stateRegistration,
    stateRegistrationExempt:
      formData.get('stateRegistrationExempt') === 'on' ||
      previousState.registration?.stateRegistrationExempt === true,
  });
}

export async function customerOtpAction(
  previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const intent = formValue(formData, 'intent');
  const next = getSafeNextPath(formValue(formData, 'next') || previousState.next);
  const registration = parseRegistration(formData, previousState);

  if (!registration.success) {
    return {
      step: intent === 'verify' ? 'code' : 'email',
      email: previousState.email,
      next,
      error:
        registration.error.issues[0]?.message ??
        'Revise os dados do cadastro empresarial.',
    };
  }

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
        registration: registration.data,
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
        registration: registration.data,
        error: 'Código inválido ou expirado. Solicite um novo código.',
      };
    }

    if (
      registration.data.mode === 'signup' &&
      registration.data.customerType === 'pj'
    ) {
      try {
        await upsertCustomer({
          storeId: store.id,
          authUserId: result.authUserId,
          name: registration.data.name ?? 'Cliente',
          email: result.email,
          document: onlyDigits(registration.data.document),
          customerType: 'pj',
          legalName: registration.data.legalName,
          stateRegistration: registration.data.stateRegistrationExempt
            ? undefined
            : registration.data.stateRegistration,
          stateRegistrationExempt:
            registration.data.stateRegistrationExempt,
          source: 'manual',
        });
      } catch (error) {
        if (error instanceof CustomerPersistenceError) {
          return {
            step: 'code',
            email: parsed.data.email,
            next,
            registration: registration.data,
            error:
              'Não foi possível concluir este cadastro. Entre com o e-mail já vinculado aos dados informados.',
          };
        }

        throw error;
      }
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
      registration: registration.data,
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
  } catch (error) {
    return {
      step: 'email',
      next,
      registration: registration.data,
      error: getRateLimitErrorMessage(error),
    };
  }

  return {
    step: 'code',
    email: parsed.data.email.trim().toLowerCase(),
    next,
    registration: {
      ...registration.data,
      document: registration.data.document
        ? onlyDigits(registration.data.document)
        : undefined,
    },
    message: 'Enviamos um código de acesso para o seu e-mail.',
  };
}

export async function customerSignOutAction() {
  const supabase = await createOptionalClient();

  if (supabase) {
    await supabase.auth.signOut({ scope: 'global' });
  }

  redirect('/conta/entrar');
}

export async function updateBusinessProfileAction(
  _previousState: BusinessProfileState,
  formData: FormData
): Promise<BusinessProfileState> {
  const parsed = businessProfileSchema.safeParse({
    name: formValue(formData, 'name'),
    document: formValue(formData, 'document'),
    legalName: formValue(formData, 'legalName'),
    stateRegistration: formValue(formData, 'stateRegistration') || undefined,
    stateRegistrationExempt:
      formData.get('stateRegistrationExempt') === 'on',
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        'Revise os dados da empresa.',
    };
  }

  const supabase = await createOptionalClient();
  const { data, error } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: new Error('auth_unavailable') };

  if (error || !data.user) {
    return {
      ok: false,
      error: 'Sua sessão expirou. Entre novamente para atualizar os dados.',
    };
  }

  const store = await resolveCurrentStoreFromHeaders();
  const customer = await findCustomerByAuthUserId({
    storeId: store.id,
    authUserId: data.user.id,
  });

  if (!customer) {
    return {
      ok: false,
      error: 'Não foi possível localizar sua conta nesta loja.',
    };
  }

  try {
    await upsertCustomer({
      storeId: store.id,
      authUserId: data.user.id,
      name: parsed.data.name,
      email: data.user.email ?? customer.email,
      phone: customer.phone,
      document: onlyDigits(parsed.data.document),
      customerType: 'pj',
      legalName: parsed.data.legalName,
      stateRegistration: parsed.data.stateRegistrationExempt
        ? undefined
        : parsed.data.stateRegistration,
      stateRegistrationExempt: parsed.data.stateRegistrationExempt,
      source: customer.source,
      acceptsMarketing: customer.acceptsMarketing,
      notes: customer.notes,
    });
  } catch (caughtError) {
    if (caughtError instanceof CustomerPersistenceError) {
      return {
        ok: false,
        error:
          'Não foi possível salvar este CNPJ. Verifique se ele já está vinculado a outra conta.',
      };
    }

    throw caughtError;
  }

  revalidatePath('/conta');
  revalidatePath('/carrinho');

  return {
    ok: true,
    message: 'Dados empresariais atualizados. O benefício PJ já pode ser recalculado.',
  };
}

export async function updateWhatsAppContactAction(_previousState: WhatsAppContactState, formData: FormData): Promise<WhatsAppContactState> {
  const supabase = await createOptionalClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) return { error: 'Entre novamente para atualizar seu WhatsApp.' };
  const store = await resolveCurrentStoreFromHeaders();
  const customer = await findCustomerByAuthUserId({ storeId: store.id, authUserId: data.user.id });
  if (!customer) return { error: 'Não foi possível localizar sua conta nesta loja.' };
  const phone = formValue(formData, 'phone');
  const optedIn = formData.get('optedIn') === 'on';
  const intent = formValue(formData, 'intent');
  try {
    if (intent === 'confirm') {
      await confirmCustomerWhatsAppVerification({ storeId: store.id, customerId: customer.id, phone, code: formValue(formData, 'code'), optedIn });
      revalidatePath('/conta');
      return { step: 'phone', phone, message: 'WhatsApp confirmado. Você pode desativar as mensagens a qualquer momento.' };
    }
    await requestCustomerWhatsAppVerification({ storeId: store.id, customerId: customer.id, phone, storeName: store.shortName });
    return { step: 'code', phone, message: 'Enviamos um código para seu WhatsApp.' };
  } catch (error) {
    return { step: intent === 'confirm' ? 'code' : 'phone', phone, error: error instanceof Error && error.message === 'invalid_whatsapp_phone' ? 'Informe um telefone WhatsApp válido.' : 'Não foi possível confirmar este WhatsApp agora.' };
  }
}
