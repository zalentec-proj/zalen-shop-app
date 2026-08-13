export type BlingEnvironment = 'sandbox' | 'production';

export type BlingConnectionStatus =
  | 'planned'
  | 'pending_credentials'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface BlingProduct {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  situacao: 'A' | 'I';
}

export interface BlingOrder {
  id: number;
  numero: string;
  situacao: string;
  total: number;
}

export interface BlingWebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

export interface BlingConnectionConfig {
  storeId: string;
  /** Nunca expor no frontend */
  accessToken?: never;
  /** Nunca expor no frontend */
  refreshToken?: never;
}

export interface BlingOAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  environment: BlingEnvironment;
  isConfigured: boolean;
  isEncryptionConfigured: boolean;
}

export interface BlingTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  receivedAt: string;
}

export interface BlingAdminState {
  providerKey: 'bling';
  status: BlingConnectionStatus;
  environment: BlingEnvironment | string;
  lastSyncAt?: string;
  lastUpdatedAt?: string;
  isOAuthConfigured: boolean;
  isEncryptionConfigured: boolean;
  canStartOAuth: boolean;
  connectPath: string;
  warnings: string[];
  homologation?: {
    status: 'running' | 'success' | 'error';
    updatedAt?: string;
    summary?: {
      status?: 'success' | 'error';
      durationMs?: number;
      tokenRefreshed?: boolean;
      productId?: number;
      errorCode?: string;
      steps?: Array<{
        key?: string;
        status?: 'pending' | 'success' | 'error';
        statusCode?: number;
        errorCode?: string;
      }>;
    };
  };
  productSync?: {
    status: 'running' | 'success' | 'error';
    updatedAt?: string;
    summary?: {
      status?: 'success' | 'error';
      jobId?: string;
      startedAt?: string;
      finishedAt?: string;
      durationMs?: number;
      pagesProcessed?: number;
      productsProcessed?: number;
      productsCreated?: number;
      productsUpdated?: number;
      productsSkipped?: number;
      categoriesSynced?: number;
      categoriesLinked?: number;
      categoriesCreated?: number;
      categoriesSkipped?: number;
      errors?: number;
      variantsProcessed?: number;
      stockBalancesSynced?: number;
      syncMode?: 'full' | 'incremental' | 'single';
      batchPage?: number;
      hasMore?: boolean;
      syncSince?: string;
      syncProductId?: string;
      tokenRefreshed?: boolean;
      errorCode?: string;
      diagnostics?: Array<{
        externalId?: string;
        name?: string;
        sku?: string;
        action?: 'created' | 'updated' | 'skipped' | 'error';
        status?: string;
        category?: string;
        categoryLinked?: boolean;
        imageFound?: boolean;
        variants?: number;
        stockItems?: number;
        errorCode?: string;
      }>;
    };
  };
  inventorySync?: {
    status: 'running' | 'success' | 'error';
    updatedAt?: string;
    summary?: {
      status?: 'success' | 'error';
      jobId?: string;
      startedAt?: string;
      finishedAt?: string;
      durationMs?: number;
      variantsProcessed?: number;
      variantsUpdated?: number;
      variantsSkipped?: number;
      stockBalancesSynced?: number;
      errors?: number;
      tokenRefreshed?: boolean;
      errorCode?: string;
      diagnostics?: Array<{
        externalId?: string;
        sku?: string;
        previousStock?: number;
        nextStock?: number;
        action?: 'updated' | 'skipped' | 'error';
        errorCode?: string;
      }>;
    };
  };
  orderSend: {
    enabled: boolean;
    status?: 'running' | 'success' | 'error';
    updatedAt?: string;
    summary?: {
      status?: 'success' | 'error' | 'skipped';
      jobId?: string;
      orderId?: string;
      orderNumber?: string;
      externalId?: string;
      errorCode?: string;
      tokenRefreshed?: boolean;
      durationMs?: number;
      draft?: {
        customerPresent?: boolean;
        documentPresent?: boolean;
        phonePresent?: boolean;
        addressPresent?: boolean;
        itemCount?: number;
        total?: number;
      };
    };
  };
  webhooks: {
    received: number;
    pending: number;
    error: number;
    lastReceivedAt?: string;
  };
}
