import type { BlingProductListResponse } from './bling-product.types';

/**
 * A reconciliation is allowed to change the local catalogue only when the
 * source page is structurally complete. Treat malformed or duplicated pages as
 * an incomplete snapshot instead of interpreting them as an empty catalogue.
 */
export function getBlingProductExternalIdsFromReconciliationPage(
  response: BlingProductListResponse
) {
  if (!Array.isArray(response.data)) {
    throw new Error('bling_product_reconciliation_invalid_response');
  }

  const externalIds = new Set<string>();

  for (const product of response.data) {
    const productId = product.id;

    if (
      typeof productId !== 'number' ||
      !Number.isSafeInteger(productId) ||
      productId <= 0
    ) {
      throw new Error('bling_product_reconciliation_missing_product_id');
    }

    const externalId = String(productId);

    if (externalIds.has(externalId)) {
      throw new Error('bling_product_reconciliation_duplicate_product_id');
    }

    externalIds.add(externalId);
  }

  return externalIds;
}
