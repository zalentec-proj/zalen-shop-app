import 'server-only';

import { listConnectedBlingStoreIdsInRepository } from '../bling.repository';
import { runBlingProductReconciliation } from '../products/bling-product-reconciliation.service';

type BlingScheduledProductReconciliationStoreResult = {
  storeId: string;
  status: 'success' | 'error';
  productsInactivated: number;
  errorCode?: string;
};

export type BlingScheduledProductReconciliationResult = {
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  storesFound: number;
  storesProcessed: number;
  storesWithErrors: number;
  changesApplied: number;
  results: BlingScheduledProductReconciliationStoreResult[];
};

function toSafeErrorCode(error: unknown) {
  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message.slice(0, 80);
  }

  return 'bling_scheduled_product_reconciliation_failed';
}

export async function runBlingScheduledProductReconciliation(
  input: { storeIds?: string[] } = {}
): Promise<BlingScheduledProductReconciliationResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const storeIds =
    input.storeIds && input.storeIds.length > 0
      ? input.storeIds
      : await listConnectedBlingStoreIdsInRepository();
  const results: BlingScheduledProductReconciliationStoreResult[] = [];

  for (const storeId of storeIds) {
    try {
      const result = await runBlingProductReconciliation(storeId);

      results.push({
        storeId,
        status: result.status,
        productsInactivated: result.summary.productsInactivated,
        errorCode:
          result.status === 'error'
            ? result.errorCode ?? result.summary.errorCode
            : undefined,
      });
    } catch (error) {
      results.push({
        storeId,
        status: 'error',
        productsInactivated: 0,
        errorCode: toSafeErrorCode(error),
      });
    }
  }

  const storesWithErrors = results.filter((result) => result.status === 'error').length;
  const changesApplied = results.reduce(
    (total, result) => total + result.productsInactivated,
    0
  );

  return {
    status: storesWithErrors > 0 ? 'error' : 'success',
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    storesFound: storeIds.length,
    storesProcessed: results.length,
    storesWithErrors,
    changesApplied,
    results,
  };
}
