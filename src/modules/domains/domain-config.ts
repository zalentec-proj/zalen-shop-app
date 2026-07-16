import 'server-only';

import { getServerEnv } from '@/lib/env/server';

export function getDomainSelfServiceConfig() {
  const env = getServerEnv();
  const allowlist = new Set(
    (env.DOMAIN_SELF_SERVICE_STORE_ALLOWLIST ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    enabled: env.DOMAIN_SELF_SERVICE_ENABLED?.toLowerCase() === 'true',
    allowlist,
    providerConfigured: Boolean(
      env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID && env.VERCEL_TEAM_ID
    ),
  };
}

export function isDomainSelfServiceAvailable(store: {
  id: string;
  slug: string;
}) {
  const config = getDomainSelfServiceConfig();

  if (!config.enabled || !config.providerConfigured) {
    return false;
  }

  return (
    config.allowlist.size === 0 ||
    config.allowlist.has(store.id.toLowerCase()) ||
    config.allowlist.has(store.slug.toLowerCase())
  );
}
