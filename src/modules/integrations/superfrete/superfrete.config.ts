import 'server-only';

import { getServerEnv } from '@/lib/env/server';

export const SUPERFRETE_PROVIDER_KEY = 'superfrete';

const DEFAULT_BASE_URL = 'https://sandbox.superfrete.com';
const DEFAULT_SERVICES = '1,2,3,17';
const DEFAULT_USER_AGENT = 'ZalenShop/1.0 (integracao@zalenshop.com.br)';

function normalizeServices(value: string | undefined) {
  const normalized = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');

  return normalized || DEFAULT_SERVICES;
}

export function getSuperFreteQuoteConfig() {
  const env = getServerEnv();

  return {
    token: env.SUPERFRETE_API_TOKEN_BRASIL_DRONES ?? env.SUPER_FRETE_API,
    baseUrl: env.SUPERFRETE_API_BASE_URL ?? DEFAULT_BASE_URL,
    services: normalizeServices(env.SUPERFRETE_SERVICES),
    userAgent: env.SUPERFRETE_USER_AGENT ?? DEFAULT_USER_AGENT,
  };
}

export function isManualShippingFallbackEnabled() {
  return getServerEnv().ENABLE_MANUAL_SHIPPING_FALLBACK === 'true';
}
