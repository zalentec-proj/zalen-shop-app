import 'server-only';

import { listConnectedBlingStoreIdsInRepository } from '../bling.repository';
import { runBlingInventorySync } from '../inventory/bling-inventory-sync.service';
import { runBlingProductSync } from '../products/bling-product-sync.service';
import { countScheduledBlingCatalogChanges } from './bling-job-change-detection';

type BlingScheduledSyncStoreResult = {
  storeId: string;
  productSync: {
    status: 'success' | 'error';
    changesApplied: number;
    errorCode?: string;
  };
  inventorySync: {
    status: 'success' | 'error' | 'skipped';
    changesApplied: number;
    errorCode?: string;
  };
  changesApplied: number;
};

export type BlingScheduledSyncResult = {
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  storesFound: number;
  storesProcessed: number;
  storesWithErrors: number;
  changesApplied: number;
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
      productSync: { status: 'success', changesApplied: 0 },
      inventorySync: { status: 'skipped', changesApplied: 0 },
      changesApplied: 0,
    };

    try {
      const productResult = await runBlingProductSync(storeId, {
        mode: input.productSyncMode ?? 'incremental',
      });

      storeResult.productSync = {
        status: productResult.status,
        changesApplied: countScheduledBlingCatalogChanges({
          productsCreated: productResult.summary.productsCreated,
          productsUpdated: productResult.summary.productsUpdated,
          variantsUpdated: 0,
        }),
        errorCode:
          productResult.status === 'error'
            ? productResult.errorCode ?? productResult.summary.errorCode
            : undefined,
      };

      const inventoryResult = await runBlingInventorySync(storeId);

      storeResult.inventorySync = {
        status: inventoryResult.status,
        changesApplied: countScheduledBlingCatalogChanges({
          productsCreated: 0,
          productsUpdated: 0,
          variantsUpdated: inventoryResult.summary.variantsUpdated,
        }),
        errorCode:
          inventoryResult.status === 'error'
            ? inventoryResult.errorCode ?? inventoryResult.summary.errorCode
            : undefined,
      };
      storeResult.changesApplied =
        storeResult.productSync.changesApplied +
        storeResult.inventorySync.changesApplied;
    } catch (error) {
      const errorCode = toSafeErrorCode(error);

      if (storeResult.productSync.status !== 'error') {
        storeResult.productSync = {
          status: 'error',
          changesApplied: storeResult.productSync.changesApplied,
          errorCode,
        };
      }

      if (storeResult.inventorySync.status !== 'error') {
        storeResult.inventorySync = {
          status: 'error',
          changesApplied: storeResult.inventorySync.changesApplied,
          errorCode,
        };
      }

      storeResult.changesApplied =
        storeResult.productSync.changesApplied +
        storeResult.inventorySync.changesApplied;
    }

    results.push(storeResult);
  }

  const storesWithErrors = results.filter(
    (result) =>
      result.productSync.status === 'error' ||
      result.inventorySync.status === 'error'
  ).length;
  const finishedAt = new Date().toISOString();
  const changesApplied = results.reduce(
    (total, result) => total + result.changesApplied,
    0
  );

  return {
    status: storesWithErrors > 0 ? 'error' : 'success',
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedAtMs,
    storesFound: storeIds.length,
    storesProcessed: results.length,
    storesWithErrors,
    changesApplied,
    results,
  };
}
