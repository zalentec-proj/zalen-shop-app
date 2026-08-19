import {
  DEFAULT_PLATFORM_ROOT_DOMAIN,
  normalizeHostname,
} from '@/modules/stores/host-resolution';

const placeholderFragments = [
  '${',
  'seu-projeto',
  'sua-chave',
  'supabase_project_url',
  'supabase_publishable_key',
];

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  if (placeholderFragments.some((placeholder) => normalized.includes(placeholder))) {
    return undefined;
  }

  return normalized;
}

function formatCookieDomain(rootDomain: string | undefined) {
  if (!rootDomain) {
    return undefined;
  }

  const normalized = rootDomain.startsWith('.') ? rootDomain : `.${rootDomain}`;

  if (
    normalized.includes('localhost') ||
    normalized.includes('lvh.me') ||
    normalized.includes('vercel.app')
  ) {
    return undefined;
  }

  return normalized;
}

export function getAuthCookieDomain(requestHost?: string | null) {
  const explicitDomain = normalizeEnvValue(process.env.AUTH_COOKIE_DOMAIN);
  const cookieDomain = explicitDomain
    ? formatCookieDomain(explicitDomain)
    : normalizeEnvValue(process.env.VERCEL_ENV) === 'production'
      ? formatCookieDomain(
          normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN) ??
            DEFAULT_PLATFORM_ROOT_DOMAIN
        )
      : undefined;

  if (!cookieDomain || !requestHost) {
    return cookieDomain;
  }

  const hostname = normalizeHostname(requestHost);
  const normalizedCookieDomain = cookieDomain.replace(/^\./, '');

  return hostname === normalizedCookieDomain ||
    hostname?.endsWith(`.${normalizedCookieDomain}`)
    ? cookieDomain
    : undefined;
}
