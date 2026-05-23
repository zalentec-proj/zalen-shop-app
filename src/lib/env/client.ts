import { z } from 'zod';

const optionalPublicString = z
  .string()
  .trim()
  .min(1)
  .optional();

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPublicString,
});

type ClientEnv = z.infer<typeof clientEnvSchema>;

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

function parseClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: normalizeEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: normalizeEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
  });

  if (!result.success) {
    return {};
  }

  return result.data;
}

const clientEnv = parseClientEnv();

export function getClientEnv(): ClientEnv {
  return clientEnv;
}

export function isSupabaseClientConfigured(): boolean {
  return Boolean(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL &&
      clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
