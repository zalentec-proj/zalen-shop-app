export type IntegrationDataSource = 'supabase' | 'mock';

export interface IntegrationRepositoryResult<T> {
  data: T;
  source: IntegrationDataSource;
}

export type IntegrationProviderCategory =
  | 'erp'
  | 'payment'
  | 'shipping'
  | 'sales_channel'
  | 'ai'
  | 'analytics'
  | 'communication';

export type IntegrationProviderStatus =
  | 'planned'
  | 'beta'
  | 'available'
  | 'deprecated';

export interface IntegrationProvider {
  id: string;
  key: string;
  name: string;
  category: IntegrationProviderCategory;
  status: IntegrationProviderStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
