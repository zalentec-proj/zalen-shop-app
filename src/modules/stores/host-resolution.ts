export const DEFAULT_PLATFORM_ROOT_DOMAIN = 'zalenshop.com.br';
export const DEFAULT_LOCAL_STORE_ROOT_DOMAIN = 'lvh.me';

export const RESERVED_PLATFORM_SUBDOMAINS = [
  'app',
  'www',
  'api',
  'admin',
  'assets',
  'static',
  'support',
] as const;

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

type HeaderReader = {
  get(name: string): string | null;
};

function firstForwardedValue(value: string | null | undefined) {
  return value?.split(',')[0]?.trim() || undefined;
}

export function getRequestHost(
  headers: HeaderReader,
  fallback?: string | null
) {
  // On Vercel aliases, x-forwarded-host can point to the internal deployment.
  // The Host header keeps the public domain requested by the customer.
  return (
    firstForwardedValue(headers.get('host')) ??
    firstForwardedValue(headers.get('x-forwarded-host')) ??
    firstForwardedValue(fallback)
  );
}

export function normalizeHostname(value: string | null | undefined) {
  const rawHost = value?.trim().toLowerCase();

  if (!rawHost) {
    return undefined;
  }

  if (rawHost.startsWith('[')) {
    const closingBracketIndex = rawHost.indexOf(']');
    return closingBracketIndex > 0
      ? rawHost.slice(1, closingBracketIndex)
      : rawHost;
  }

  return rawHost.split(':')[0];
}

export function isLocalhostName(hostname: string | undefined) {
  return Boolean(hostname && LOCALHOST_NAMES.has(hostname));
}

export function isReservedPlatformSubdomain(slug: string | undefined) {
  return Boolean(
    slug &&
      RESERVED_PLATFORM_SUBDOMAINS.includes(
        slug as (typeof RESERVED_PLATFORM_SUBDOMAINS)[number]
      )
  );
}

export function getStoreSlugFromHostname(
  hostname: string | undefined,
  rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN
) {
  if (!hostname || isLocalhostName(hostname)) {
    return undefined;
  }

  if (hostname === DEFAULT_LOCAL_STORE_ROOT_DOMAIN) {
    return undefined;
  }

  if (hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)) {
    const slug = hostname.slice(
      0,
      -1 * (`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`.length)
    );

    return slug && !slug.includes('.') ? slug : undefined;
  }

  if (hostname === rootDomain) {
    return undefined;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    const slug = hostname.slice(0, -1 * (`.${rootDomain}`.length));

    return slug && !slug.includes('.') ? slug : undefined;
  }

  return undefined;
}

export function getPlatformAppOriginFromHost(
  currentUrl: URL,
  rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN
) {
  const hostname = normalizeHostname(currentUrl.host);

  if (
    !hostname ||
    isLocalhostName(hostname) ||
    hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)
  ) {
    return currentUrl.origin;
  }

  return `${currentUrl.protocol}//app.${rootDomain}`;
}

export function getStorefrontOriginFromHost(
  currentUrl: URL,
  storeSlug: string,
  rootDomain = DEFAULT_PLATFORM_ROOT_DOMAIN
) {
  const hostname = normalizeHostname(currentUrl.host);

  if (
    !hostname ||
    isLocalhostName(hostname) ||
    hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)
  ) {
    return currentUrl.origin;
  }

  return `${currentUrl.protocol}//${storeSlug}.${rootDomain}`;
}
