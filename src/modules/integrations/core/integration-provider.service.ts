import type {
  IntegrationProvider,
  IntegrationRepositoryResult,
} from './integration-provider.types';
import { listIntegrationProvidersWithSourceFromRepository } from './integration-provider.repository';

export async function listIntegrationProvidersWithSource(): Promise<
  IntegrationRepositoryResult<IntegrationProvider[]>
> {
  return listIntegrationProvidersWithSourceFromRepository();
}
