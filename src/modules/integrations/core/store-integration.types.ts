import type { IntegrationProvider } from './integration-provider.types';

export type StoreIntegrationStatus =
  | 'disconnected'
  | 'connected'
  | 'error'
  | 'syncing'
  | 'disabled';

export interface StoreIntegration {
  id: string;
  storeId: string;
  providerKey: string;
  environment: string;
  status: StoreIntegrationStatus;
  settings: Record<string, unknown>;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreIntegrationListItem {
  provider: IntegrationProvider;
  integration?: StoreIntegration;
}
