import 'server-only';

import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import {
  getStoreSlugFromHostname,
  getStorefrontOriginFromHost,
  isReservedPlatformSubdomain,
  normalizeHostname,
} from './host-resolution';
import {
  getStaticActiveStoreContext,
  getStoreBySlugFromRepository,
} from './store.repository';
import type { StoreContext } from './store.types';

export type StoreResolution =
  | {
      kind: 'store';
      host?: string;
      slug: string;
      store: StoreContext;
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
  constructor(resolution: Extract<StoreResolution, { kind: 'not_found' }>) {
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

  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
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
    return getStorefrontOriginFromHost(
      new URL(currentOrigin),
      store.slug,
      getRootDomain()
    );
  } catch {
    return getServerEnv().APP_URL ?? 'http://localhost:3000';
  }
}

export function getStoreFromResolution(resolution: StoreResolution) {
  if (resolution.kind === 'not_found') {
    throw new StoreNotFoundError(resolution);
  }

  return resolution.store;
}

export function getOptionalStoreFromResolution(resolution: StoreResolution) {
  return resolution.kind === 'not_found' ? null : resolution.store;
}

export async function resolveStoreFromHost(
  host: string | null | undefined
): Promise<StoreResolution> {
  const hostname = normalizeHostname(host);
  const fallbackStore = getStaticActiveStoreContext();
  const slug = getStoreSlugFromHostname(hostname, getRootDomain());

  if (!slug) {
    return {
      kind: 'fallback',
      host: hostname,
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
  return resolveStoreFromHost(
    headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  );
}

export async function resolveCurrentStoreFromHeaders() {
  const resolution = await resolveStoreFromHeaders();
  return getStoreFromResolution(resolution);
}

export async function resolveStoreFromRequest(request: Request | NextRequest) {
  return resolveStoreFromHost(
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      new URL(request.url).host
  );
}

export async function resolveCurrentStoreFromRequest(
  request: Request | NextRequest
) {
  const resolution = await resolveStoreFromRequest(request);
  return getStoreFromResolution(resolution);
}
