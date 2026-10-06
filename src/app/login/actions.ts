'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';
import { resolveLoginDestination } from '@/modules/auth/login-destination.service';
import {
  isLocalhostName,
  normalizeHostname,
} from '@/modules/stores/host-resolution';

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

function getPasswordResetSentState(): FormActionState {
  return {
    status: 'success',
    message:
      'Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
  };
}

async function getAppOrigin() {
  const env = getServerEnv();
  const headerStore = await headers();
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';

  if (env.APP_URL) {
    const configuredUrl = new URL(env.APP_URL);
    const configuredHostname = normalizeHostname(configuredUrl.host);

    if (!isLocalhostName(configuredHostname)) {
      return configuredUrl.origin;
    }

    const requestHostname = normalizeHostname(host);

    if (host && !isLocalhostName(requestHostname)) {
      return `${protocol}://${host}`;
    }

    return configuredUrl.origin;
  }

  return host ? `${protocol}://${host}` : 'http://localhost:3000';
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

  let userId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      return invalidCredentialsState;
    }

    userId = data.user.id;
  } catch {
    return invalidCredentialsState;
  }

  let destination: string | null;
  try {
    destination = await resolveLoginDestination(userId, parsed.data.next);
  } catch {
    return { error: 'Não foi possível abrir o painel agora. Tente novamente.' };
  }

  if (!destination) {
    return { error: 'Sua conta não tem permissão para acessar esta loja.' };
  }

  redirect(destination);
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
