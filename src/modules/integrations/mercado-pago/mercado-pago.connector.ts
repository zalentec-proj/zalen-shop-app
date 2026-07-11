import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import { upsertPaymentTransaction } from '@/modules/payments/payment-transaction.repository';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from '@/modules/integrations/core/credential-vault';
import {
  getDefaultMercadoPagoEnvironment,
  getMercadoPagoOAuthConfig,
  getMercadoPagoWebhookSecret,
} from './mercado-pago.config';
import {
  buildMercadoPagoBrickPaymentPayload,
  MercadoPagoPaymentPayloadError,
} from './mercado-pago-payment-payload';
import { refreshMercadoPagoAccessToken } from './mercado-pago.oauth';
import {
  getMercadoPagoIntegrationFromRepository,
  getMercadoPagoStorePreferenceFromRepository,
  saveMercadoPagoRefreshedCredentialsInRepository,
} from './mercado-pago.repository';
import type {
  MercadoPagoBrickPaymentFormData,
  MercadoPagoBrickPaymentResult,
  MercadoPagoCredentials,
  MercadoPagoCredentialsSource,
  MercadoPagoCheckoutPreferenceInput,
  MercadoPagoCheckoutPreferenceResult,
  MercadoPagoEnvironment,
  MercadoPagoPaymentInstructions,
  MercadoPagoPaymentLookupResult,
  MercadoPagoRuntimeState,
  PaymentIntent,
  PaymentResult,
} from './mercado-pago.types';

interface MercadoPagoPreferenceResponse {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MercadoPagoPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number | string;
  currency_id?: string;
  live_mode?: boolean;
  metadata?: unknown;
  payment_method_id?: string;
  payment_type_id?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
      expires_at?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string;
  };
  date_of_expiration?: string;
}

export class MercadoPagoPreferenceError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string
  ) {
    super('mercado_pago_preference_create_failed');
  }
}

export class MercadoPagoPaymentLookupError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string
  ) {
    super('mercado_pago_payment_lookup_failed');
  }
}

interface MercadoPagoAccessContext {
  accessToken: string;
  publicKey?: string;
  environment: MercadoPagoEnvironment;
  credentialsSource: MercadoPagoCredentialsSource;
}

function getLegacyEnvFallbackAccessToken(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
}) {
  const env = getServerEnv();

  if (input.storeId !== ACTIVE_STORE_ID) {
    return undefined;
  }

  if (input.environment !== getDefaultMercadoPagoEnvironment()) {
    return undefined;
  }

  return env.MERCADO_PAGO_ACCESS_TOKEN;
}

function getLegacyEnvFallbackPublicKey(input: {
  storeId: string;
  environment: MercadoPagoEnvironment;
}) {
  const env = getServerEnv();

  if (input.storeId !== ACTIVE_STORE_ID) {
    return undefined;
  }

  if (input.environment !== getDefaultMercadoPagoEnvironment()) {
    return undefined;
  }

  return env.MERCADO_PAGO_PUBLIC_KEY;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function getDocumentType(document: string | undefined) {
  const digits = document?.replace(/\D/g, '') ?? '';

  if (digits.length === 14) {
    return 'CNPJ';
  }

  if (digits.length === 11) {
    return 'CPF';
  }

  return undefined;
}

function splitName(fullName: string | undefined) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const name = parts.shift();
  const surname = parts.join(' ');

  return {
    name,
    surname: surname || undefined,
  };
}

function splitPhone(phone: string | undefined) {
  const digits = phone?.replace(/\D/g, '') ?? '';

  if (digits.length < 10) {
    return undefined;
  }

  return {
    area_code: digits.slice(0, 2),
    number: digits.slice(2),
  };
}

function shouldUseSandboxUrl(environment: MercadoPagoEnvironment) {
  return environment === 'test';
}

function canUseAutoReturn(url: string) {
  return url.startsWith('https://');
}

