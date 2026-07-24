import 'server-only';

import { markIntegrationProductInactiveInRepository } from '@/modules/catalog/product.repository';
import {
  claimPendingBlingWebhookProcessJobsInRepository,
  completeBlingWebhookProcessJobInRepository,
  listConnectedBlingStoreIdsInRepository,
  updateBlingWebhookEventStatusInRepository,
  type BlingWebhookProcessJob,
} from '../bling.repository';
import { runBlingInventorySync } from '../inventory/bling-inventory-sync.service';
import { runBlingProductSync } from '../products/bling-product-sync.service';
import { countWebhookBlingCatalogChanges } from '../jobs/bling-job-change-detection';

const maxAttempts = 5;
const diagnosticsLimit = 30;

type BlingWebhookWorkerStatus = 'success' | 'error';

export type BlingWebhookWorkerSummary = {
  status: BlingWebhookWorkerStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jobsClaimed: number;
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsRetried: number;
  jobsSkipped: number;
  productSyncs: number;
  inventorySyncs: number;
  productsInactivated: number;
  errors: number;
  diagnostics: Array<{
    jobId: string;
    event?: string;
    eventId?: string;
    storeId: string;
    action: string;
    productId?: string;
    status: 'success' | 'error' | 'skipped';
    errorCode?: string;
    final?: boolean;
  }>;
};

export type BlingWebhookWorkerResult = {
  status: BlingWebhookWorkerStatus;
  summary: BlingWebhookWorkerSummary;
  errorCode?: string;
};

function createInitialSummary(startedAt: string): BlingWebhookWorkerSummary {
  return {
    status: 'success',
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    jobsClaimed: 0,
    jobsProcessed: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    jobsRetried: 0,
    jobsSkipped: 0,
    productSyncs: 0,
    inventorySyncs: 0,
    productsInactivated: 0,
    errors: 0,
    diagnostics: [],
  };
}

function finishSummary(
  summary: BlingWebhookWorkerSummary,
  input: {
    status: BlingWebhookWorkerStatus;
    startedAtMs: number;
  }
) {
  const finishedAt = new Date().toISOString();

  return {
    ...summary,
    status: input.status,
    finishedAt,
    durationMs: Date.now() - input.startedAtMs,
  };
}

function addDiagnostic(
  summary: BlingWebhookWorkerSummary,
  diagnostic: BlingWebhookWorkerSummary['diagnostics'][number]
) {
  summary.diagnostics = [...summary.diagnostics, diagnostic].slice(-diagnosticsLimit);
}

function toSafeErrorCode(error: unknown) {
  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message.slice(0, 80);
  }

  return 'bling_webhook_process_failed';
}

function toExternalId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function getProductExternalId(job: BlingWebhookProcessJob) {
  return (
    toExternalId(job.externalIds.id) ??
    toExternalId(job.externalIds.produtoId)
  );
}

function getEventParts(event?: string) {
  const [resource, action] = (event ?? '').split('.');

  return {
    resource: resource?.trim(),
    action: action?.trim(),
  };
}

function getRetryDelayMs(attempts: number) {
  const exponent = Math.max(attempts - 1, 0);

  return Math.min(30 * 60 * 1000, 2 ** exponent * 60 * 1000);
}

function createCompletionPayload(
  job: BlingWebhookProcessJob,
  processing: Record<string, unknown>
) {
  return {
    ...job.payload,
    processing: {
      ...processing,
      processedAt: new Date().toISOString(),
      attempts: job.attempts,
    },
  };
}

async function markWebhookEventStatusSafely(input: {
  job: BlingWebhookProcessJob;
  status: 'processed' | 'error';
  errorCode?: string;
}) {
  if (!input.job.webhookEventId) {
    return;
  }

  try {
    await updateBlingWebhookEventStatusInRepository({
      webhookEventId: input.job.webhookEventId,
      storeId: input.job.storeId,
      status: input.status,
      errorMessage: input.errorCode,
    });
  } catch {
    // Event bookkeeping must not leak provider details or break job completion.
  }
}

