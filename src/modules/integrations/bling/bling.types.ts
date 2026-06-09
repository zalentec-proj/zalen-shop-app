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
      categoriesLinked?: number;
      categoriesCreated?: number;
      categoriesSkipped?: number;
      errors?: number;
      tokenRefreshed?: boolean;
      errorCode?: string;
    };
  };
}
