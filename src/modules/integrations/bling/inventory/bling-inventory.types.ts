export interface BlingInventorySyncDiagnostic {
  externalId?: string;
  sku?: string;
  previousStock?: number;
  nextStock?: number;
  action: 'updated' | 'skipped' | 'error';
  errorCode?: string;
}

export interface BlingInventorySyncSummary {
  status: 'success' | 'error';
  jobId?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  variantsProcessed: number;
  variantsUpdated: number;
  variantsSkipped: number;
  stockBalancesSynced: number;
  errors: number;
  tokenRefreshed: boolean;
  errorCode?: string;
  diagnostics: BlingInventorySyncDiagnostic[];
}

export interface BlingInventorySyncResult {
  status: 'success' | 'error';
  environment?: string;
  summary: BlingInventorySyncSummary;
  errorCode?: string;
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
