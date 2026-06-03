'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';

type LoginActionState = {
  error: string | null;
};

type FormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  next: z.preprocess(
    (value) => (typeof value === 'string' ? value : undefined),
    z.string().optional()
  ),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const updatePasswordSchema = z
  .object({
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  });

const invalidCredentialsState: LoginActionState = {
  error: 'E-mail ou senha inválidos.',
};

function formError(message: string): FormActionState {
  return {
    status: 'error',
    message,
  };
}

function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/admin';
  }

  return value;
}

function getPasswordResetSentState(): FormActionState {
  return {
    status: 'success',
    message:
      'Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
  };
}

async function getAppOrigin() {
  const env = getServerEnv();

  if (env.APP_URL) {
    return env.APP_URL;
  }

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return 'http://localhost:3000';
  }

  return `${protocol}://${host}`;
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return invalidCredentialsState;
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return invalidCredentialsState;
    }
  } catch {
    return invalidCredentialsState;
  }

  redirect(getSafeNextPath(parsed.data.next));
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // If Supabase is not configured, the desired final state is still logged out.
  }

  redirect('/login');
}

export async function requestPasswordResetAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return formError('Informe um e-mail válido.');
  }

  try {
    const supabase = await createClient();
    const origin = await getAppOrigin();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/login/update-password`,
    });
  } catch {
    return getPasswordResetSentState();
  }

  return getPasswordResetSentState();
}

export async function updatePasswordAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    return formError('A senha deve ter pelo menos 8 caracteres e ser confirmada corretamente.');
  }

  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data.user) {
      return formError('Link expirado ou sessão ausente. Solicite um novo link.');
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return formError('Não foi possível atualizar a senha agora.');
    }
  } catch {
    return formError('Não foi possível atualizar a senha agora.');
  }

  redirect('/admin');
}
