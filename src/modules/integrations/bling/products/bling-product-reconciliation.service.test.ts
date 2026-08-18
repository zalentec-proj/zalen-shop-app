import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  hasRefreshedToken: vi.fn(),
  createClient: vi.fn(),
  hasRunningJob: vi.fn(),
  createJob: vi.fn(),
  completeJob: vi.fn(),
  recordEvent: vi.fn(),
  reconcileProducts: vi.fn(),
}));

vi.mock('../bling.api-client', () => ({
  BlingApiClientError: class BlingApiClientError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  },
  createBlingApiClientForStore: mocks.createClient,
}));

vi.mock('../bling.repository', () => ({
  hasRunningBlingProductReconciliationJobInRepository: mocks.hasRunningJob,
  createBlingProductReconciliationJobInRepository: mocks.createJob,
  completeBlingProductReconciliationJobInRepository: mocks.completeJob,
  recordBlingProductReconciliationEventInRepository: mocks.recordEvent,
}));

vi.mock('@/modules/catalog/product.repository', () => ({
  reconcileIntegrationProductsInRepository: mocks.reconcileProducts,
}));

import { runBlingProductReconciliation } from './bling-product-reconciliation.service';

function page(startId: number, size: number) {
  return {
    data: Array.from({ length: size }, (_, index) => ({ id: startId + index })),
  };
}

describe('reconciliação de produtos Bling', () => {
  beforeEach(() => {
    mocks.hasRunningJob.mockResolvedValue(false);
    mocks.createJob.mockResolvedValue('job-1');
    mocks.completeJob.mockResolvedValue(undefined);
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.hasRefreshedToken.mockReturnValue(false);
    mocks.createClient.mockResolvedValue({
      client: {
        request: mocks.request,
        hasRefreshedToken: mocks.hasRefreshedToken,
      },
      environment: 'production',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('inativa somente após percorrer todo o snapshot paginado do Bling', async () => {
    mocks.request.mockResolvedValueOnce(page(1, 40)).mockResolvedValueOnce(page(41, 1));
    mocks.reconcileProducts.mockResolvedValue({
      productsMissingFromSource: 2,
      productsInactivated: 2,
    });

    const result = await runBlingProductReconciliation('store-1');

    expect(result.status).toBe('success');
    expect(result.summary.sourceSnapshotComplete).toBe(true);
    expect(result.summary.sourceProductsSeen).toBe(41);
    expect(result.summary.productsInactivated).toBe(2);
    expect(mocks.reconcileProducts).toHaveBeenCalledOnce();

    const input = mocks.reconcileProducts.mock.calls[0]?.[0] as {
      sourceExternalIds: Iterable<string>;
      snapshotStartedAt: string;
    };
    expect(Array.from(input.sourceExternalIds)).toEqual(
      Array.from({ length: 41 }, (_, index) => String(index + 1))
    );
    expect(input.snapshotStartedAt).toEqual(expect.any(String));
    expect(mocks.completeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' })
    );
  });

  it('não inativa quando a paginação repete uma página', async () => {
    mocks.request.mockResolvedValue(page(1, 40));

    const result = await runBlingProductReconciliation('store-1');

    expect(result).toMatchObject({
      status: 'error',
      errorCode: 'bling_product_reconciliation_pagination_replayed',
    });
    expect(mocks.reconcileProducts).not.toHaveBeenCalled();
  });

  it('não inativa quando a leitura da fonte falha no meio do snapshot', async () => {
    mocks.request
      .mockResolvedValueOnce(page(1, 40))
      .mockRejectedValueOnce(new Error('bling_request_timeout'));

    const result = await runBlingProductReconciliation('store-1');

    expect(result).toMatchObject({
      status: 'error',
      errorCode: 'bling_request_timeout',
    });
    expect(mocks.reconcileProducts).not.toHaveBeenCalled();
    expect(mocks.completeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        lastError: 'bling_request_timeout',
      })
    );
  });
});
