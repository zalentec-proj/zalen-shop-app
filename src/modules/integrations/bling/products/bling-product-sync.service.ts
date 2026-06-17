import 'server-only';

import { upsertIntegrationProductInRepository } from '@/modules/catalog/product.repository';
import { BlingApiClientError, createBlingApiClientForStore } from '../bling.api-client';
import type { BlingApiClient } from '../bling.api-client';
import type { BlingEnvironment } from '../bling.types';
import {
  completeBlingProductSyncJobInRepository,
  createBlingProductSyncJobInRepository,
  getBlingIntegrationFromRepository,
  hasRunningBlingProductSyncJobInRepository,
  recordBlingProductSyncEventInRepository,
} from '../bling.repository';
import { mapBlingProductToCatalogInput } from './bling-product.mapper';
import type {
  BlingProductCategoryResponse,
  BlingProductDetail,
  BlingProductDetailResponse,
  BlingProductListResponse,
  BlingStockBalanceResponse,
  BlingProductSyncResult,
  BlingProductSyncSummary,
} from './bling-product.types';

const pageLimit = 100;
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

  return 'bling_product_sync_failed';
}

function createInitialSummary(startedAt: string): BlingProductSyncSummary {
  return {
    status: 'success',
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    pagesProcessed: 0,
    productsProcessed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    categoriesLinked: 0,
    categoriesCreated: 0,
    categoriesSkipped: 0,
    errors: 0,
    variantsProcessed: 0,
    stockBalancesSynced: 0,
    syncMode: 'full',
    tokenRefreshed: false,
    diagnostics: [],
  };
}

function toStock(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 0) : 0;
}

function getBlingProductIds(product: BlingProductDetail) {
  const ids = new Set<number>();

  if (product.id) {
    ids.add(product.id);
  }

  if (Array.isArray(product.variacoes)) {
    product.variacoes.forEach((variation) => {
      if (variation.id) {
        ids.add(variation.id);
      }
    });
  }

  return Array.from(ids);
}

function finishSummary(
  summary: BlingProductSyncSummary,
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
  } satisfies BlingProductSyncSummary;
}

async function runSafely(operation: () => Promise<void>) {
  try {
    await operation();
  } catch {
    // Operational bookkeeping must never leak sensitive provider details.
  }
}

function addDiagnostic(
  summary: BlingProductSyncSummary,
  diagnostic: BlingProductSyncSummary['diagnostics'][number]
) {
  summary.diagnostics = [...summary.diagnostics, diagnostic].slice(-diagnosticsLimit);
}

