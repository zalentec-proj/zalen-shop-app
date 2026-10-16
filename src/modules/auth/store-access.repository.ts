import 'server-only';

import { createOptionalAdminClient, createOptionalClient } from '@/lib/supabase/server';
import type { StoreRow } from '@/modules/stores/store.types';

const currentRoles = new Set(['store_owner', 'store_admin', 'store_operator', 'store_viewer']);
const legacyRoles = new Set(['owner', 'admin', 'operator', 'viewer']);

/** userId must come from verified Supabase Auth, never request input. */
export async function listUserStores(userId: string): Promise<StoreRow[]> {
  const admin = createOptionalAdminClient();
  const client = admin ?? await createOptionalClient();
  if (!client) throw new Error('Store access unavailable.');

  const current = await client.from('store_memberships')
    .select('store_id, role', { count: 'exact' }).eq('user_id', userId).limit(1000);
  if (current.error || (current.count ?? 0) > 1000) throw new Error('Store access unavailable.');

  const ids = new Set<string>((current.data ?? [])
    .filter((row) => currentRoles.has(row.role)).map((row) => row.store_id));

  // Legacy access exists only through the server client, as in getStoreMembership.
  if (admin) {
    const legacy = await admin.from('memberships')
      .select('store_id, role', { count: 'exact' }).eq('user_id', userId).limit(1000);
    if (legacy.error || (legacy.count ?? 0) > 1000) throw new Error('Store access unavailable.');
    for (const row of legacy.data ?? []) {
      if (row.store_id && legacyRoles.has(row.role)) ids.add(row.store_id);
    }
  }

  if (!ids.size) return [];
  if (ids.size > 1000) throw new Error('Store access unavailable.');
  const stores = await client.from('stores').select('id, name, slug, status')
    .in('id', [...ids]).order('name').limit(1000);
  if (stores.error) throw new Error('Store access unavailable.');
  return (stores.data ?? []) as StoreRow[];
}
