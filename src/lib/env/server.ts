import 'server-only';

import { z } from 'zod';

const optionalSecretString = z
  .string()
  .trim()
  .min(1)
  .optional();

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalSecretString,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecretString,
  SUPABASE_SECRET_KEY: optionalSecretString,
  APP_URL: z.string().trim().url().optional(),
  PLATFORM_ROOT_DOMAIN: optionalSecretString,
  AUTH_COOKIE_DOMAIN: optionalSecretString,
  BLING_CLIENT_ID: optionalSecretString,
  BLING_CLIENT_SECRET: optionalSecretString,
  BLING_REDIRECT_URI: z.string().trim().url().optional(),
  BLING_SCOPES: optionalSecretString,
  BLING_ENV: optionalSecretString,
  CRON_SECRET: optionalSecretString,
  INTERNAL_JOB_SECRET: optionalSecretString,
  RATE_LIMIT_HASH_SECRET: optionalSecretString,
  SENTRY_DSN: z.string().trim().url().optional(),
  SENTRY_ENVIRONMENT: optionalSecretString,
  INTEGRATION_TOKEN_ENCRYPTION_KEY: optionalSecretString,
  MERCADO_PAGO_ENV: z.enum(['test', 'production']).optional(),
  MERCADO_PAGO_CLIENT_ID: optionalSecretString,
  MERCADO_PAGO_CLIENT_SECRET: optionalSecretString,
  MERCADO_PAGO_REDIRECT_URI: z.string().trim().url().optional(),
  MERCADO_PAGO_ACCESS_TOKEN: optionalSecretString,
  MERCADO_PAGO_PUBLIC_KEY: optionalSecretString,
  MERCADO_PAGO_WEBHOOK_SECRET: optionalSecretString,
  MERCADO_PAGO_WEBHOOK_SECRET_TEST: optionalSecretString,
  MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION: optionalSecretString,
  MERCADO_PAGO_TEST_PAYER_EMAIL: z.string().trim().email().optional(),
  RESEND_API_KEY: optionalSecretString,
  RESEND_WEBHOOK_SECRET: optionalSecretString,
  EMAIL_DEFAULT_FROM: optionalSecretString,
  EMAIL_DEFAULT_REPLY_TO: optionalSecretString,
  MELHOR_ENVIO_TOKEN: optionalSecretString,
  SUPER_FRETE_API: optionalSecretString,
  SUPERFRETE_API_TOKEN_BRASIL_DRONES: optionalSecretString,
  SUPERFRETE_API_BASE_URL: z.string().trim().url().optional(),
  SUPERFRETE_SERVICES: optionalSecretString,
  SUPERFRETE_USER_AGENT: optionalSecretString,
  ENABLE_MANUAL_SHIPPING_FALLBACK: optionalSecretString,
  GEMINI_API_KEY: optionalSecretString,
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

