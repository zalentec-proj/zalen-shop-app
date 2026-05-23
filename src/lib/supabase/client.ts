/**
 * Supabase client — uso no browser (Client Components).
 * Usa @supabase/ssr para compatibilidade com Next.js App Router.
 */

import { createBrowserClient } from '@supabase/ssr';
import {
  getClientEnv,
  isSupabaseClientConfigured,
} from '@/lib/env/client';

export function createClient() {
  const env = getClientEnv();

  if (!isSupabaseClientConfigured()) {
    throw new Error('Supabase client environment is not configured.');
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export function createOptionalClient() {
  if (!isSupabaseClientConfigured()) {
    return null;
  }

  return createClient();
}

export { isSupabaseClientConfigured };
