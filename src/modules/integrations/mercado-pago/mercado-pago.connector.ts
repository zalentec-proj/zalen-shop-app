import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import { upsertPaymentTransaction } from '@/modules/payments/payment-transaction.repository';
import { listStoreIntegrationsWithSourceFromRepository } from '@/modules/integrations/core/store-integration.repository';
import type {
  MercadoPagoCheckoutPreferenceInput,
  MercadoPagoCheckoutPreferenceResult,
  MercadoPagoEnvironment,
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

function getAccessToken() {
  const accessToken = getServerEnv().MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('mercado_pago_not_configured');
  }

  return accessToken;
}

function toMercadoPagoEnvironment(
  value: string | undefined
): MercadoPagoEnvironment {
  return value === 'production' ? 'production' : 'test';
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

function shouldUseSandboxUrl(accessToken: string) {
  const configuredEnvironment = getServerEnv().MERCADO_PAGO_ENV;

  if (configuredEnvironment) {
    return configuredEnvironment === 'test';
  }

  return accessToken.startsWith('TEST-');
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

function isCheckoutEnabled(settings: Record<string, unknown> | undefined) {
  const checkoutPro = toRecord(settings?.checkoutPro);

  return checkoutPro?.enabled !== false;
}

export async function getMercadoPagoRuntimeState(
  storeId: string
): Promise<MercadoPagoRuntimeState> {
  const env = getServerEnv();
  const integrations =
    await listStoreIntegrationsWithSourceFromRepository(storeId);
  const mercadoPagoIntegration = integrations.data.find(
    (item) => item.provider.key === 'mercado_pago'
  )?.integration;
  const enabled =
    mercadoPagoIntegration?.status !== 'disabled' &&
    isCheckoutEnabled(mercadoPagoIntegration?.settings);
  const missingEnv = [
    env.MERCADO_PAGO_ACCESS_TOKEN ? undefined : 'MERCADO_PAGO_ACCESS_TOKEN',
    env.MERCADO_PAGO_WEBHOOK_SECRET
      ? undefined
      : 'MERCADO_PAGO_WEBHOOK_SECRET',
  ].filter((value): value is string => Boolean(value));
  const configured = missingEnv.length === 0;
  const status = !enabled
    ? 'disabled'
    : configured
      ? 'connected'
      : 'pending_credentials';
  const warnings: string[] = [];

  if (!enabled) {
    warnings.push('Mercado Pago desativado para a loja ativa.');
  }

  if (missingEnv.length > 0) {
    warnings.push('Configuração server-side do Mercado Pago pendente.');
  }

  return {
    provider: 'mercado_pago',
    checkoutMode: 'checkout_pro',
    credentialsSource: 'env',
    status,
    enabled,
    configured,
    environment: toMercadoPagoEnvironment(
      env.MERCADO_PAGO_ENV ?? mercadoPagoIntegration?.environment
    ),
    missingEnv,
    integrationStatus: mercadoPagoIntegration?.status,
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

export async function createCheckoutPreference(
  input: MercadoPagoCheckoutPreferenceInput
): Promise<MercadoPagoCheckoutPreferenceResult> {
  await ensureMercadoPagoCheckoutReady(input.order.storeId);

  const accessToken = getAccessToken();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const { order } = input;
  const documentType = getDocumentType(order.customer?.document);
  const documentNumber = order.customer?.document?.replace(/\D/g, '');
  const payerName = splitName(order.customer?.name);
  const phone = splitPhone(order.customer?.phone);
  const notificationUrl = baseUrl.startsWith('https://')
    ? `${baseUrl}/api/webhooks/mercado-pago`
    : undefined;
  const backUrls = {
    success: `${baseUrl}/pagamento/mercado-pago/sucesso?order=${order.id}`,
    pending: `${baseUrl}/pagamento/mercado-pago/pendente?order=${order.id}`,
    failure: `${baseUrl}/pagamento/mercado-pago/falha?order=${order.id}`,
  };

  const body = {
    external_reference: order.id,
    auto_return: canUseAutoReturn(backUrls.success) ? 'approved' : undefined,
    back_urls: backUrls,
    metadata: {
      store_id: order.storeId,
      order_id: order.id,
      order_number: order.orderNumber,
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

  const preference = await createPreferenceOnMercadoPago(body, accessToken);

  if (!preference.id) {
    throw new Error('mercado_pago_preference_without_id');
  }

  const checkoutUrl = shouldUseSandboxUrl(accessToken)
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
    },
  });

  return {
    provider: 'mercado_pago',
    preferenceId: preference.id,
    checkoutUrl,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
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
  paymentId: string
): Promise<MercadoPagoPaymentLookupResult> {
  const accessToken = getAccessToken();
  const normalizedPaymentId = paymentId.trim();

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
        Authorization: `Bearer ${accessToken}`,
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
    metadata: toRecord(payment.metadata),
  };
}
