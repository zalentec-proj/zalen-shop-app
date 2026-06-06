import type { BlingEnvironment, BlingTokenResponse } from '../bling.types';

export type BlingHomologationStepKey =
  | 'get_product'
  | 'post_product'
  | 'put_product'
  | 'patch_product_situation'
  | 'delete_product';

export type BlingHomologationStepStatus = 'pending' | 'success' | 'error';

export interface BlingHomologationCredentials {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  scope?: string;
  expiresIn?: number;
  receivedAt?: string;
}

export interface BlingHomologationStepResult {
  key: BlingHomologationStepKey;
  label: string;
  status: BlingHomologationStepStatus;
  statusCode?: number;
  errorCode?: string;
}

export interface BlingHomologationResult {
  status: 'success' | 'error';
  environment: BlingEnvironment;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  productId?: number;
  tokenRefreshed: boolean;
  steps: BlingHomologationStepResult[];
  errorCode?: string;
}

export interface BlingHomologationClientInput {
  accessToken: string;
  refreshToken: string;
  onTokensRefreshed: (tokens: BlingTokenResponse) => Promise<void>;
}
