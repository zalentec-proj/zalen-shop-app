import 'server-only';

import { reconcileIntegrationProductsInRepository } from '@/modules/catalog/product.repository';
import { BlingApiClientError, createBlingApiClientForStore } from '../bling.api-client';
import type { BlingApiClient } from '../bling.api-client';
import {
  completeBlingProductReconciliationJobInRepository,
  createBlingProductReconciliationJobInRepository,
  hasRunningBlingProductReconciliationJobInRepository,
  recordBlingProductReconciliationEventInRepository,
} from '../bling.repository';
import type { BlingEnvironment } from '../bling.types';
import type { BlingProductListResponse } from './bling-product.types';
import { getBlingProductExternalIdsFromReconciliationPage } from './bling-product-reconciliation.logic';

const productPageLimit = 40;
const maxPages = 1_000;
const diagnosticsLimit = 30;

type BlingProductReconciliationStatus = 'success' | 'error';

export type BlingProductReconciliationSummary = {
  status: BlingProductReconciliationStatus;
  jobId?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pagesProcessed: number;
  sourceProductsSeen: number;
  sourceSnapshotComplete: boolean;
  productsMissingFromSource: number;
  productsInactivated: number;
  tokenRefreshed: boolean;
  errorCode?: string;
  diagnostics: Array<{
    page: number;
    sourceProducts: number;
  }>;
};

export type BlingProductReconciliationResult = {
  status: BlingProductReconciliationStatus;
  environment?: BlingEnvironment;
  summary: BlingProductReconciliationSummary;
  errorCode?: string;
};

function createInitialSummary(startedAt: string): BlingProductReconciliationSummary {
  return {
    status: 'success',
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    pagesProcessed: 0,
    sourceProductsSeen: 0,
    sourceSnapshotComplete: false,
    productsMissingFromSource: 0,
    productsInactivated: 0,
    tokenRefreshed: false,
    diagnostics: [],
  };
}

function finishSummary(
  summary: BlingProductReconciliationSummary,
  input: {
    status: BlingProductReconciliationStatus;
    startedAtMs: number;
    tokenRefreshed: boolean;
    errorCode?: string;
  }
) {
  return {
    ...summary,
    status: input.status,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - input.startedAtMs,
    tokenRefreshed: input.tokenRefreshed,
    errorCode: input.errorCode,
  } satisfies BlingProductReconciliationSummary;
}

function addDiagnostic(
  summary: BlingProductReconciliationSummary,
  diagnostic: BlingProductReconciliationSummary['diagnostics'][number]
) {
  summary.diagnostics = [...summary.diagnostics, diagnostic].slice(-diagnosticsLimit);
}

function toSafeErrorCode(error: unknown) {
  if (error instanceof BlingApiClientError) {
    return error.code;
  }

  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message.slice(0, 80);
  }

  return 'bling_product_reconciliation_failed';
}

async function runSafely(operation: () => Promise<void>) {
  try {
    await operation();
  } catch {
    // The primary reconciliation error is already sanitized for the job result.
  }
}

/**
 * Reconciles only absence: every active local Bling product that is not in a
 * complete source snapshot becomes inactive. It never deletes catalogue data,
 * and it refuses to continue after a malformed, repeated or failed page.
 */
export async function runBlingProductReconciliation(
  storeId: string
): Promise<BlingProductReconciliationResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let summary = createInitialSummary(startedAt);

  if (await hasRunningBlingProductReconciliationJobInRepository(storeId)) {
    const finishedSummary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
      tokenRefreshed: false,
      errorCode: 'product_reconciliation_already_running',
    });

    return {
      status: 'error',
      summary: finishedSummary,
      errorCode: 'product_reconciliation_already_running',
    };
  }

  let jobId: string | undefined;
  let client: BlingApiClient | undefined;
  let environment: BlingEnvironment | undefined;

  try {
    const clientContext = await createBlingApiClientForStore(storeId);
    client = clientContext.client;
    environment = clientContext.environment;
    jobId = await createBlingProductReconciliationJobInRepository({
      storeId,
      summary: { status: 'running', startedAt },
    });
    summary = { ...summary, jobId };
    await recordBlingProductReconciliationEventInRepository({
      storeId,
      environment,
      status: 'running',
      summary: summary as unknown as Record<string, unknown>,
    });

    const sourceExternalIds = new Set<string>();
    let page = 1;

    while (page <= maxPages) {
      const response = await client.request<BlingProductListResponse>('/produtos', {
        query: {
          pagina: page,
          limite: productPageLimit,
        },
      });
      const pageExternalIds = getBlingProductExternalIdsFromReconciliationPage(response);

      for (const externalId of pageExternalIds) {
        if (sourceExternalIds.has(externalId)) {
          throw new Error('bling_product_reconciliation_pagination_replayed');
        }

        sourceExternalIds.add(externalId);
      }

      summary.pagesProcessed += 1;
      summary.sourceProductsSeen = sourceExternalIds.size;
      addDiagnostic(summary, {
        page,
        sourceProducts: pageExternalIds.size,
      });

      if (pageExternalIds.size < productPageLimit) {
        summary.sourceSnapshotComplete = true;
        break;
      }

      page += 1;
    }

    if (!summary.sourceSnapshotComplete) {
      throw new Error('bling_product_reconciliation_page_limit_exceeded');
    }

    const reconciliation = await reconcileIntegrationProductsInRepository({
      storeId,
      externalProvider: 'bling',
      sourceExternalIds,
      snapshotStartedAt: startedAt,
    });
    summary.productsMissingFromSource = reconciliation.productsMissingFromSource;
    summary.productsInactivated = reconciliation.productsInactivated;

    const tokenRefreshed = client.hasRefreshedToken();
    summary = finishSummary(summary, {
      status: 'success',
      startedAtMs,
      tokenRefreshed,
    });

    await completeBlingProductReconciliationJobInRepository({
      jobId,
      storeId,
      status: 'success',
      summary: summary as unknown as Record<string, unknown>,
    });
    await recordBlingProductReconciliationEventInRepository({
      storeId,
      environment,
      status: 'success',
      summary: summary as unknown as Record<string, unknown>,
    });

    return {
      status: 'success',
      environment,
      summary,
    };
  } catch (error) {
    const errorCode = toSafeErrorCode(error);
    summary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
      tokenRefreshed: client?.hasRefreshedToken() ?? false,
      errorCode,
    });

    const currentJobId = jobId;

    if (currentJobId) {
      await runSafely(() =>
        completeBlingProductReconciliationJobInRepository({
          jobId: currentJobId,
          storeId,
          status: 'error',
          summary: summary as unknown as Record<string, unknown>,
          lastError: errorCode,
        })
      );
    }

    const currentEnvironment = environment;

    if (currentEnvironment) {
      await runSafely(() =>
        recordBlingProductReconciliationEventInRepository({
          storeId,
          environment: currentEnvironment,
          status: 'error',
          summary: summary as unknown as Record<string, unknown>,
        })
      );
    }

    return {
      status: 'error',
      environment,
      summary,
      errorCode,
    };
  }
}
