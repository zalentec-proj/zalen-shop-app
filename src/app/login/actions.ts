'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

type LoginActionState = {
  error: string | null;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const invalidCredentialsState: LoginActionState = {
  error: 'E-mail ou senha inválidos.',
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
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

  redirect('/admin');
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
