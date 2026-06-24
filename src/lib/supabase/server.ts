/**
 * Supabase client — uso no servidor (Server Components, Route Handlers, Server Actions).
 * Usa @supabase/ssr com cookies do Next.js.
 * NUNCA importar em Client Components.
 */

import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  getServerEnv,
  isSupabaseAdminConfigured,
  isSupabaseServerConfigured,
} from '@/lib/env/server';

export async function createClient() {
  const env = getServerEnv();

  if (!isSupabaseServerConfigured()) {
    throw new Error('Supabase server environment is not configured.');
  }

  const cookieStore = await cookies();
  const cookieOptions = env.AUTH_COOKIE_DOMAIN
    ? { domain: env.AUTH_COOKIE_DOMAIN }
    : undefined;

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies só podem ser setados em Route Handlers/Actions
          }
        },
      },
    }
  );
}

export async function createOptionalClient() {
  if (!isSupabaseServerConfigured()) {
    return null;
  }

  return createClient();
}

export function createPublicServerClient() {
  const env = getServerEnv();

  if (!isSupabaseServerConfigured()) {
    throw new Error('Supabase server environment is not configured.');
  }

  return createSupabaseJsClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createOptionalPublicServerClient() {
  if (!isSupabaseServerConfigured()) {
    return null;
  }

  return createPublicServerClient();
}

export function createAdminClient() {
  const env = getServerEnv();

  if (!isSupabaseAdminConfigured()) {
    throw new Error('Supabase admin environment is not configured.');
  }

  return createSupabaseJsClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    (env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY)!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createOptionalAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  return createAdminClient();
}

export { isSupabaseAdminConfigured, isSupabaseServerConfigured };
