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
  BLING_CLIENT_ID: optionalSecretString,
  BLING_CLIENT_SECRET: optionalSecretString,
  BLING_REDIRECT_URI: z.string().trim().url().optional(),
  BLING_SCOPES: optionalSecretString,
  BLING_ENV: optionalSecretString,
  INTEGRATION_TOKEN_ENCRYPTION_KEY: optionalSecretString,
  MERCADO_PAGO_ENV: z.enum(['test', 'production']).optional(),
  MERCADO_PAGO_ACCESS_TOKEN: optionalSecretString,
  MERCADO_PAGO_PUBLIC_KEY: optionalSecretString,
  MERCADO_PAGO_WEBHOOK_SECRET: optionalSecretString,
  MELHOR_ENVIO_TOKEN: optionalSecretString,
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
    BLING_CLIENT_ID: normalizeEnvValue(process.env.BLING_CLIENT_ID),
    BLING_CLIENT_SECRET: normalizeEnvValue(process.env.BLING_CLIENT_SECRET),
    BLING_REDIRECT_URI: normalizeEnvValue(process.env.BLING_REDIRECT_URI),
    BLING_SCOPES: normalizeEnvValue(process.env.BLING_SCOPES),
    BLING_ENV: normalizeEnvValue(process.env.BLING_ENV),
    INTEGRATION_TOKEN_ENCRYPTION_KEY: normalizeEnvValue(
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY
    ),
    MERCADO_PAGO_ENV: normalizeMercadoPagoEnv(process.env.MERCADO_PAGO_ENV),
    MERCADO_PAGO_ACCESS_TOKEN: normalizeEnvValue(
      process.env.MERCADO_PAGO_ACCESS_TOKEN
    ),
    MERCADO_PAGO_PUBLIC_KEY: normalizeEnvValue(
      process.env.MERCADO_PAGO_PUBLIC_KEY
    ),
    MERCADO_PAGO_WEBHOOK_SECRET: normalizeEnvValue(
      process.env.MERCADO_PAGO_WEBHOOK_SECRET
    ),
    MELHOR_ENVIO_TOKEN: normalizeEnvValue(process.env.MELHOR_ENVIO_TOKEN),
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
