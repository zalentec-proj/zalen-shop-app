import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { StoreRow } from '@/modules/stores/store.types';
import { requirePlatformAccess } from './platform-access';

export const PLATFORM_STORES_PAGE_SIZE = 25;

export function parseStoreListQuery(query?: unknown, page?: unknown) {
  const requestedPage = typeof page === 'string' ? Number(page) : NaN;
  return {
    query: typeof query === 'string' ? query.trim().slice(0, 80) : '',
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1,
  };
}

export async function listPlatformStores(query?: string, page?: string) {
  await requirePlatformAccess();
  const input = parseStoreListQuery(query, page);
  const unavailable = { ...input, stores: [] as StoreRow[], total: 0, available: false };
  const client = createOptionalAdminClient();
  if (!client) return unavailable;

  try {
    let request = client.from('stores').select('id, name, slug, status, created_at', { count: 'exact' });
    if (input.query) request = request.ilike('name', `%${input.query.replace(/[\\%_]/g, '\\$&')}%`);
    const from = (input.page - 1) * PLATFORM_STORES_PAGE_SIZE;
    const { data, count, error } = await request.order('name').order('id')
      .range(from, from + PLATFORM_STORES_PAGE_SIZE - 1);
    if (error || !data || count === null) return unavailable;
    return { ...input, stores: data as StoreRow[], total: count, available: true };
  } catch {
    return unavailable;
  }
}
