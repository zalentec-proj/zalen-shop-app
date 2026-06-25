import type { Order } from '@/modules/orders/order.types';
import type { StoreIntegrationStatus } from '@/modules/integrations/core/store-integration.types';

export type PaymentMethod = 'mercado_pago_checkout_pro';

export type MercadoPagoRuntimeStatus =
  | 'connected'
  | 'pending_credentials'
  | 'disconnected'
  | 'expired'
  | 'error'
  | 'disabled';

export type MercadoPagoEnvironment = 'test' | 'production';
export type MercadoPagoCredentialsSource = 'oauth' | 'env';

export interface PaymentIntent {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

export interface PaymentResult {
  externalId: string;
  status: 'pending' | 'approved' | 'rejected' | 'created';
  checkoutUrl?: string;
}

export interface MercadoPagoCheckoutPreferenceInput {
  order: Order;
  baseUrl: string;
}

export interface MercadoPagoOAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  isConfigured: boolean;
  isEncryptionConfigured: boolean;
}

export interface MercadoPagoOAuthState {
  storeId: string;
  environment: MercadoPagoEnvironment;
  nonce: string;
  returnTo: string;
  expiresAt: number;
}

export interface MercadoPagoOAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  userId?: string;
  publicKey?: string;
  liveMode?: boolean;
  receivedAt: string;
  expiresAt?: string;
}

export interface MercadoPagoCredentials extends MercadoPagoOAuthTokenResponse {
  provider: 'mercado_pago';
  environment: MercadoPagoEnvironment;
}

export interface MercadoPagoConnectedAccount {
  userId?: string;
  email?: string;
  nickname?: string;
  publicKey?: string;
  liveMode?: boolean;
}

export interface MercadoPagoRuntimeState {
  provider: 'mercado_pago';
  checkoutMode: 'checkout_pro';
  credentialsSource: MercadoPagoCredentialsSource;
  status: MercadoPagoRuntimeStatus;
  enabled: boolean;
  configured: boolean;
  environment: MercadoPagoEnvironment;
  missingEnv: string[];
  integrationStatus?: StoreIntegrationStatus;
  connectedAt?: string;
  tokenExpiresAt?: string;
  lastUpdatedAt?: string;
  account?: MercadoPagoConnectedAccount;
  warnings: string[];
}

export interface MercadoPagoCheckoutPreferenceResult {
  provider: 'mercado_pago';
  preferenceId: string;
  checkoutUrl: string;
  initPoint?: string;
  sandboxInitPoint?: string;
}

export interface MercadoPagoPaymentLookupResult {
  id: string;
  status?: string;
  statusDetail?: string;
  externalReference?: string;
  transactionAmount?: number;
  currencyId?: string;
  liveMode?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MercadoPagoEnvironmentAdminState {
  environment: MercadoPagoEnvironment;
  status: MercadoPagoRuntimeStatus;
  enabled: boolean;
  configured: boolean;
  credentialsSource: MercadoPagoCredentialsSource;
  integrationStatus?: StoreIntegrationStatus;
  account?: MercadoPagoConnectedAccount;
  connectedAt?: string;
  tokenExpiresAt?: string;
  lastUpdatedAt?: string;
  canStartOAuth: boolean;
  canTestConnection: boolean;
  connectPath: string;
  warnings: string[];
}

export interface MercadoPagoAdminState {
  providerKey: 'mercado_pago';
  isOAuthConfigured: boolean;
  isEncryptionConfigured: boolean;
  warnings: string[];
  environments: MercadoPagoEnvironmentAdminState[];
}
