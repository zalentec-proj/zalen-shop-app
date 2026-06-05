import 'server-only';

import { logDevOnce } from '@/lib/logging/dev';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  IntegrationProvider,
  IntegrationProviderCategory,
  IntegrationProviderStatus,
  IntegrationRepositoryResult,
} from './integration-provider.types';

type ProviderRow = {
  id: string;
  key: string;
  name: string;
  category: string;
  status: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RepositoryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const providerCategories: IntegrationProviderCategory[] = [
  'erp',
  'payment',
  'shipping',
  'sales_channel',
  'ai',
  'analytics',
];

const providerStatuses: IntegrationProviderStatus[] = [
  'planned',
  'beta',
  'available',
  'deprecated',
];

const fallbackDate = new Date(0).toISOString();

export const mockIntegrationProviders: IntegrationProvider[] = [
  {
    id: 'provider-bling',
    key: 'bling',
    name: 'Bling',
    category: 'erp',
    status: 'planned',
    description: 'ERP planejado como conector principal da Brasil Drones.',
    createdAt: fallbackDate,
    updatedAt: fallbackDate,
  },
  {
    id: 'provider-mercos',
    key: 'mercos',
    name: 'Mercos',
    category: 'erp',
    status: 'planned',
    description: 'ERP planejado para a futura loja LB London.',
    createdAt: fallbackDate,
    updatedAt: fallbackDate,
  },
  {
    id: 'provider-mercado-pago',
    key: 'mercado_pago',
    name: 'Mercado Pago',
    category: 'payment',
    status: 'planned',
    description: 'Gateway de pagamento planejado para checkout futuro.',
    createdAt: fallbackDate,
    updatedAt: fallbackDate,
  },
  {
    id: 'provider-melhor-envio',
    key: 'melhor_envio',
    name: 'Melhor Envio',
    category: 'shipping',
    status: 'planned',
    description: 'Operador logístico planejado para cotação e envio.',
    createdAt: fallbackDate,
    updatedAt: fallbackDate,
  },
];

function toCompactLogText(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').slice(0, 220);
}

function getQueryErrorDetails(error: RepositoryError | null) {
  return {
    code: error?.code ?? 'unknown',
    details: toCompactLogText(error?.details),
    hint: toCompactLogText(error?.hint),
    message: error?.message ?? 'query-error',
  };
}

function toProviderCategory(value: string): IntegrationProviderCategory {
  return providerCategories.includes(value as IntegrationProviderCategory)
    ? (value as IntegrationProviderCategory)
    : 'erp';
}

function toProviderStatus(value: string): IntegrationProviderStatus {
  return providerStatuses.includes(value as IntegrationProviderStatus)
    ? (value as IntegrationProviderStatus)
    : 'planned';
}

function mapProvider(row: ProviderRow): IntegrationProvider {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    category: toProviderCategory(row.category),
    status: toProviderStatus(row.status),
    description: row.description ?? undefined,
    createdAt: row.created_at ?? fallbackDate,
    updatedAt: row.updated_at ?? row.created_at ?? fallbackDate,
  };
}

function ensureInitialProviders(
  providers: IntegrationProvider[]
): IntegrationProvider[] {
  const providersByKey = new Map(
    providers.map((provider) => [provider.key, provider])
  );

  mockIntegrationProviders.forEach((provider) => {
    if (!providersByKey.has(provider.key)) {
      providersByKey.set(provider.key, provider);
    }
  });

  return Array.from(providersByKey.values()).sort((left, right) => {
    if (left.category === right.category) {
      return left.name.localeCompare(right.name);
    }

    return left.category.localeCompare(right.category);
  });
}

export async function listIntegrationProvidersWithSourceFromRepository(): Promise<
  IntegrationRepositoryResult<IntegrationProvider[]>
> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    logDevOnce('integration-provider.repository', 'using mock providers', {
      reason: 'supabase-admin-env-missing',
    });

    return {
      data: mockIntegrationProviders,
      source: 'mock',
    };
  }

  const { data, error } = await supabase
    .from('integration_providers')
    .select('id, key, name, category, status, description, created_at, updated_at')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) {
    logDevOnce('integration-provider.repository', 'using mock providers', {
      reason: 'providers-query-failed',
      ...getQueryErrorDetails(error),
    });

    return {
      data: mockIntegrationProviders,
      source: 'mock',
    };
  }

  return {
    data: ensureInitialProviders((data as ProviderRow[]).map(mapProvider)),
    source: 'supabase',
  };
}
