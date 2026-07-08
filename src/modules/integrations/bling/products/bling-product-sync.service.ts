import 'server-only';

import {
  upsertIntegrationCategoryInRepository,
  upsertIntegrationProductInRepository,
} from '@/modules/catalog/product.repository';
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
  BlingProductCategoryItem,
  BlingProductCategoryListResponse,
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
const rootBlingCategoryParentId = 0;
const incrementalOverlapMs = 5 * 60 * 1000;
const blingDateTimeFormatTimeZone = 'America/Sao_Paulo';

type FlattenedBlingProductCategory = {
  id: number;
  name: string;
  parentId?: number;
};

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
    categoriesSynced: 0,
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

function formatBlingDateTime(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const safeDate = new Date(date.getTime() - incrementalOverlapMs);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: blingDateTimeFormatTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
    .formatToParts(safeDate)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }

      return acc;
    }, {});
  const year = parts.year ?? '1970';
  const month = parts.month ?? '01';
  const day = parts.day ?? '01';
  const hour = parts.hour ?? '00';
  const minute = parts.minute ?? '00';
  const second = parts.second ?? '00';

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getBlingCategoryId(category: BlingProductCategoryItem) {
  return category.id ?? category.codigo ?? category.idCategoria;
}

function getBlingCategoryName(category: BlingProductCategoryItem) {
  return (category.descricao ?? category.nome ?? category.name)?.trim();
}

function getBlingCategoryParentId(category: BlingProductCategoryItem) {
  if (category.__inheritedParentId !== undefined) {
    return category.__inheritedParentId;
  }

  if (typeof category.categoriaPai === 'number') {
    return category.categoriaPai;
  }

  if (category.categoriaPai?.id !== undefined) {
    return category.categoriaPai.id;
  }

  return category.idCategoriaPai ?? rootBlingCategoryParentId;
}

function getBlingCategoryChildren(category: BlingProductCategoryItem) {
  return category.filhos ?? category.subcategorias ?? category.categorias ?? [];
}

function getBlingCategoryListItems(response: BlingProductCategoryListResponse) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.categorias)) {
    return response.categorias;
  }

  return [];
}

function flattenBlingCategories(
  items: BlingProductCategoryItem[],
  inheritedParentId = rootBlingCategoryParentId
) {
  const flattened: FlattenedBlingProductCategory[] = [];

  for (const item of items) {
    const id = getBlingCategoryId(item);
    const name = getBlingCategoryName(item);
    const explicitParentId = getBlingCategoryParentId(item);
    const parentId =
      explicitParentId !== rootBlingCategoryParentId
        ? explicitParentId
        : inheritedParentId;

    if (id && name) {
      flattened.push({
        id,
        name,
        parentId:
          parentId !== rootBlingCategoryParentId && parentId !== id
            ? parentId
            : undefined,
      });
    }

    const children = getBlingCategoryChildren(item);

    if (children.length > 0) {
      flattened.push(
        ...flattenBlingCategories(children, id ?? parentId)
      );
    }
  }

  const seen = new Set<number>();
  return flattened.filter((category) => {
    if (seen.has(category.id)) {
      return false;
    }

    seen.add(category.id);
    return true;
  });
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
      options.mode === 'full' || options.productId
        ? undefined
        : formatBlingDateTime(integration?.lastSyncAt);

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

    const syncCategoriesFromBling = async () => {
      const categoriesByExternalId = new Map<number, FlattenedBlingProductCategory>();
      let categoryPage = 1;

      while (true) {
        const response = await request<BlingProductCategoryListResponse>(
          '/categorias/produtos',
          {
            pagina: categoryPage,
            limite: pageLimit,
          }
        );
        const items = getBlingCategoryListItems(response);

        for (const category of flattenBlingCategories(items)) {
          if (!categoriesByExternalId.has(category.id)) {
            categoriesByExternalId.set(category.id, category);
          }
        }

        if (items.length === 0 || items.length < pageLimit) {
          break;
        }

        categoryPage += 1;
      }

      const pending = Array.from(categoriesByExternalId.values());
      const localIdByExternalId = new Map<number, string>();

      while (pending.length > 0) {
        const nextIndex = pending.findIndex(
          (category) =>
            !category.parentId || localIdByExternalId.has(category.parentId)
        );
        const [category] = pending.splice(nextIndex >= 0 ? nextIndex : 0, 1);
        const parentId = category.parentId
          ? localIdByExternalId.get(category.parentId) ?? null
          : null;
        const result = await upsertIntegrationCategoryInRepository({
          storeId,
          category: {
            externalId: `bling:${category.id}`,
            name: category.name,
            parentId,
          },
        });

        localIdByExternalId.set(category.id, result.id);
        categoryCache.set(category.id, category.name);
        summary.categoriesSynced += 1;

        if (result.created) {
          summary.categoriesCreated += 1;
        }
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

    try {
      await syncCategoriesFromBling();
    } catch {
      summary.categoriesSkipped += 1;
    }

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
