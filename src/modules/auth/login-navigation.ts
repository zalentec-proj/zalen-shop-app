import {
  DEFAULT_PLATFORM_ROOT_DOMAIN,
  getRequestHost,
  getStoreSlugFromHostname,
  isReservedPlatformSubdomain,
} from '@/modules/stores/host-resolution';
import { isPlatformPath, isStoreSelectionPath } from './operational-navigation';

type HeaderReader = { get(name: string): string | null };

export function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function getLoginRequestOrigin(headers: HeaderReader, fallback: string) {
  const host = getRequestHost(headers);
  const protocol = headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return host ? new URL(`${protocol}://${host}`).origin : new URL(fallback).origin;
}

export function getSafeLoginNextTarget(
  value: string | null | undefined,
  requestOrigin: string,
  rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN
): string {
  // Reject browser URL normalization tricks before parsing untrusted `next`.
  if (!value || /[\\\u0000-\u0020\u007f]|%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) {
    return '/admin';
  }

  try {
    const current = new URL(requestOrigin);
    const target = new URL(value, current);
    if (target.username || target.password || !['http:', 'https:'].includes(target.protocol)) {
      return '/admin';
    }

    if (value.startsWith('/') && !value.startsWith('//')) {
      return target.origin === current.origin
        ? `${target.pathname}${target.search}${target.hash}`
        : '/admin';
    }

    const isOperational = isAdminPath(target.pathname) || isPlatformPath(target.pathname) || isStoreSelectionPath(target.pathname);
    if (!/^https?:\/\//i.test(value) || !isOperational) return '/admin';
    if (target.origin === current.origin) return target.href;

    const slug = getStoreSlugFromHostname(target.hostname, rootDomain);
    const isPlatformHost = target.hostname === `app.${rootDomain}` || target.hostname === rootDomain;
    const isStoreHost = target.hostname.endsWith(`.${rootDomain}`) &&
      Boolean(slug && !isReservedPlatformSubdomain(slug));

    // Cross-origin destinations are limited to HTTPS admin hosts of this platform.
    // The server must still resolve the store and authorize the user before navigating.
    return target.protocol === 'https:' && !target.port &&
      (isPlatformHost || (isStoreHost && isAdminPath(target.pathname)))
      ? target.href
      : '/admin';
  } catch {
    return '/admin';
  }
}