const placeholderFragments = [
  '${',
  'seu-projeto',
  'sua-chave',
  'supabase_project_url',
  'supabase_publishable_key',
  'sua-service-role-key',
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

function normalizeMercadoPagoEnv(value: string | undefined) {
  const normalized = normalizeEnvValue(value)?.toLowerCase();

  if (normalized === 'test' || normalized === 'production') {
    return normalized;
  }

  return undefined;
}

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: normalizeEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: normalizeEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    SUPABASE_SECRET_KEY: normalizeEnvValue(process.env.SUPABASE_SECRET_KEY),
    SUPABASE_SERVICE_ROLE_KEY: normalizeEnvValue(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    APP_URL: normalizeEnvValue(process.env.APP_URL),
    PLATFORM_ROOT_DOMAIN: normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN),
    AUTH_COOKIE_DOMAIN: normalizeEnvValue(process.env.AUTH_COOKIE_DOMAIN),
    BLING_CLIENT_ID: normalizeEnvValue(process.env.BLING_CLIENT_ID),
    BLING_CLIENT_SECRET: normalizeEnvValue(process.env.BLING_CLIENT_SECRET),
    BLING_REDIRECT_URI: normalizeEnvValue(process.env.BLING_REDIRECT_URI),
    BLING_SCOPES: normalizeEnvValue(process.env.BLING_SCOPES),
    BLING_ENV: normalizeEnvValue(process.env.BLING_ENV),
    CRON_SECRET: normalizeEnvValue(process.env.CRON_SECRET),
    INTERNAL_JOB_SECRET: normalizeEnvValue(process.env.INTERNAL_JOB_SECRET),
    RATE_LIMIT_HASH_SECRET: normalizeEnvValue(process.env.RATE_LIMIT_HASH_SECRET),
    SENTRY_DSN: normalizeEnvValue(process.env.SENTRY_DSN),
    SENTRY_ENVIRONMENT: normalizeEnvValue(process.env.SENTRY_ENVIRONMENT),
    INTEGRATION_TOKEN_ENCRYPTION_KEY: normalizeEnvValue(
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY
    ),
    MERCADO_PAGO_ENV: normalizeMercadoPagoEnv(process.env.MERCADO_PAGO_ENV),
    MERCADO_PAGO_CLIENT_ID: normalizeEnvValue(
      process.env.MERCADO_PAGO_CLIENT_ID
    ),
    MERCADO_PAGO_CLIENT_SECRET: normalizeEnvValue(
      process.env.MERCADO_PAGO_CLIENT_SECRET
    ),
    MERCADO_PAGO_REDIRECT_URI: normalizeEnvValue(
      process.env.MERCADO_PAGO_REDIRECT_URI
    ),
    MERCADO_PAGO_ACCESS_TOKEN: normalizeEnvValue(
      process.env.MERCADO_PAGO_ACCESS_TOKEN
    ),
    MERCADO_PAGO_PUBLIC_KEY: normalizeEnvValue(
      process.env.MERCADO_PAGO_PUBLIC_KEY
    ),
    MERCADO_PAGO_WEBHOOK_SECRET: normalizeEnvValue(
      process.env.MERCADO_PAGO_WEBHOOK_SECRET
    ),
    MERCADO_PAGO_WEBHOOK_SECRET_TEST: normalizeEnvValue(
      process.env.MERCADO_PAGO_WEBHOOK_SECRET_TEST
    ),
    MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION: normalizeEnvValue(
      process.env.MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION
    ),
    MERCADO_PAGO_TEST_PAYER_EMAIL: normalizeEnvValue(
      process.env.MERCADO_PAGO_TEST_PAYER_EMAIL
    ),
    RESEND_API_KEY: normalizeEnvValue(process.env.RESEND_API_KEY),
    RESEND_WEBHOOK_SECRET: normalizeEnvValue(process.env.RESEND_WEBHOOK_SECRET),
    EMAIL_DEFAULT_FROM: normalizeEnvValue(process.env.EMAIL_DEFAULT_FROM),
    EMAIL_DEFAULT_REPLY_TO: normalizeEnvValue(
      process.env.EMAIL_DEFAULT_REPLY_TO
    ),
    MELHOR_ENVIO_TOKEN: normalizeEnvValue(process.env.MELHOR_ENVIO_TOKEN),
    SUPER_FRETE_API: normalizeEnvValue(process.env.SUPER_FRETE_API),
    SUPERFRETE_API_TOKEN_BRASIL_DRONES: normalizeEnvValue(
      process.env.SUPERFRETE_API_TOKEN_BRASIL_DRONES
    ),
    SUPERFRETE_API_BASE_URL: normalizeEnvValue(
      process.env.SUPERFRETE_API_BASE_URL
    ),
    SUPERFRETE_SERVICES: normalizeEnvValue(process.env.SUPERFRETE_SERVICES),
    SUPERFRETE_USER_AGENT: normalizeEnvValue(
      process.env.SUPERFRETE_USER_AGENT
    ),
    ENABLE_MANUAL_SHIPPING_FALLBACK: normalizeEnvValue(
      process.env.ENABLE_MANUAL_SHIPPING_FALLBACK
    ),
    GEMINI_API_KEY: normalizeEnvValue(process.env.GEMINI_API_KEY),
  });

  if (!result.success) {
    return {};
  }

  return result.data;
}

const serverEnv = parseServerEnv();

export function getServerEnv(): ServerEnv {
  return serverEnv;
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL &&
      serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL &&
      (serverEnv.SUPABASE_SERVICE_ROLE_KEY || serverEnv.SUPABASE_SECRET_KEY)
  );
}
