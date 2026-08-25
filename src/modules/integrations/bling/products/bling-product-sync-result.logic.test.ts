import { describe, expect, it } from 'vitest';

import { getSingleProductSyncErrorCode } from './bling-product-sync-result.logic';

describe('getSingleProductSyncErrorCode', () => {
  it('returns the diagnostic error for a failed single-product sync', () => {
    expect(
      getSingleProductSyncErrorCode({
        syncMode: 'single',
        errors: 1,
        diagnostics: [
          {
            action: 'error',
            externalId: '16690733422',
            errorCode: 'bling_product_sync_failed',
          },
        ],
      })
    ).toBe('bling_product_sync_failed');
  });

  it('does not fail a successful single-product sync', () => {
    expect(
      getSingleProductSyncErrorCode({
        syncMode: 'single',
        errors: 0,
        diagnostics: [{ action: 'updated', externalId: '16690733422' }],
      })
    ).toBeUndefined();
  });

  it('preserves the existing partial-success behavior for batch syncs', () => {
    expect(
      getSingleProductSyncErrorCode({
        syncMode: 'incremental',
        errors: 1,
        diagnostics: [{ action: 'error', errorCode: 'provider_item_failed' }],
      })
    ).toBeUndefined();
  });
});