export async function runBlingProductSync(
  storeId: string,
  options: { mode?: 'full' | 'incremental'; productId?: string } = {}
): Promise<BlingProductSyncResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let summary = createInitialSummary(startedAt);

  if (await hasRunningBlingProductSyncJobInRepository(storeId)) {
    const finishedSummary = finishSummary(summary, {
      status: 'error',
      startedAtMs,
      tokenRefreshed: false,
      errorCode: 'product_sync_already_running',
    });

    return {
      status: 'error',
      summary: finishedSummary,
      errorCode: 'product_sync_already_running',
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
    const integration = await getBlingIntegrationFromRepository(storeId);
    const syncSince =
      options.mode === 'full' || options.productId ? undefined : integration?.lastSyncAt;

    if (options.productId) {
      summary = {
        ...summary,
        syncMode: 'single',
        syncProductId: options.productId,
      };
    } else if (syncSince) {
      summary = {
        ...summary,
        syncMode: 'incremental',
        syncSince,
      };
    }

    jobId = await createBlingProductSyncJobInRepository({
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
    await recordBlingProductSyncEventInRepository({
      storeId,
      environment,
      status: 'running',
      summary: summary as unknown as Record<string, unknown>,
    });

    const categoryCache = new Map<number, string | undefined>();
    let page = 1;
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

    const getCategoryName = async (categoryId: number) => {
      if (categoryCache.has(categoryId)) {
        return categoryCache.get(categoryId);
      }

      try {
        const response = await request<BlingProductCategoryResponse>(
          `/categorias/produtos/${categoryId}`
        );
        const categoryName = response.data?.descricao?.trim() || undefined;
        categoryCache.set(categoryId, categoryName);
        return categoryName;
      } catch {
        categoryCache.set(categoryId, undefined);
        return undefined;
      }
    };

    const getStockByProductId = async (product: BlingProductDetail) => {
      const productIds = getBlingProductIds(product);
      const stockByProductId = new Map<string, number>();

      if (productIds.length === 0) {
        return stockByProductId;
      }

      try {
        const response = await request<BlingStockBalanceResponse>('/estoques/saldos', {
          'idsProdutos[]': productIds,
        });

        for (const item of response.data ?? []) {
          const productId = item.produto?.id;

          if (!productId) {
            continue;
          }

          stockByProductId.set(String(productId), toStock(item.saldoVirtualTotal));
        }

        summary.stockBalancesSynced += stockByProductId.size;
      } catch {
        // Keep product sync useful even when the store lacks stock scope.
      }

      return stockByProductId;
    };

    const processProduct = async (listProduct: BlingProductDetail) => {
      if (!listProduct.id) {
        summary.productsSkipped += 1;
        summary.errors += 1;
        addDiagnostic(summary, {
          name: listProduct.nome?.trim(),
          sku: listProduct.codigo?.trim(),
          action: 'error',
          errorCode: 'missing_bling_product_id',
        });
        return;
      }

      try {
        const detailResponse = await request<BlingProductDetailResponse>(
          `/produtos/${listProduct.id}`
        );
        const product = (detailResponse.data ?? listProduct) as BlingProductDetail;
        const categoryId = product.categoria?.id;
        const categoryName = categoryId
          ? await getCategoryName(categoryId)
          : undefined;
        const stockByProductId = await getStockByProductId(product);
        const mappedProduct = mapBlingProductToCatalogInput({
          storeId,
          product,
          categoryName,
          stockByProductId,
        });
        const result = await upsertIntegrationProductInRepository(mappedProduct);

        summary.productsProcessed += 1;
        summary.variantsProcessed += mappedProduct.variants?.length ?? 1;

        if (result.action === 'created') {
          summary.productsCreated += 1;
        } else {
          summary.productsUpdated += 1;
        }

        if (result.categoryLinked) {
          summary.categoriesLinked += 1;
        } else if (product.categoria?.id && !mappedProduct.categoryWasClear) {
          summary.categoriesSkipped += 1;
        }

        if (result.categoryCreated) {
          summary.categoriesCreated += 1;
        }

        addDiagnostic(summary, {
          externalId: mappedProduct.externalId,
          name: mappedProduct.name,
          sku: mappedProduct.variant.sku,
          action: result.action,
          status: mappedProduct.status,
          category: mappedProduct.category?.name,
          categoryLinked: result.categoryLinked,
          imageFound: Boolean(mappedProduct.imageUrl),
          variants: mappedProduct.variants?.length ?? 1,
          stockItems: stockByProductId.size,
        });
      } catch (productError) {
        summary.productsSkipped += 1;
        summary.errors += 1;
        addDiagnostic(summary, {
          externalId: String(listProduct.id),
          name: listProduct.nome?.trim(),
          sku: listProduct.codigo?.trim(),
          action: 'error',
          errorCode: toSafeErrorCode(productError),
        });
      }
    };

    if (options.productId) {
      summary.pagesProcessed = 1;
      await processProduct({
        id: Number(options.productId),
      });
    } else {
      while (true) {
        const listResponse = await request<BlingProductListResponse>('/produtos', {
          pagina: page,
          limite: pageLimit,
          dataAlteracaoInicial: syncSince,
        });
        const products = Array.isArray(listResponse.data) ? listResponse.data : [];

        if (products.length === 0) {
          break;
        }

        summary.pagesProcessed += 1;

        for (const listProduct of products) {
          await processProduct(listProduct as BlingProductDetail);
        }

        if (products.length < pageLimit) {
          break;
        }

        page += 1;
      }
    }

    tokenRefreshed = client.hasRefreshedToken();
    summary = finishSummary(summary, {
      status: 'success',
      startedAtMs,
      tokenRefreshed,
    });

    await completeBlingProductSyncJobInRepository({
      jobId,
      storeId,
      status: 'success',
      summary: summary as unknown as Record<string, unknown>,
    });
    await recordBlingProductSyncEventInRepository({
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
        completeBlingProductSyncJobInRepository({
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
        recordBlingProductSyncEventInRepository({
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
