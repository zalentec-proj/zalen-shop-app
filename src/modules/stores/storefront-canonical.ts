import 'server-only';

import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCurrentStorefrontOrigin, resolveStoreFromHost } from './store-resolution';
import {
  getRequestHost,
  isLocalhostName,
  normalizeHostname,
} from './host-resolution';

const excludedPrefixes = [
  '/admin',
  '/login',
  '/api',
  '/auth',
  '/.well-known',
];

export async function enforceCanonicalStorefrontHost() {
  const headerStore = await headers();
  const requestPath = headerStore.get('x-zalen-request-path');

  if (
    !requestPath ||
    excludedPrefixes.some((prefix) => requestPath.startsWith(prefix))
  ) {
    return;
  }

  const host = getRequestHost(headerStore);
  const hostname = normalizeHostname(host);
  if (!hostname || isLocalhostName(hostname) || hostname.endsWith('.lvh.me')) {
    return;
  }

  const resolution = await resolveStoreFromHost(host);
  if (resolution.kind === 'not_found') notFound();
  if (resolution.kind !== 'store') return;

  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  const currentOrigin = `${protocol}://${host}`;
  const canonicalOrigin = await getCurrentStorefrontOrigin(resolution.store);

  if (new URL(currentOrigin).origin !== new URL(canonicalOrigin).origin) {
    permanentRedirect(new URL(requestPath, canonicalOrigin).toString());
  }
}
