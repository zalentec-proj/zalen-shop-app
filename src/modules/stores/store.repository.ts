import 'server-only';

import { createOptionalPublicServerClient } from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import { activeStore } from './current-store';
import type { StoreContext, StoreRow } from './store.types';
import { getStoreDomainByHostname } from '@/modules/domains/domain.repository';
import type { StoreDomain } from '@/modules/domains/domain.types';

function toShortName(name: string) {
  return name
    .replace(/\s*&\s*parts$/i, '')
    .replace(/\s+shop$/i, '')
    .trim();
}

export function toStoreContext(
  row: StoreRow,
  source: StoreContext['source']
): StoreContext {
  return {
    id: row.id,
    name: row.name,
    shortName: toShortName(row.name) || row.name,
    slug: row.slug,
    status: row.status,
    storefrontPath: '/',
    source,
  };
}

export function getStaticActiveStoreContext(): StoreContext {
  return {
    id: activeStore.id,
    mockId: activeStore.mockId,
    name: activeStore.name,
    shortName: activeStore.shortName,
    slug: activeStore.slug,
    status: 'active',
    storefrontPath: activeStore.storefrontPath,
    source: 'static',
  };
}

export async function getStoreBySlugFromRepository(
  slug: string
): Promise<StoreContext | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const supabase = createOptionalPublicServerClient();

  if (!supabase) {
    return normalizedSlug === activeStore.slug
      ? getStaticActiveStoreContext()
      : null;
  }

  const { data, error } = await supabase
    .from('stores')
    .select('id, name, slug, status, created_at')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    logDevOnce('stores', 'Store lookup failed.', {
      slug: normalizedSlug,
      code: error.code,
    });

    return normalizedSlug === activeStore.slug
      ? getStaticActiveStoreContext()
      : null;
  }

  if (!data) {
    return null;
  }

  return toStoreContext(data as StoreRow, 'supabase');
}

export async function getStoreByIdFromRepository(
  storeId: string
): Promise<StoreContext | null> {
  if (!storeId) {
    return null;
  }

  if (storeId === activeStore.id) {
    return getStaticActiveStoreContext();
  }

  const supabase = createOptionalPublicServerClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('stores')
    .select('id, name, slug, status, created_at')
    .eq('id', storeId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toStoreContext(data as StoreRow, 'supabase');
}

export async function getStoreByCustomHostnameFromRepository(
  hostname: string
): Promise<{ store: StoreContext; domain: StoreDomain } | null> {
  const domain = await getStoreDomainByHostname(hostname).catch(() => null);

  if (!domain || !['active', 'redirect'].includes(domain.status)) {
    return null;
  }

  const store = await getStoreByIdFromRepository(domain.storeId);

  if (!store || store.status !== 'active') {
    return null;
  }

  return { store, domain };
}
