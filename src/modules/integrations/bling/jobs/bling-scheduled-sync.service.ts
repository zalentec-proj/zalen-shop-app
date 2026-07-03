import 'server-only';

import { listConnectedBlingStoreIdsInRepository } from '../bling.repository';
import { runBlingInventorySync } from '../inventory/bling-inventory-sync.service';
import { runBlingProductSync } from '../products/bling-product-sync.service';

type BlingScheduledSyncStoreResult = {
  storeId: string;
  productSync: {
    status: 'success' | 'error';
    errorCode?: string;
  };
  inventorySync: {
    status: 'success' | 'error' | 'skipped';
    errorCode?: string;
  };
};

export type BlingScheduledSyncResult = {
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  storesFound: number;
  storesProcessed: number;
  storesWithErrors: number;
  results: BlingScheduledSyncStoreResult[];
};

export type BlingScheduledSyncMode = 'incremental' | 'full';

function toSafeErrorCode(error: unknown) {
  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message.slice(0, 80);
  }

  return 'bling_scheduled_sync_failed';
}

export async function runBlingScheduledSync(input: {
  storeIds?: string[];
  productSyncMode?: BlingScheduledSyncMode;
} = {}): Promise<BlingScheduledSyncResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const storeIds =
    input.storeIds && input.storeIds.length > 0
      ? input.storeIds
      : await listConnectedBlingStoreIdsInRepository();
  const results: BlingScheduledSyncStoreResult[] = [];

  for (const storeId of storeIds) {
    const storeResult: BlingScheduledSyncStoreResult = {
      storeId,
      productSync: { status: 'success' },
      inventorySync: { status: 'skipped' },
    };

    try {
      const productResult = await runBlingProductSync(storeId, {
        mode: input.productSyncMode ?? 'incremental',
      });

      storeResult.productSync = {
        status: productResult.status,
        errorCode:
          productResult.status === 'error'
            ? productResult.errorCode ?? productResult.summary.errorCode
            : undefined,
      };

      const inventoryResult = await runBlingInventorySync(storeId);

      storeResult.inventorySync = {
        status: inventoryResult.status,
        errorCode:
          inventoryResult.status === 'error'
            ? inventoryResult.errorCode ?? inventoryResult.summary.errorCode
            : undefined,
      };
    } catch (error) {
      const errorCode = toSafeErrorCode(error);

      if (storeResult.productSync.status !== 'error') {
        storeResult.productSync = {
          status: 'error',
          errorCode,
        };
      }

      if (storeResult.inventorySync.status !== 'error') {
        storeResult.inventorySync = {
          status: 'error',
          errorCode,
        };
      }
    }

    results.push(storeResult);
  }

  const storesWithErrors = results.filter(
    (result) =>
      result.productSync.status === 'error' ||
      result.inventorySync.status === 'error'
  ).length;
  const finishedAt = new Date().toISOString();

  return {
    status: storesWithErrors > 0 ? 'error' : 'success',
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedAtMs,
    storesFound: storeIds.length,
    storesProcessed: results.length,
    storesWithErrors,
    results,
  };
}
