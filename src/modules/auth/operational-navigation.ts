import {
  DEFAULT_LOCAL_STORE_ROOT_DOMAIN,
  DEFAULT_PLATFORM_ROOT_DOMAIN,
  isLocalhostName,
  isReservedPlatformSubdomain,
  normalizeHostname,
} from '@/modules/stores/host-resolution';

export function isPlatformPath(path: string) {
  return path === '/platform' || path.startsWith('/platform/');
}

export function isStoreSelectionPath(path: string) {
  return path === '/lojas';
}

export function getPlatformOrigin(requestOrigin: string, rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN) {
  const url = new URL(requestOrigin);
  const host = normalizeHostname(url.host);
  if (isLocalhostName(host) || host?.endsWith('.lvh.me') || host?.endsWith('.vercel.app')) return url.origin;
  return `https://app.${rootDomain}`;
}

export function isCentralAppOrigin(requestOrigin: string, rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN) {
  const host = new URL(requestOrigin).hostname;
  return host === rootDomain || host === `app.${rootDomain}` || host === 'app.lvh.me';
}

export function getStoreAdminUrl(slug: string, requestOrigin: string, rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN, path = '/admin') {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || isReservedPlatformSubdomain(slug) ||
      !/^\/admin(?:[/?#]|$)/.test(path)) return null;
  const url = new URL(requestOrigin);
  const hostname = normalizeHostname(url.host);
  const isLocal = isLocalhostName(hostname) || hostname === 'lvh.me' || hostname?.endsWith('.lvh.me');
  const origin = isLocal
    ? `${url.protocol}//${slug}.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}${url.port ? `:${url.port}` : ''}`
    : `https://${slug}.${rootDomain}`;
  const destination = new URL(path, origin);
  return destination.origin === origin && /^\/admin(?:\/|$)/.test(destination.pathname) ? destination.href : null;
}
