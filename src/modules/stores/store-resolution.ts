import 'server-only';

import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import {
  getStoreSlugFromHostname,
  getStorefrontOriginFromHost,
  getRequestHost,
  isLocalhostName,
  isReservedPlatformSubdomain,
  normalizeHostname,
} from './host-resolution';
import {
  getStaticActiveStoreContext,
  getStoreByCustomHostnameFromRepository,
  getStoreBySlugFromRepository,
} from './store.repository';
import type { StoreContext } from './store.types';
import { getActivePrimaryStoreDomain } from '@/modules/domains/domain.repository';
import type { StoreDomain } from '@/modules/domains/domain.types';

export type StoreResolution =
  | {
      kind: 'store';
      host?: string;
      slug: string;
      store: StoreContext;
      domain?: StoreDomain;
    }
  | {
      kind: 'fallback';
      host?: string;
      store: StoreContext;
    }
  | {
      kind: 'reserved';
      host?: string;
      slug: string;
      store: StoreContext;
    }
  | {
      kind: 'not_found';
      host?: string;
      slug?: string;
      store: StoreContext;
    };

export class StoreNotFoundError extends Error {
  constructor(
    resolution: Extract<StoreResolution, { kind: 'not_found' | 'reserved' }>
  ) {
    super(`Store not found for host ${resolution.host ?? 'unknown'}.`);
    this.name = 'StoreNotFoundError';
  }
}

function getRootDomain() {
  return getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
}

function getOriginFromHeaders(
  headerStore: Awaited<ReturnType<typeof headers>>
) {
  const origin = headerStore.get('origin');

  if (origin) {
    return origin;
  }

  const host = getRequestHost(headerStore);
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';

  if (host) {
    return `${protocol}://${host}`;
  }

  return getServerEnv().APP_URL ?? 'http://localhost:3000';
}

export async function getCurrentStorefrontOrigin(store: Pick<StoreContext, 'slug'>) {
  const headerStore = await headers();
  const currentOrigin = getOriginFromHeaders(headerStore);

  try {
    const currentUrl = new URL(currentOrigin);
    const hostname = normalizeHostname(currentUrl.host);

    if (
      hostname &&
      !isLocalhostName(hostname) &&
      !hostname.endsWith('.lvh.me')
    ) {
      const fullStore = await getStoreBySlugFromRepository(store.slug);
      const primary = fullStore
        ? await getActivePrimaryStoreDomain(fullStore.id).catch(() => null)
        : null;

      if (primary) {
        return `https://${primary.hostname}`;
      }
    }

    return getStorefrontOriginFromHost(
      currentUrl,
      store.slug,
      getRootDomain()
    );
  } catch {
    return getServerEnv().APP_URL ?? 'http://localhost:3000';
  }
}

export function getStoreFromResolution(resolution: StoreResolution) {
  if (resolution.kind === 'not_found' || resolution.kind === 'reserved') {
    throw new StoreNotFoundError(resolution);
  }

  return resolution.store;
}

export function getOptionalStoreFromResolution(resolution: StoreResolution) {
  return resolution.kind === 'not_found' || resolution.kind === 'reserved'
    ? null
    : resolution.store;
}

export async function resolveStoreFromHost(
  host: string | null | undefined
): Promise<StoreResolution> {
  const hostname = normalizeHostname(host);
  const fallbackStore = getStaticActiveStoreContext();
  const slug = getStoreSlugFromHostname(hostname, getRootDomain());

  if (!slug) {
    if (
      !hostname ||
      isLocalhostName(hostname) ||
      hostname === 'lvh.me'
    ) {
      return {
        kind: 'fallback',
        host: hostname,
        store: fallbackStore,
      };
    }

    if (
      hostname === getRootDomain() ||
      hostname.endsWith(`.${getRootDomain()}`)
    ) {
      return {
        kind: 'reserved',
        host: hostname,
        slug: hostname === getRootDomain()
          ? '@'
          : hostname.slice(0, -1 * (`.${getRootDomain()}`.length)),
        store: fallbackStore,
      };
    }

    const custom = await getStoreByCustomHostnameFromRepository(hostname);

    if (custom) {
      return {
        kind: 'store',
        host: hostname,
        slug: custom.store.slug,
        store: custom.store,
        domain: custom.domain,
      };
    }

    return {
      kind: 'not_found',
      host: hostname,
      slug: hostname,
      store: fallbackStore,
    };
  }

  if (isReservedPlatformSubdomain(slug)) {
    return {
      kind: 'reserved',
      host: hostname,
      slug,
      store: fallbackStore,
    };
  }

  const store = await getStoreBySlugFromRepository(slug);

  if (store?.status === 'active') {
    return {
      kind: 'store',
      host: hostname,
      slug,
      store,
    };
  }

  return {
    kind: 'not_found',
    host: hostname,
    slug,
    store: fallbackStore,
  };
}

export async function resolveStoreFromHeaders() {
  const headerStore = await headers();
  return resolveStoreFromHost(getRequestHost(headerStore));
}

export async function resolveCurrentStoreFromHeaders() {
  const resolution = await resolveStoreFromHeaders();
  return getStoreFromResolution(resolution);
}

export async function resolveStoreFromRequest(request: Request | NextRequest) {
  return resolveStoreFromHost(
    getRequestHost(request.headers, new URL(request.url).host)
  );
}

export async function resolveCurrentStoreFromRequest(
  request: Request | NextRequest
) {
  const resolution = await resolveStoreFromRequest(request);
  return getStoreFromResolution(resolution);
}