function toNumber(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getMercadoPagoPaymentInstructions(
  payment: MercadoPagoPaymentResponse
): MercadoPagoPaymentInstructions | undefined {
  const transactionData = payment.point_of_interaction?.transaction_data;
  const pix =
    transactionData?.qr_code ||
    transactionData?.qr_code_base64 ||
    transactionData?.ticket_url
      ? {
          qrCode: transactionData.qr_code,
          qrCodeBase64: transactionData.qr_code_base64,
          ticketUrl: transactionData.ticket_url,
          expiresAt: transactionData.expires_at,
        }
      : undefined;
  const externalResourceUrl =
    payment.transaction_details?.external_resource_url;

  if (!pix && !externalResourceUrl) {
    return undefined;
  }

  return {
    pix,
    externalResourceUrl,
    expiresAt: payment.date_of_expiration,
  };
}

function isCheckoutEnabled(settings: Record<string, unknown> | undefined) {
  const checkoutPro = toRecord(settings?.checkoutPro);

  return checkoutPro?.enabled !== false;
}

function toCredentialsSource(
  value: unknown,
  fallback: MercadoPagoCredentialsSource
): MercadoPagoCredentialsSource {
  return value === 'oauth' || value === 'env' ? value : fallback;
}

function isTokenExpiringSoon(expiresAt: string | undefined) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function toConnectedAccount(settings: Record<string, unknown> | undefined) {
  const account = toRecord(settings?.account);

  if (!account) {
    return undefined;
  }

  return {
    userId: toOptionalString(account.userId),
    email: toOptionalString(account.email),
    nickname: toOptionalString(account.nickname),
    publicKey: toOptionalString(account.publicKey),
    liveMode: toOptionalBoolean(account.liveMode),
  };
}

function getPublicKeyFromIntegration(input: {
  integration?: Awaited<ReturnType<typeof getMercadoPagoIntegrationFromRepository>>;
  credentials?: MercadoPagoCredentials;
}) {
  return (
    input.credentials?.publicKey ??
    toConnectedAccount(input.integration?.settings)?.publicKey
  );
}

function toRuntimeStatus(input: {
  enabled: boolean;
  credentialsEncrypted?: string;
  integrationStatus?: string;
  tokenExpiresAt?: string;
}) {
  if (!input.enabled || input.integrationStatus === 'disabled') {
    return 'disabled' as const;
  }

  if (input.integrationStatus === 'error') {
    return 'error' as const;
  }

  if (input.integrationStatus === 'disconnected') {
    return 'disconnected' as const;
  }

  if (input.credentialsEncrypted) {
    return input.tokenExpiresAt &&
      new Date(input.tokenExpiresAt).getTime() < Date.now()
      ? ('expired' as const)
      : ('connected' as const);
  }

  return 'pending_credentials' as const;
}

function mergeRefreshedCredentials(input: {
  current: MercadoPagoCredentials;
  refreshed: Omit<MercadoPagoCredentials, 'provider' | 'environment'>;
}): MercadoPagoCredentials {
  return {
    ...input.current,
    accessToken: input.refreshed.accessToken,
    refreshToken: input.refreshed.refreshToken ?? input.current.refreshToken,
    tokenType: input.refreshed.tokenType ?? input.current.tokenType,
    scope: input.refreshed.scope ?? input.current.scope,
    expiresIn: input.refreshed.expiresIn,
    receivedAt: input.refreshed.receivedAt,
    expiresAt: input.refreshed.expiresAt,
    userId: input.refreshed.userId ?? input.current.userId,
    publicKey: input.refreshed.publicKey ?? input.current.publicKey,
    liveMode: input.refreshed.liveMode ?? input.current.liveMode,
  };
}

export async function getMercadoPagoAccessContext(input: {
  storeId: string;
  environment?: MercadoPagoEnvironment;
}): Promise<MercadoPagoAccessContext> {
  const environment =
    input.environment ?? (await getMercadoPagoActiveEnvironment(input.storeId));
  const integration = await getMercadoPagoIntegrationFromRepository({
    storeId: input.storeId,
    environment,
  });

  if (integration?.status === 'connected' && integration.credentialsEncrypted) {
    let credentials =
      decryptIntegrationCredentials<MercadoPagoCredentials>(
        integration.credentialsEncrypted
      );

    if (isTokenExpiringSoon(credentials.expiresAt) && credentials.refreshToken) {
      const refreshed = await refreshMercadoPagoAccessToken({
        config: getMercadoPagoOAuthConfig(),
        refreshToken: credentials.refreshToken,
      });
      credentials = mergeRefreshedCredentials({
        current: credentials,
        refreshed,
      });

      await saveMercadoPagoRefreshedCredentialsInRepository({
        storeId: input.storeId,
        environment,
        credentialsEncrypted: encryptIntegrationCredentials(credentials),
        tokenExpiresAt: credentials.expiresAt,
        scope: credentials.scope,
      });
    }

    return {
      accessToken: credentials.accessToken,
      publicKey: getPublicKeyFromIntegration({
        integration,
        credentials,
      }),
      environment,
      credentialsSource: 'oauth',
    };
  }

  if (integration?.status === 'disabled' || integration?.status === 'disconnected') {
    throw new Error('mercado_pago_disabled');
  }

  const legacyAccessToken = getLegacyEnvFallbackAccessToken({
    storeId: input.storeId,
    environment,
  });

  if (legacyAccessToken) {
    return {
      accessToken: legacyAccessToken,
      publicKey: getLegacyEnvFallbackPublicKey({
        storeId: input.storeId,
        environment,
      }),
      environment,
      credentialsSource: 'env',
    };
  }

  throw new Error('mercado_pago_not_configured');
}

export async function getMercadoPagoActiveEnvironment(
  storeId: string
): Promise<MercadoPagoEnvironment> {
  const preference = await getMercadoPagoStorePreferenceFromRepository(storeId);

  return preference.activeEnvironment;
}

export async function getMercadoPagoRuntimeState(
  storeId: string,
  environment?: MercadoPagoEnvironment
): Promise<MercadoPagoRuntimeState> {
  const activeEnvironment =
    environment ?? (await getMercadoPagoActiveEnvironment(storeId));
  const mercadoPagoIntegration = await getMercadoPagoIntegrationFromRepository({
    storeId,
    environment: activeEnvironment,
  });
  const enabled =
    mercadoPagoIntegration?.status !== 'disabled' &&
    mercadoPagoIntegration?.status !== 'disconnected' &&
    isCheckoutEnabled(mercadoPagoIntegration?.settings);
  const legacyFallbackConfigured = Boolean(
    getLegacyEnvFallbackAccessToken({ storeId, environment: activeEnvironment })
  );
  const oauthConfigured = Boolean(mercadoPagoIntegration?.credentialsEncrypted);
  const missingEnv = [
    !oauthConfigured && !legacyFallbackConfigured
      ? 'Mercado Pago OAuth por loja'
      : undefined,
    getMercadoPagoWebhookSecret(activeEnvironment)
      ? undefined
      : activeEnvironment === 'production'
        ? 'MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION'
        : 'MERCADO_PAGO_WEBHOOK_SECRET_TEST',
  ].filter((value): value is string => Boolean(value));
  const configured = enabled && (oauthConfigured || legacyFallbackConfigured);
  const tokenExpiresAt = toOptionalString(
    mercadoPagoIntegration?.settings.tokenExpiresAt
  );
  const status = toRuntimeStatus({
    enabled,
    credentialsEncrypted: mercadoPagoIntegration?.credentialsEncrypted,
    integrationStatus: mercadoPagoIntegration?.status,
    tokenExpiresAt,
  });
  const credentialsSource = oauthConfigured
    ? 'oauth'
    : toCredentialsSource(
        mercadoPagoIntegration?.settings.credentialsSource,
        legacyFallbackConfigured ? 'env' : 'oauth'
      );
  const account = toConnectedAccount(mercadoPagoIntegration?.settings);
  const publicKeyConfigured = Boolean(
    account?.publicKey ||
      getLegacyEnvFallbackPublicKey({
        storeId,
        environment: activeEnvironment,
      })
  );
  const warnings: string[] = [];

  if (!enabled) {
    warnings.push('Mercado Pago desativado para a loja ativa.');
  }

  if (missingEnv.length > 0) {
    warnings.push('Configuração server-side do Mercado Pago pendente.');
  }

  return {
    provider: 'mercado_pago',
    checkoutMode: publicKeyConfigured ? 'payment_brick' : 'checkout_pro',
    credentialsSource,
    status:
      configured && status === 'pending_credentials' ? 'connected' : status,
    enabled,
    configured,
    publicKeyConfigured,
    environment: activeEnvironment,
    missingEnv,
    integrationStatus: mercadoPagoIntegration?.status,
    connectedAt: toOptionalString(mercadoPagoIntegration?.settings.connectedAt),
    tokenExpiresAt,
    lastUpdatedAt: mercadoPagoIntegration?.updatedAt,
    account,
    warnings,
  };
}

export async function ensureMercadoPagoCheckoutReady(storeId: string) {
  const state = await getMercadoPagoRuntimeState(storeId);

  if (!state.enabled) {
    throw new Error('mercado_pago_disabled');
  }

  if (!state.configured) {
    throw new Error('mercado_pago_not_configured');
  }

  return state;
}

async function getMercadoPagoErrorReason(response: Response) {
  let reason = 'unknown';

  try {
    const errorBody = (await response.json()) as {
      message?: unknown;
      error?: unknown;
      cause?: Array<{ code?: unknown; description?: unknown }>;
    };
    const firstCause = errorBody.cause?.[0];
    const safeMessage =
      typeof firstCause?.code === 'string'
        ? firstCause.code
        : typeof firstCause?.description === 'string'
          ? firstCause.description
          : typeof errorBody.message === 'string'
            ? errorBody.message
            : typeof errorBody.error === 'string'
              ? errorBody.error
              : undefined;

    reason = safeMessage?.slice(0, 120) ?? reason;
  } catch {
    reason = 'invalid_error_response';
  }

  return reason;
}

async function createPreferenceOnMercadoPago(
  body: Record<string, unknown>,
  accessToken: string
): Promise<MercadoPagoPreferenceResponse> {
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await getMercadoPagoErrorReason(response);
    throw new MercadoPagoPreferenceError(response.status, reason);
  }

  return (await response.json()) as MercadoPagoPreferenceResponse;
}

