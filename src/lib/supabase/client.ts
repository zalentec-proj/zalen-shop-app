/**
 * Supabase client — uso no browser (Client Components).
 * Usa @supabase/ssr para compatibilidade com Next.js App Router.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