async function processSingleJob(
  job: BlingWebhookProcessJob,
  inventorySyncByStore: Map<string, Awaited<ReturnType<typeof runBlingInventorySync>>>
) {
  const { resource, action } = getEventParts(job.event);

  if (!resource || !action) {
    return {
      action: 'skipped_invalid_event',
      status: 'skipped' as const,
    };
  }

  if (resource === 'product') {
    const productId = getProductExternalId(job);

    if (!productId) {
      throw new Error('missing_bling_product_id');
    }

    if (action === 'created' || action === 'updated') {
      const result = await runBlingProductSync(job.storeId, { productId });

      if (result.status === 'error') {
        throw new Error(result.errorCode ?? result.summary.errorCode ?? 'product_sync_failed');
      }

      return {
        action: 'product_sync',
        status: 'success' as const,
        productId,
      };
    }

    if (action === 'deleted') {
      const result = await markIntegrationProductInactiveInRepository({
        storeId: job.storeId,
        externalProvider: 'bling',
        externalId: productId,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return {
        action: 'product_inactivated',
        status: 'success' as const,
        productId,
      };
    }
  }

  if (
    (resource === 'stock' || resource === 'virtual_stock') &&
    (action === 'created' || action === 'updated' || action === 'deleted')
  ) {
    let result = inventorySyncByStore.get(job.storeId);

    if (!result) {
      result = await runBlingInventorySync(job.storeId);
      inventorySyncByStore.set(job.storeId, result);
    }

    if (result.status === 'error') {
      throw new Error(result.errorCode ?? result.summary.errorCode ?? 'inventory_sync_failed');
    }

    return {
      action: 'inventory_sync',
      status: 'success' as const,
    };
  }

  return {
    action: 'skipped_unsupported_event',
    status: 'skipped' as const,
  };
}

export async function processBlingWebhookJobs(input: {
  storeId?: string;
  limit?: number;
} = {}): Promise<BlingWebhookWorkerResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let summary = createInitialSummary(startedAt);

  try {
    const jobs = await claimPendingBlingWebhookProcessJobsInRepository({
      storeId: input.storeId,
      limit: input.limit ?? 20,
    });
    const inventorySyncByStore = new Map<
      string,
      Awaited<ReturnType<typeof runBlingInventorySync>>
    >();

    summary.jobsClaimed = jobs.length;

    for (const job of jobs) {
      try {
        const result = await processSingleJob(job, inventorySyncByStore);
        summary.jobsProcessed += 1;

        if (result.status === 'skipped') {
          summary.jobsSkipped += 1;
        } else {
          summary.jobsSucceeded += 1;
        }

        if (result.action === 'product_sync') {
          summary.productSyncs += 1;
        } else if (result.action === 'inventory_sync') {
          summary.inventorySyncs += 1;
        } else if (result.action === 'product_inactivated') {
          summary.productsInactivated += 1;
        }

        await completeBlingWebhookProcessJobInRepository({
          jobId: job.id,
          storeId: job.storeId,
          status: 'success',
          summary: createCompletionPayload(job, {
            action: result.action,
            status: result.status,
            productId: 'productId' in result ? result.productId : undefined,
          }),
        });
        await markWebhookEventStatusSafely({ job, status: 'processed' });
        addDiagnostic(summary, {
          jobId: job.id,
          event: job.event,
          eventId: job.eventId,
          storeId: job.storeId,
          action: result.action,
          productId: 'productId' in result ? result.productId : undefined,
          status: result.status,
        });
      } catch (jobError) {
        const errorCode = toSafeErrorCode(jobError);
        const final = job.attempts >= maxAttempts;
        const nextAttemptAt = new Date(
          Date.now() + getRetryDelayMs(job.attempts)
        ).toISOString();

        summary.jobsProcessed += 1;
        summary.jobsFailed += 1;
        summary.errors += 1;

        if (!final) {
          summary.jobsRetried += 1;
        }

        await completeBlingWebhookProcessJobInRepository({
          jobId: job.id,
          storeId: job.storeId,
          status: 'error',
          summary: createCompletionPayload(job, {
            action: 'error',
            status: 'error',
            errorCode,
            final,
          }),
          lastError: errorCode,
          nextAttemptAt,
          final,
        });
        await markWebhookEventStatusSafely({
          job,
          status: 'error',
          errorCode,
        });
        addDiagnostic(summary, {
          jobId: job.id,
          event: job.event,
          eventId: job.eventId,
          storeId: job.storeId,
          action: 'error',
          status: 'error',
          errorCode,
          final,
        });
      }
    }

    summary = finishSummary(summary, {
      status: summary.errors > 0 ? 'error' : 'success',
      startedAtMs,
    });

    return {
      status: summary.status,
      summary,
      errorCode: summary.errors > 0 ? 'bling_webhook_process_partial_error' : undefined,
    };
  } catch (error) {
    const errorCode = toSafeErrorCode(error);

    summary.errors += 1;
    summary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
    });

    return {
      status: 'error',
      summary,
      errorCode,
    };
  }
}

export async function processBlingWebhookJobsForConnectedStores(input: {
  limitPerStore?: number;
} = {}) {
  const storeIds = await listConnectedBlingStoreIdsInRepository();
  const results: BlingWebhookWorkerResult[] = [];

  for (const storeId of storeIds) {
    results.push(
      await processBlingWebhookJobs({
        storeId,
        limit: input.limitPerStore ?? 20,
      })
    );
  }

  return {
    status: results.some((result) => result.status === 'error')
      ? 'error'
      : 'success',
    storesProcessed: storeIds.length,
    changesApplied: results.reduce(
      (total, result) =>
        total +
        countWebhookBlingCatalogChanges({
          productSyncs: result.summary.productSyncs,
          inventorySyncs: result.summary.inventorySyncs,
          productsInactivated: result.summary.productsInactivated,
        }),
      0
    ),
    results,
  };
}