async function createPaymentOnMercadoPago(input: {
  body: Record<string, unknown>;
  accessToken: string;
  idempotencyKey: string;
}): Promise<MercadoPagoPaymentResponse> {
  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify(input.body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await getMercadoPagoErrorReason(response);
    throw new MercadoPagoPreferenceError(response.status, reason);
  }

  return (await response.json()) as MercadoPagoPaymentResponse;
}

export async function createCheckoutPreference(
  input: MercadoPagoCheckoutPreferenceInput
): Promise<MercadoPagoCheckoutPreferenceResult> {
  const state = await ensureMercadoPagoCheckoutReady(input.order.storeId);
  const accessContext = await getMercadoPagoAccessContext({
    storeId: input.order.storeId,
    environment: state.environment,
  });

  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const { order } = input;
  const documentType = getDocumentType(order.customer?.document);
  const documentNumber = order.customer?.document?.replace(/\D/g, '');
  const payerName = splitName(order.customer?.name);
  const phone = splitPhone(order.customer?.phone);
  const notificationUrl = baseUrl.startsWith('https://')
    ? (() => {
        const url = new URL('/api/webhooks/mercado-pago', baseUrl);
        url.searchParams.set('store_id', order.storeId);
        url.searchParams.set('environment', accessContext.environment);
        return url.toString();
      })()
    : undefined;
  const backUrls = {
    success: `${baseUrl}/pagamento/mercado-pago/sucesso?order=${order.id}&environment=${accessContext.environment}`,
    pending: `${baseUrl}/pagamento/mercado-pago/pendente?order=${order.id}&environment=${accessContext.environment}`,
    failure: `${baseUrl}/pagamento/mercado-pago/falha?order=${order.id}&environment=${accessContext.environment}`,
  };

  const body = {
    external_reference: order.id,
    auto_return: canUseAutoReturn(backUrls.success) ? 'approved' : undefined,
    back_urls: backUrls,
    metadata: {
      store_id: order.storeId,
      order_id: order.id,
      order_number: order.orderNumber,
      environment: accessContext.environment,
    },
    notification_url: notificationUrl,
    payer: {
      name: payerName.name,
      surname: payerName.surname,
      email: order.customer?.email,
      phone,
      identification:
        documentType && documentNumber
          ? {
              type: documentType,
              number: documentNumber,
            }
          : undefined,
      address: order.customer?.shippingAddress
        ? {
            zip_code: order.customer.shippingAddress.postalCode,
            street_name: order.customer.shippingAddress.street,
            street_number: order.customer.shippingAddress.number,
          }
        : undefined,
    },
    shipments: order.customer?.shippingAddress
      ? {
          mode: 'not_specified',
          cost: order.shippingTotal,
          free_shipping: order.shippingTotal === 0,
          receiver_address: {
            zip_code: order.customer.shippingAddress.postalCode,
            street_name: order.customer.shippingAddress.street,
            street_number: order.customer.shippingAddress.number,
            city_name: order.customer.shippingAddress.city,
            state_name: order.customer.shippingAddress.state,
            country_name: order.customer.shippingAddress.country ?? 'Brasil',
          },
        }
      : undefined,
    items: order.items.map((item) => ({
      id: item.variantId || item.productId,
      title: item.name,
      description: item.sku ? `SKU: ${item.sku}` : undefined,
      quantity: item.quantity,
      currency_id: 'BRL',
      unit_price: item.unitPrice,
    })),
  };

  const preference = await createPreferenceOnMercadoPago(
    body,
    accessContext.accessToken
  );

  if (!preference.id) {
    throw new Error('mercado_pago_preference_without_id');
  }

  const checkoutUrl = shouldUseSandboxUrl(accessContext.environment)
    ? preference.sandbox_init_point ?? preference.init_point
    : preference.init_point ?? preference.sandbox_init_point;

  if (!checkoutUrl) {
    throw new Error('mercado_pago_preference_without_checkout_url');
  }

  await upsertPaymentTransaction({
    storeId: order.storeId,
    orderId: order.id,
    provider: 'mercado_pago',
    providerReference: preference.id,
    externalReference: order.id,
    status: 'created',
    amount: order.total,
    checkoutUrl: preference.init_point,
    sandboxCheckoutUrl: preference.sandbox_init_point,
    metadata: {
      order_number: order.orderNumber,
      checkout_mode: 'checkout_pro',
      environment: accessContext.environment,
      credentials_source: accessContext.credentialsSource,
    },
  });

  return {
    provider: 'mercado_pago',
    preferenceId: preference.id,
    checkoutUrl,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
    environment: accessContext.environment,
    credentialsSource: accessContext.credentialsSource,
    publicKey: accessContext.publicKey,
  };
}

