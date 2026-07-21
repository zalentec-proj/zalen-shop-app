import type { UpsertIntegrationProductInput } from '@/modules/catalog/product.repository';

export interface BlingProductListResponse {
  data?: BlingProductListItem[];
}

export interface BlingProductDetailResponse {
  data?: BlingProductDetail;
}

export interface BlingProductCategoryResponse {
  data?: BlingProductCategoryItem;
}

export interface BlingProductCategoryListResponse {
  data?: BlingProductCategoryItem[];
  categorias?: BlingProductCategoryItem[];
}

export interface BlingProductCategoryItem {
  id?: number;
  codigo?: number;
  idCategoria?: number;
  descricao?: string;
  nome?: string;
  name?: string;
  categoriaPai?: { id?: number } | number;
  idCategoriaPai?: number;
  filhos?: BlingProductCategoryItem[];
  subcategorias?: BlingProductCategoryItem[];
  categorias?: BlingProductCategoryItem[];
  __inheritedParentId?: number;
}

export interface BlingProductListItem {
  id?: number;
  nome?: string;
  codigo?: string;
  preco?: number;
  situacao?: string | number | boolean;
}

export interface BlingProductImageItem {
  link?: string;
  linkMiniatura?: string;
  url?: string;
  imagemURL?: string;
  imageUrl?: string;
}

export interface BlingProductDetail extends BlingProductListItem {
  formato?: string;
  descricaoCurta?: string;
  marca?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  freteGratis?: boolean;
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
      externas?: BlingProductImageItem[];
      internas?: BlingProductImageItem[];
      imagens?: BlingProductImageItem[];
    };
  };
  imagemURL?: string;
  imagemUrl?: string;
  imageUrl?: string;
  urlImagem?: string;
  imagem?: BlingProductImageItem;
  imagens?: BlingProductImageItem[];
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

export interface BlingProductSyncDiagnostic {
  externalId?: string;
  name?: string;
  sku?: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  status?: string;
  category?: string;
  categoryLinked?: boolean;
  imageFound?: boolean;
  variants?: number;
  stockItems?: number;
  errorCode?: string;
}

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
  categoriesSynced: number;
  categoriesLinked: number;
  categoriesCreated: number;
  categoriesSkipped: number;
  errors: number;
  variantsProcessed: number;
  stockBalancesSynced: number;
  syncMode: 'full' | 'incremental' | 'single';
  syncSince?: string;
  syncProductId?: string;
  tokenRefreshed: boolean;
  errorCode?: string;
  diagnostics: BlingProductSyncDiagnostic[];
}

export interface BlingProductSyncResult {
  status: 'success' | 'error';
  environment?: string;
  summary: BlingProductSyncSummary;
  errorCode?: string;
}
