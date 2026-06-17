import type { UpsertIntegrationProductInput } from '@/modules/catalog/product.repository';

export interface BlingProductListResponse {
  data?: BlingProductListItem[];
}

export interface BlingProductDetailResponse {
  data?: BlingProductDetail;
}

export interface BlingProductCategoryResponse {
  data?: {
    id?: number;
    descricao?: string;
  };
}

export interface BlingProductListItem {
  id?: number;
  nome?: string;
  codigo?: string;
  preco?: number;
  situacao?: string;
}

export interface BlingProductDetail extends BlingProductListItem {
  formato?: string;
  descricaoCurta?: string;
  marca?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  estoque?: {
    saldoVirtualTotal?: number | string;
  };
  categoria?: {
    id?: number;
  };
  dimensoes?: {
    largura?: number;
    altura?: number;
    profundidade?: number;
    unidadeMedida?: number | string;
  };
  midia?: {
    imagens?: {
      externas?: Array<{ link?: string }>;
      internas?: Array<{ link?: string; linkMiniatura?: string }>;
    };
  };
  imagemURL?: string;
  variacoes?: BlingProductVariation[];
}

export interface BlingProductVariation extends BlingProductDetail {
  variacao?: {
    nome?: string;
  };
}

export interface BlingStockBalanceResponse {
  data?: BlingStockBalance[];
}

export interface BlingStockBalance {
  produto?: {
    id?: number;
    codigo?: string;
  };
  saldoFisicoTotal?: number | string;
  saldoVirtualTotal?: number | string;
}

export type MappedBlingProduct = UpsertIntegrationProductInput & {
  categoryWasClear: boolean;
  hasComplexVariations: boolean;
};

export interface BlingProductSyncSummary {
  status: 'success' | 'error';
  jobId?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pagesProcessed: number;
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  categoriesLinked: number;
  categoriesCreated: number;
  categoriesSkipped: number;
  errors: number;
  variantsProcessed: number;
  stockBalancesSynced: number;
  syncMode: 'full' | 'incremental';
  syncSince?: string;
  tokenRefreshed: boolean;
  errorCode?: string;
}

export interface BlingProductSyncResult {
  status: 'success' | 'error';
  environment?: string;
  summary: BlingProductSyncSummary;
  errorCode?: string;
}