export async function createMercadoPagoBrickPayment(input: {
  order: MercadoPagoCheckoutPreferenceInput['order'];
  baseUrl: string;
  formData: MercadoPagoBrickPaymentFormData;
  idempotencyKey: string;
  providerReference?: string;
  environment?: MercadoPagoEnvironment;
}): Promise<MercadoPagoBrickPaymentResult> {
  const accessContext = await getMercadoPagoAccessContext({
    storeId: input.order.storeId,
    environment: input.environment,
  });
  const { order } = input;
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const testPayerEmail = getServerEnv().MERCADO_PAGO_TEST_PAYER_EMAIL;
  const payerEmail =
    accessContext.environment === 'test'
      ? testPayerEmail
      : order.customer?.email ?? toOptionalString(input.formData.payer?.email);

  if (accessContext.environment === 'test' && !testPayerEmail) {
    throw new MercadoPagoPreferenceError(503, 'test_payer_email_not_configured');
  }

  if (!payerEmail) {
    throw new MercadoPagoPreferenceError(400, 'payer_email_missing');
  }
  const notificationUrl = baseUrl.startsWith('https://')
    ? (() => {
        const url = new URL('/api/webhooks/mercado-pago', baseUrl);
        url.searchParams.set('store_id', order.storeId);
        url.searchParams.set('environment', accessContext.environment);
        return url.toString();
      })()
    : undefined;
  let body: Record<string, unknown>;

  try {
    body = buildMercadoPagoBrickPaymentPayload({
      order,
      formData: input.formData,
      payerEmail,
      notificationUrl,
      environment: accessContext.environment,
    }).body;
  } catch (error) {
    if (error instanceof MercadoPagoPaymentPayloadError) {
      throw new MercadoPagoPreferenceError(400, error.code);
    }

    throw error;
  }
  const payment = await createPaymentOnMercadoPago({
    body,
    accessToken: accessContext.accessToken,
    idempotencyKey: input.idempotencyKey,
  });

  if (!payment.id) {
    throw new Error('mercado_pago_payment_without_id');
  }

  const transactionAmount =
    payment.transaction_amount === undefined ||
    payment.transaction_amount === null
      ? order.total
      : (toNumber(payment.transaction_amount) ?? order.total);
  const paymentInstructions = getMercadoPagoPaymentInstructions(payment);

  await upsertPaymentTransaction({
    storeId: order.storeId,
    orderId: order.id,
    provider: 'mercado_pago',
    providerReference: input.providerReference,
    externalPaymentId: String(payment.id),
    externalReference: order.id,
    status:
      payment.status === 'approved'
        ? 'approved'
        : payment.status === 'rejected'
          ? 'rejected'
          : payment.status === 'cancelled'
            ? 'cancelled'
            : 'pending',
    amount: transactionAmount,
    rawStatus: payment.status,
    rawStatusDetail: payment.status_detail,
    metadata: {
      order_number: order.orderNumber,
      checkout_mode: 'payment_brick',
      environment: accessContext.environment,
      credentials_source: accessContext.credentialsSource,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      payment_instructions: paymentInstructions,
    },
  });

  return {
    id: String(payment.id),
    status: payment.status,
    statusDetail: payment.status_detail,
    paymentMethodId: payment.payment_method_id,
    paymentTypeId: payment.payment_type_id,
    transactionAmount,
    paymentInstructions,
  };
}

