import 'server-only';

import {
  listIntegrationProductVariantsForProvider,
  updateIntegrationVariantStockInRepository,
} from '@/modules/catalog/product.repository';
import { BlingApiClientError, createBlingApiClientForStore } from '../bling.api-client';
import type { BlingApiClient } from '../bling.api-client';
import type { BlingEnvironment } from '../bling.types';
import {
  completeBlingInventorySyncJobInRepository,
  createBlingInventorySyncJobInRepository,
  hasRunningBlingInventorySyncJobInRepository,
  recordBlingInventorySyncEventInRepository,
} from '../bling.repository';
import type {
  BlingInventorySyncDiagnostic,
  BlingInventorySyncResult,
  BlingInventorySyncSummary,
  BlingStockBalanceResponse,
} from './bling-inventory.types';

const provider = 'bling';
const batchSize = 50;
const requestIntervalMs = 400;
const diagnosticsLimit = 30;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toSafeErrorCode(error: unknown) {
  if (error instanceof BlingApiClientError) {
    return error.code;
  }

  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message.slice(0, 80);
  }

  return 'bling_inventory_sync_failed';
}

function toStock(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 0) : 0;
}

function createInitialSummary(startedAt: string): BlingInventorySyncSummary {
  return {
    status: 'success',
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    variantsProcessed: 0,
    variantsUpdated: 0,
    variantsSkipped: 0,
    stockBalancesSynced: 0,
    errors: 0,
    tokenRefreshed: false,
    diagnostics: [],
  };
}

function finishSummary(
  summary: BlingInventorySyncSummary,
  input: {
    status: 'success' | 'error';
    startedAtMs: number;
    tokenRefreshed: boolean;
    errorCode?: string;
  }
) {
  const finishedAt = new Date().toISOString();

  return {
    ...summary,
    status: input.status,
    finishedAt,
    durationMs: Date.now() - input.startedAtMs,
    tokenRefreshed: input.tokenRefreshed,
    errorCode: input.errorCode,
  } satisfies BlingInventorySyncSummary;
}

function addDiagnostic(
  summary: BlingInventorySyncSummary,
  diagnostic: BlingInventorySyncDiagnostic
) {
  summary.diagnostics = [...summary.diagnostics, diagnostic].slice(-diagnosticsLimit);
}

async function runSafely(operation: () => Promise<void>) {
  try {
    await operation();
  } catch {
    // Operational bookkeeping must never leak sensitive provider details.
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function runBlingInventorySync(
  storeId: string
): Promise<BlingInventorySyncResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let summary = createInitialSummary(startedAt);

  if (await hasRunningBlingInventorySyncJobInRepository(storeId)) {
    const finishedSummary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
      tokenRefreshed: false,
      errorCode: 'inventory_sync_already_running',
    });

    return {
      status: 'error',
      summary: finishedSummary,
      errorCode: 'inventory_sync_already_running',
    };
  }

  let jobId: string | undefined;
  let tokenRefreshed = false;
  let client: BlingApiClient | undefined;
  let environment: BlingEnvironment | undefined;

  try {
    const clientContext = await createBlingApiClientForStore(storeId);
    client = clientContext.client;
    environment = clientContext.environment;
    const activeClient = clientContext.client;

    jobId = await createBlingInventorySyncJobInRepository({
      storeId,
      summary: {
        status: 'running',
        startedAt,
      },
    });
    summary = {
      ...summary,
      jobId,
    };
    await recordBlingInventorySyncEventInRepository({
      storeId,
      environment,
      status: 'running',
      summary: summary as unknown as Record<string, unknown>,
    });

    const variants = await listIntegrationProductVariantsForProvider(storeId, provider);
    let lastRequestAt = 0;

    const request = async <T>(
      path: string,
      query?: Record<string, string | number | Array<string | number> | undefined>
    ) => {
      const elapsed = Date.now() - lastRequestAt;

      if (elapsed < requestIntervalMs) {
        await sleep(requestIntervalMs - elapsed);
      }

      const result = await activeClient.request<T>(path, { query });
      lastRequestAt = Date.now();
      return result;
    };

    for (const variantBatch of chunk(variants, batchSize)) {
      const externalIds = variantBatch.map((variant) => variant.externalId);
      const response = await request<BlingStockBalanceResponse>('/estoques/saldos', {
        'idsProdutos[]': externalIds,
      });
      const stockByExternalId = new Map<string, number>();

      for (const item of response.data ?? []) {
        const productId = item.produto?.id;

        if (!productId) {
          continue;
        }

        stockByExternalId.set(String(productId), toStock(item.saldoVirtualTotal));
      }

      summary.stockBalancesSynced += stockByExternalId.size;

      for (const variant of variantBatch) {
        summary.variantsProcessed += 1;
        const nextStock = stockByExternalId.get(variant.externalId);

        if (nextStock === undefined) {
          summary.variantsSkipped += 1;
          addDiagnostic(summary, {
            externalId: variant.externalId,
            sku: variant.sku,
            previousStock: variant.stock,
            action: 'skipped',
            errorCode: 'stock_balance_not_found',
          });
          continue;
        }

        if (nextStock === variant.stock) {
          summary.variantsSkipped += 1;
          addDiagnostic(summary, {
            externalId: variant.externalId,
            sku: variant.sku,
            previousStock: variant.stock,
            nextStock,
            action: 'skipped',
          });
          continue;
        }

        try {
          await updateIntegrationVariantStockInRepository({
            storeId,
            variantId: variant.id,
            stock: nextStock,
          });
          summary.variantsUpdated += 1;
          addDiagnostic(summary, {
            externalId: variant.externalId,
            sku: variant.sku,
            previousStock: variant.stock,
            nextStock,
            action: 'updated',
          });
        } catch (variantError) {
          summary.variantsSkipped += 1;
          summary.errors += 1;
          addDiagnostic(summary, {
            externalId: variant.externalId,
            sku: variant.sku,
            previousStock: variant.stock,
            nextStock,
            action: 'error',
            errorCode: toSafeErrorCode(variantError),
          });
        }
      }
    }

    tokenRefreshed = client.hasRefreshedToken();
    summary = finishSummary(summary, {
      status: 'success',
      startedAtMs,
      tokenRefreshed,
    });

    await completeBlingInventorySyncJobInRepository({
      jobId,
      storeId,
      status: 'success',
      summary: summary as unknown as Record<string, unknown>,
    });
    await recordBlingInventorySyncEventInRepository({
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
    tokenRefreshed = client?.hasRefreshedToken() ?? false;
    summary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
      tokenRefreshed,
      errorCode,
    });

    const currentJobId = jobId;

    if (currentJobId) {
      await runSafely(() =>
        completeBlingInventorySyncJobInRepository({
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
        recordBlingInventorySyncEventInRepository({
          storeId,
          environment: currentEnvironment,
          status: 'error',
          summary: summary as unknown as Record<string, unknown>,
        })
      );
    }

    return {
      status: 'error',
      summary,
      errorCode,
    };
  }
}
