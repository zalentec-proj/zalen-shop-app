import { DEFAULT_PLATFORM_ROOT_DOMAIN } from '@/modules/stores/host-resolution';

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

export function getAuthCookieDomain() {
  const explicitDomain = normalizeEnvValue(process.env.AUTH_COOKIE_DOMAIN);

  if (explicitDomain) {
    return explicitDomain;
  }

  if (normalizeEnvValue(process.env.VERCEL_ENV) !== 'production') {
    return undefined;
  }

  return formatCookieDomain(
    normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN) ??
      DEFAULT_PLATFORM_ROOT_DOMAIN
  );
}
