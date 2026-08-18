import 'server-only';

import {
  listIntegrationProductImageUrlsInRepository,
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
import { resolveBlingProductMedia } from './bling-product-media.service';
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

const categoryPageLimit = 100;
const productPageLimit = 40;
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

type IncrementalProductSyncResume = {
  page: number;
  syncSince?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }
  );

  await Promise.all(workers);
  return results;
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

function getIncrementalProductSyncResume(
  settings: Record<string, unknown> | undefined
) {
  const productSync = settings?.productSync;

  if (!productSync || typeof productSync !== 'object' || Array.isArray(productSync)) {
    return undefined;
  }

  const summary = (productSync as Record<string, unknown>).summary;

  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return undefined;
  }

  const resume = (summary as Record<string, unknown>).resume;

  if (!resume || typeof resume !== 'object' || Array.isArray(resume)) {
    return undefined;
  }

  const page = Number((resume as Record<string, unknown>).page);

  if (!Number.isInteger(page) || page <= 0) {
    return undefined;
  }

  const syncSince = (resume as Record<string, unknown>).syncSince;

  return {
    page,
    syncSince: typeof syncSince === 'string' && syncSince.trim() ? syncSince : undefined,
  } satisfies IncrementalProductSyncResume;
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
  options: {
    mode?: 'full' | 'incremental';
    productId?: string;
    page?: number;
  } = {}
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
    const storedResume =
      options.mode !== 'full' && !options.productId
        ? getIncrementalProductSyncResume(integration?.settings)
        : undefined;
    const syncSince =
      options.mode === 'full' || options.productId
        ? undefined
        : storedResume?.syncSince ?? formatBlingDateTime(integration?.lastSyncAt);

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
    const explicitPage =
      Number.isInteger(options.page) && options.page! > 0 ? options.page : undefined;
    const batchPage = !options.productId
      ? options.mode === 'full'
        ? explicitPage
        : storedResume?.page ?? explicitPage ?? 1
      : undefined;
    let page = batchPage ?? 1;
    let lastRequestAt = 0;
    let requestSchedule = Promise.resolve();

    if (batchPage) {
      summary = {
        ...summary,
        batchPage,
      };
    }

    const request = async <T>(
      path: string,
      query?: Record<string, string | number | Array<string | number> | undefined>
    ) => {
      const scheduledStart = requestSchedule.then(async () => {
        const elapsed = Date.now() - lastRequestAt;

        if (elapsed < requestIntervalMs) {
          await sleep(requestIntervalMs - elapsed);
        }

        lastRequestAt = Date.now();
      });
      requestSchedule = scheduledStart.catch(() => undefined);
      await scheduledStart;
      return activeClient.request<T>(path, { query });
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
            limite: categoryPageLimit,
          }
        );
        const items = getBlingCategoryListItems(response);
        const categoriesBeforePage = categoriesByExternalId.size;

        for (const category of flattenBlingCategories(items)) {
          if (!categoriesByExternalId.has(category.id)) {
            categoriesByExternalId.set(category.id, category);
          }
        }

        // The provider may return the first page again when pagination is
        // unavailable. Stop on a page without new IDs instead of occupying a
        // serverless function until its timeout.
        if (
          items.length === 0 ||
          items.length < categoryPageLimit ||
          categoriesByExternalId.size === categoriesBeforePage
        ) {
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

    const getStockByProducts = async (products: BlingProductDetail[]) => {
      const productIds = Array.from(
        new Set(products.flatMap((product) => getBlingProductIds(product)))
      );
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

    if (!options.productId && (!batchPage || batchPage === 1)) {
      try {
        await syncCategoriesFromBling();
      } catch {
        summary.categoriesSkipped += 1;
      }
    }

    const recordProductError = (
      listProduct: BlingProductDetail,
      errorCode: string
    ) => {
      summary.productsSkipped += 1;
      summary.errors += 1;
      addDiagnostic(summary, {
        externalId: listProduct.id ? String(listProduct.id) : undefined,
        name: listProduct.nome?.trim(),
        sku: listProduct.codigo?.trim(),
        action: 'error',
        errorCode,
      });
    };

    const processProduct = async (
      listProduct: BlingProductDetail,
      preloaded?: {
        product: BlingProductDetail;
        stockByProductId: Map<string, number>;
      }
    ) => {
      if (!listProduct.id) {
        recordProductError(listProduct, 'missing_bling_product_id');
        return;
      }

      try {
        const product = preloaded
          ? preloaded.product
          : ((
              await request<BlingProductDetailResponse>(
                `/produtos/${listProduct.id}`
              )
            ).data ?? listProduct) as BlingProductDetail;
        const categoryId = product.categoria?.id;
        const categoryName = categoryId
          ? await getCategoryName(categoryId)
          : undefined;
        const stockByProductId =
          preloaded?.stockByProductId ?? (await getStockByProducts([product]));
        const existingImageUrls = await listIntegrationProductImageUrlsInRepository({
          storeId,
          externalProvider: 'bling',
          externalId: String(product.id),
        });
        const media = await resolveBlingProductMedia({
          storeId,
          product,
          existingImageUrls,
          forceRefresh: summary.syncMode !== 'full',
        });
        const mappedProduct = mapBlingProductToCatalogInput({
          storeId,
          product,
          categoryName,
          stockByProductId,
          resolvedImageUrls: media.urls,
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
          imageFound: media.imagesFound > 0,
          imagesFound: media.imagesFound,
          imagesCopied: media.imagesCopied,
          imageErrors: media.imageErrors,
          variants: mappedProduct.variants?.length ?? 1,
          stockItems: getBlingProductIds(product).filter((productId) =>
            stockByProductId.has(String(productId))
          ).length,
        });
      } catch (productError) {
        recordProductError(listProduct, toSafeErrorCode(productError));
      }
    };

    if (options.productId) {
      summary.pagesProcessed = 1;
      await processProduct({
        id: Number(options.productId),
      });
    } else {
      const processedProductIds = new Set<number>();

      while (true) {
        const listResponse = await request<BlingProductListResponse>('/produtos', {
          pagina: page,
          limite: productPageLimit,
          dataAlteracaoInicial: syncSince,
        });
        const listedProducts = Array.isArray(listResponse.data)
          ? listResponse.data
          : [];

        if (listedProducts.length === 0) {
          if (batchPage) {
            summary.hasMore = false;
          }
          break;
        }

        summary.pagesProcessed += 1;

        const products = listedProducts.filter((product) => {
          if (!product.id || processedProductIds.has(product.id)) {
            return false;
          }

          processedProductIds.add(product.id);
          return true;
        });

        // Do not keep requesting an endpoint that is replaying a page already
        // processed in this run. This protects incremental jobs from timing
        // out without falsely marking duplicate products as failures.
        if (products.length === 0) {
          if (batchPage) {
            summary.hasMore = false;
          }
          break;
        }

        const loadedProducts = (await mapWithConcurrency(
          products,
          3,
          async (rawListProduct) => {
            const listProduct = rawListProduct as BlingProductDetail;

            if (!listProduct.id) {
              recordProductError(listProduct, 'missing_bling_product_id');
              return undefined;
            }

            try {
              const detailResponse = await request<BlingProductDetailResponse>(
                `/produtos/${listProduct.id}`
              );
              return {
                listProduct,
                product: (detailResponse.data ?? listProduct) as BlingProductDetail,
              };
            } catch (productError) {
              recordProductError(listProduct, toSafeErrorCode(productError));
              return undefined;
            }
          }
        )).filter((loadedProduct): loadedProduct is {
          listProduct: BlingProductDetail;
          product: BlingProductDetail;
        } => Boolean(loadedProduct));

        const stockByProductId = await getStockByProducts(
          loadedProducts.map(({ product }) => product)
        );

        // Product details and balances above are fetched with a provider-safe
        // request cadence. Persist the already-resolved records with bounded
        // concurrency so a large incremental page does not spend most of a
        // serverless invocation waiting on independent database round trips.
        await mapWithConcurrency(loadedProducts, 3, async (loadedProduct) => {
          await processProduct(loadedProduct.listProduct, {
            product: loadedProduct.product,
            stockByProductId,
          });
        });

        if (batchPage) {
          summary.hasMore = listedProducts.length === productPageLimit;
          break;
        }

        if (listedProducts.length < productPageLimit) {
          break;
        }

        page += 1;
      }
    }

    if (batchPage && summary.hasMore === true && options.mode !== 'full') {
      summary.resume = {
        page: batchPage + 1,
        syncSince,
      };
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
      updateLastSyncAt: summary.hasMore !== true,
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