export async function createPayment(
  intent: PaymentIntent
): Promise<PaymentResult> {
  return {
    externalId: intent.orderId,
    status: 'created',
  };
}

export async function getPaymentStatus(
  externalId: string
): Promise<PaymentResult> {
  return {
    externalId,
    status: 'pending',
  };
}

export async function getMercadoPagoPayment(
  input: {
    paymentId: string;
    storeId: string;
    environment?: MercadoPagoEnvironment;
  }
): Promise<MercadoPagoPaymentLookupResult> {
  const accessContext = await getMercadoPagoAccessContext({
    storeId: input.storeId,
    environment: input.environment,
  });
  const normalizedPaymentId = input.paymentId.trim();

  if (!normalizedPaymentId) {
    throw new MercadoPagoPaymentLookupError(400, 'missing_payment_id');
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      normalizedPaymentId
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessContext.accessToken}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const reason = await getMercadoPagoErrorReason(response);
    throw new MercadoPagoPaymentLookupError(response.status, reason);
  }

  const payment = (await response.json()) as MercadoPagoPaymentResponse;

  if (!payment.id) {
    throw new MercadoPagoPaymentLookupError(502, 'payment_without_id');
  }

  return {
    id: String(payment.id),
    status: payment.status,
    statusDetail: payment.status_detail,
    externalReference: payment.external_reference,
    transactionAmount: toNumber(payment.transaction_amount),
    currencyId: payment.currency_id,
    liveMode: payment.live_mode,
    paymentMethodId: payment.payment_method_id,
    paymentTypeId: payment.payment_type_id,
    metadata: toRecord(payment.metadata),
    paymentInstructions: getMercadoPagoPaymentInstructions(payment),
  };
}
