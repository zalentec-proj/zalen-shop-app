import type {
  IntegrationRepositoryResult,
} from './integration-provider.types';
import type { StoreIntegrationListItem } from './store-integration.types';
import { listStoreIntegrationsWithSourceFromRepository } from './store-integration.repository';

export async function listStoreIntegrationsWithSource(
  storeId: string
): Promise<IntegrationRepositoryResult<StoreIntegrationListItem[]>> {
  return listStoreIntegrationsWithSourceFromRepository(storeId);
}
