import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createOptionalPublicServerClient } from '@/lib/supabase/server';
import { getOptionalStoreFromResolution, resolveStoreFromHeaders } from '@/modules/stores/store-resolution';
import type { StoreContext } from '@/modules/stores/store.types';
import { defaultPresentation, isRendererAllowed, presentationSchema } from './presentation';

const readPresentation = cache(async (id: string, name: string, slug: string) => {
  const store = { id, name, slug };
  const fallback = defaultPresentation(store);
  const client = createOptionalPublicServerClient();
  if (!client) return fallback;
  const { data, error } = await client.from('storefront_presentations').select('config').eq('store_id', store.id).maybeSingle();
  // Compatibility with the release preceding this additive migration.
  if (error || !data) return fallback;
  const parsed = presentationSchema.safeParse(data.config);
  return parsed.success && isRendererAllowed(parsed.data.renderer, store) ? parsed.data : fallback;
});

export function getPublishedPresentation(store: StoreContext) {
  return readPresentation(store.id, store.name, store.slug);
}

export const getRequestPresentation = cache(async () => {
  const path = (await headers()).get('x-zalen-request-path') ?? '/';
  if (['/platform', '/lojas', '/admin', '/login', '/auth', '/api'].some((p) => path.startsWith(p))) return null;
  const store = getOptionalStoreFromResolution(await resolveStoreFromHeaders());
  return store ? getPublishedPresentation(store) : null;
});
