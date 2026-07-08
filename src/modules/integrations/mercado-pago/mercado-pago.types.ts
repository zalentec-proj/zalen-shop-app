import type { Order } from '@/modules/orders/order.types';
import type { StoreIntegrationStatus } from '@/modules/integrations/core/store-integration.types';

export type PaymentMethod =
  | 'mercado_pago_checkout_pro'
  | 'mercado_pago_payment_brick';

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
  checkoutMode: 'checkout_pro' | 'payment_brick';
  credentialsSource: MercadoPagoCredentialsSource;
  status: MercadoPagoRuntimeStatus;
  enabled: boolean;
  configured: boolean;
  publicKeyConfigured: boolean;
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
  environment: MercadoPagoEnvironment;
  credentialsSource: MercadoPagoCredentialsSource;
  publicKey?: string;
}

export interface MercadoPagoBrickPaymentFormData {
  token?: string;
  issuer_id?: string | number;
  payment_method_id?: string;
  payment_type_id?: string;
  payment_method_option_id?: string | null;
  processing_mode?: string | null;
  installments?: number | string;
  transaction_amount?: number | string;
  description?: string;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type?: string;
      number?: string;
    };
    address?: Record<string, unknown>;
  };
  transaction_details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface MercadoPagoBrickPaymentResult {
  id: string;
  status?: string;
  statusDetail?: string;
  paymentMethodId?: string;
  paymentTypeId?: string;
  transactionAmount?: number;
  paymentInstructions?: MercadoPagoPaymentInstructions;
}

export interface MercadoPagoPaymentLookupResult {
  id: string;
  status?: string;
  statusDetail?: string;
  externalReference?: string;
  transactionAmount?: number;
  currencyId?: string;
  liveMode?: boolean;
  paymentMethodId?: string;
  paymentTypeId?: string;
  metadata?: Record<string, unknown>;
  paymentInstructions?: MercadoPagoPaymentInstructions;
}

export interface MercadoPagoPaymentInstructions {
  pix?: {
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    expiresAt?: string;
  };
  externalResourceUrl?: string;
}

export interface MercadoPagoEnvironmentAdminState {
  environment: MercadoPagoEnvironment;
  status: MercadoPagoRuntimeStatus;
  enabled: boolean;
  configured: boolean;
  publicKeyConfigured: boolean;
  active: boolean;
  canActivate: boolean;
  activationBlockedReason?: string;
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
  activeEnvironment: MercadoPagoEnvironment;
  activeEnvironmentUpdatedAt?: string;
  activeEnvironmentUpdatedBy?: string;
  warnings: string[];
  environments: MercadoPagoEnvironmentAdminState[];
}
