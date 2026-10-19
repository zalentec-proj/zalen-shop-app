import 'server-only';

import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { getOptionalStoreFromResolution, resolveAdminStoreFromHost } from '@/modules/stores/store-resolution';
import { canAccessStore, getPlatformRole } from './auth.service';
import { listUserStores } from './store-access.repository';
import { getLoginRequestOrigin, getSafeLoginNextTarget, isAdminPath } from './login-navigation';
import { getPlatformOrigin, getStoreAdminUrl, isCentralAppOrigin, isPlatformPath, isStoreSelectionPath } from './operational-navigation';

export async function getLoginNavigationContext() {
  const env = getServerEnv();
  return {
    requestOrigin: getLoginRequestOrigin(await headers(), env.APP_URL ?? 'http://localhost:3000'),
    rootDomain: env.PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br',
  };
}

export async function resolveLoginDestination(userId: string, next?: string) {
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  const safeNext = getSafeLoginNextTarget(next, requestOrigin, rootDomain);
  const target = new URL(safeNext, requestOrigin);
  const platformOrigin = getPlatformOrigin(requestOrigin, rootDomain);
  const platformRole = await getPlatformRole(userId);
  const localPath = `${target.pathname}${target.search}${target.hash}`;

  if (isPlatformPath(target.pathname)) {
    return platformRole ? new URL(localPath, platformOrigin).href : null;
  }
  if (isStoreSelectionPath(target.pathname)) return new URL(localPath, platformOrigin).href;

  // A specific store always wins over the default role destination, with the
  // same authorization for relative, local and cross-host destinations.
  const specificAdmin = isAdminPath(target.pathname) &&
    !isCentralAppOrigin(target.origin, rootDomain) && typeof next === 'string' && Boolean(next.trim());
  if (specificAdmin) {
    const store = getOptionalStoreFromResolution(await resolveAdminStoreFromHost(target.host, userId));
    if (!store || !(await canAccessStore(userId, store.id))) return null;
    return target.origin === requestOrigin ? localPath : target.href;
  }

  if (platformRole) return new URL('/platform', platformOrigin).href;

  const stores = (await listUserStores(userId)).filter((store) => ['active', 'planned'].includes(store.status));
  if (stores.length === 1) {
    return getStoreAdminUrl(stores[0].slug, requestOrigin, rootDomain,
      isAdminPath(target.pathname) ? localPath : '/admin');
  }

  const selection = new URL('/lojas', platformOrigin);
  if (isAdminPath(target.pathname) && localPath !== '/admin') selection.searchParams.set('next', localPath);
  return selection.href;
}
