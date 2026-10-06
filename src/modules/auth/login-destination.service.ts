import 'server-only';

import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { activeStore } from '@/modules/stores/current-store';
import { getOptionalStoreFromResolution, resolveStoreFromHost } from '@/modules/stores/store-resolution';
import { canAccessStore } from './auth.service';
import { getLoginRedirectTarget, getLoginRequestOrigin } from './login-navigation';

export async function getLoginNavigationContext() {
  const env = getServerEnv();
  return {
    requestOrigin: getLoginRequestOrigin(await headers(), env.APP_URL ?? 'http://localhost:3000'),
    rootDomain: env.PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br',
  };
}

export async function resolveLoginDestination(userId: string, next?: string) {
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  const destination = getLoginRedirectTarget(next, requestOrigin, activeStore.slug, rootDomain);
  const target = new URL(destination, requestOrigin);

  // Same-origin/local/preview navigation retains the existing layout/action guards.
  // A cross-host target also needs authorization here, before the browser leaves login.
  if (target.origin !== requestOrigin) {
    const store = getOptionalStoreFromResolution(await resolveStoreFromHost(target.host));
    if (!store || !(await canAccessStore(userId, store.id))) return null;
  }

  return destination;
}
