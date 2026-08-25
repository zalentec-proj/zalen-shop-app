import type { BlingProductSyncSummary } from './bling-product.types';

export function getSingleProductSyncErrorCode(
  summary: Pick<BlingProductSyncSummary, 'diagnostics' | 'errors' | 'syncMode'>
) {
  if (summary.syncMode !== 'single' || summary.errors === 0) {
    return undefined;
  }

  return (
    [...summary.diagnostics]
      .reverse()
      .find((diagnostic) => diagnostic.action === 'error' && diagnostic.errorCode)
      ?.errorCode ?? 'bling_product_sync_failed'
  );
}
