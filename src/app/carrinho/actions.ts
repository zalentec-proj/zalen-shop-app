'use server';

import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createOrder } from '@/modules/orders/order.service';
import { getOrderByIdFromRepository } from '@/modules/orders/order.repository';
import { isValidCpfOrCnpj, onlyDigits } from '@/modules/customers/br-document';
import { findCheckoutCustomerByIdentifier } from '@/modules/customers/customer.service';
import { CustomerPersistenceError } from '@/modules/customers/customer.repository';
import {
  getCommonEmailTypoSuggestion,
  getEmailTypoErrorMessage,
  normalizeEmailAddress,
} from '@/modules/customers/email-validation';
import {
  requestCustomerLoginCode,
  verifyCustomerLoginCode,
} from '@/modules/customer-account/customer-auth.service';
import { findCustomerByAuthUserId } from '@/modules/customers/customer.service';
import { lookupBrazilianPostalCode } from '@/modules/address/postal-code.service';
import { parseMarketingContextCookie } from '@/modules/marketing/marketing.service';
import {
  getCurrentStorefrontOrigin,
  resolveCurrentStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import {
  MercadoPagoPreferenceError,
  createCheckoutPreference,
  createMercadoPagoBrickPayment,
  ensureMercadoPagoCheckoutReady,
  getMercadoPagoAccessContext,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import {
  CheckoutAttemptPersistenceError,
  completeCheckoutAttempt,
  findReusableCheckoutAttempt,
  markCheckoutAttemptError,
  reserveCheckoutAttempt,
} from '@/modules/payments/checkout-attempt.repository';
import { processMercadoPagoPaymentUpdate } from '@/modules/payments/mercado-pago-payment.service';
import { getLatestPaymentTransactionByOrderId } from '@/modules/payments/payment-transaction.repository';
import {
  getCustomerTypeFromDocument,
  isValidDocumentForCustomerType,
  resolveCheckoutPricing,
} from '@/modules/pricing/pricing.service';
import { sendOrderReceivedStoreEmail } from '@/modules/email/store-transactional-email.service';
import type { CustomerType } from '@/modules/pricing/pricing.types';
import {
  quoteShipping,
  type ShippingRate,
} from '@/modules/shipping/shipment.service';
import type {
  MercadoPagoBrickPaymentFormData,
  MercadoPagoEnvironment,
} from '@/modules/integrations/mercado-pago/mercado-pago.types';
import type { OrderListItem } from '@/modules/orders/order.types';

const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(99),
});

const optionalCheckoutString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const checkoutShippingAddressSchema = z
  .object({
    postalCode: z.string().trim().min(8),
    street: z.string().trim().min(2),
    number: optionalCheckoutString,
    complement: optionalCheckoutString,
    district: optionalCheckoutString,
    city: z.string().trim().min(2),
    state: z.string().trim().min(2).max(2),
  })
  .required();

const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  customerType: z.enum(['pf', 'pj']).optional(),
  document: z
    .string()
    .trim()
    .min(11)
    .refine(isValidCpfOrCnpj, 'CPF ou CNPJ inválido.'),
  legalName: optionalCheckoutString,
  stateRegistration: optionalCheckoutString,
  stateRegistrationExempt: z.boolean().optional(),
  acceptsMarketing: z.boolean().optional(),
  shippingAddress: checkoutShippingAddressSchema,
}).superRefine((customer, context) => {
  const detectedCustomerType = getCustomerTypeFromDocument(customer.document);

  if (
    customer.customerType &&
    customer.customerType !== detectedCustomerType
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerType'],
      message: 'Tipo de cliente incompatível com CPF/CNPJ.',
    });
  }

  if (
    !isValidDocumentForCustomerType({
      document: customer.document,
      customerType: detectedCustomerType,
    })
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['document'],
      message: 'Documento inválido para o tipo de cliente.',
    });
  }

  if (detectedCustomerType === 'pj') {
    if (!customer.legalName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['legalName'],
        message: 'Informe a razão social.',
      });
    }

    if (!customer.stateRegistrationExempt && !customer.stateRegistration) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateRegistration'],
        message: 'Informe a inscrição estadual ou marque isento.',
      });
    }
  }
});

const checkoutSchema = z.object({
  checkoutAttemptId: z.string().trim().uuid(),
  shippingQuoteId: z.string().trim().uuid(),
  items: z.array(checkoutItemSchema).min(1).max(50),
  customer: checkoutCustomerSchema,
  paymentMethod: z.enum([
    'mercado_pago_checkout_pro',
    'mercado_pago_payment_brick',
  ]),
});

type CheckoutInput = z.infer<typeof checkoutSchema>;

type CheckoutCustomerSnapshot = {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  customerType?: CustomerType;
  legalName?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  acceptsMarketing?: boolean;
  shippingAddress?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  };
};

export type CheckoutEmailCodeActionResult =
  | {
      ok: true;
      email: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutCartActionResult =
  | {
      ok: true;
      orderNumber: string;
      paymentProvider: 'mercado_pago';
      paymentMode: 'checkout_pro';
      paymentUrl: string;
    }
  | {
      ok: true;
      orderNumber: string;
      paymentProvider: 'mercado_pago';
      paymentMode: 'payment_brick';
      orderId: string;
      amount: number;
      preferenceId: string;
      publicKey: string;
      environment: MercadoPagoEnvironment;
      paymentAttemptKey: string;
      fallbackPaymentUrl?: string;
    }
  | {
      ok: false;
      error: string;
    };

type MercadoPagoBrickActionStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'error';

export type MercadoPagoBrickPaymentActionResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      paymentId: string;
      status: MercadoPagoBrickActionStatus;
      redirectPath: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
      status?: Extract<
        MercadoPagoBrickActionStatus,
        'rejected' | 'cancelled' | 'error'
      >;
    };

export type IdentifyCheckoutCustomerActionResult =
  | {
      ok: true;
      status:
        | 'new_customer'
        | 'existing_customer_requires_code'
        | 'authenticated_customer';
      customerType?: CustomerType;
      emailHint?: string;
      message?: string;
      customer?: CheckoutCustomerSnapshot;
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutAccountCodeActionResult =
  | {
      ok: true;
      emailHint: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutAccountCodeVerificationActionResult =
  | {
      ok: true;
      email: string;
      message: string;
      customer: CheckoutCustomerSnapshot;
    }
  | {
      ok: false;
      error: string;
    };

export type SwitchCheckoutAccountActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutPreviewActionResult =
  | {
      ok: true;
      customerType: CustomerType;
      priceListName?: string;
      items: Array<{
        productId: string;
        variantId: string;
        name: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        total: number;
        usedFallbackPrice: boolean;
      }>;
      subtotal: number;
      shippingTotal: number;
      discountTotal: number;
      total: number;
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutShippingQuoteActionResult =
  | {
      ok: true;
      customerType: CustomerType;
      priceListName?: string;
      subtotal: number;
      discountTotal: number;
      shippingOptions: ShippingRate[];
    }
  | {
      ok: false;
      error: string;
    };

export type CheckoutPostalCodeLookupActionResult =
  | {
      ok: true;
      address: {
        postalCode: string;
        street?: string;
        district?: string;
        city: string;
        state: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

function getSafeCheckoutError(error: unknown) {
  if (
    error instanceof Error &&
    error.message === 'mercado_pago_not_configured'
  ) {
    return 'Mercado Pago ainda não está configurado neste ambiente.';
  }

  if (
    error instanceof Error &&
    error.message === 'mercado_pago_disabled'
  ) {
    return 'Mercado Pago está desativado para esta loja.';
  }

  if (
    error instanceof MercadoPagoPreferenceError ||
    (error instanceof Error &&
      error.message === 'mercado_pago_preference_create_failed' &&
      'status' in error &&
      'reason' in error)
  ) {
    const mercadoPagoError = error as MercadoPagoPreferenceError;

    return `Mercado Pago recusou a preferência (${mercadoPagoError.status}: ${mercadoPagoError.reason}).`;
  }

  if (error instanceof CustomerPersistenceError) {
    return `Não foi possível salvar os dados do cliente (${error.safeReason}).`;
  }

  if (error instanceof CheckoutAttemptPersistenceError) {
    return `Não foi possível reservar a tentativa de pagamento (${error.safeReason}).`;
  }

  if (error instanceof Error) {
    const checkoutErrorMessages: Record<string, string> = {
      shipping_origin_required:
        'Configure a origem de envio da loja antes de calcular o frete.',
      shipping_postal_code_invalid: 'Informe um CEP válido para calcular o frete.',
      shipping_product_not_found:
        'Não foi possível calcular o frete porque um produto do carrinho não foi encontrado.',
      shipping_product_variant_not_found:
        'Não foi possível calcular o frete porque uma variação do carrinho não foi encontrada.',
      shipping_product_dimensions_missing:
        'Não foi possível calcular o frete porque um ou mais produtos estão sem peso ou dimensões cadastradas.',
      superfrete_token_missing:
        'SuperFrete ainda não está configurada para calcular o frete real.',
      superfrete_quote_failed:
        'SuperFrete não conseguiu calcular o frete agora. Tente novamente em instantes.',
      superfrete_quote_timeout:
        'A cotação de frete demorou mais que o esperado. Tente novamente.',
      superfrete_quote_invalid_response:
        'SuperFrete retornou uma cotação inválida. Tente novamente em instantes.',
      superfrete_no_services:
        'Nenhuma transportadora disponível para este CEP e pacote.',
    };

    if (checkoutErrorMessages[error.message]) {
      return checkoutErrorMessages[error.message];
    }

    const safeMessages = new Set([
      'checkout_attempt_in_progress',
      'checkout_attempt_fingerprint_mismatch',
      'mercado_pago_preference_without_id',
      'mercado_pago_preference_without_checkout_url',
      'Unable to save payment transaction.',
      'order_persistence_required',
      'Failed to persist order in Supabase.',
      'Failed to persist order items in Supabase.',
      'shipping_quote_required',
      'shipping_quote_not_found',
      'shipping_quote_expired',
      'shipping_quote_items_changed',
      'shipping_quote_address_changed',
      'shipping_quote_stale',
      'checkout_email_not_verified',
      'checkout_email_mismatch',
      'fetch failed',
    ]);

    if (error.message === 'checkout_email_not_verified') {
      return 'Valide o e-mail com o código recebido antes de iniciar o pagamento.';
    }

    if (error.message === 'checkout_email_mismatch') {
      return 'O e-mail validado não corresponde ao e-mail informado no checkout.';
    }

    if (error.message.startsWith('checkout_email_typo:')) {
      const suggestion = error.message.split(':')[1];

      return suggestion
        ? `Revise o e-mail antes de continuar. Talvez seja ${suggestion}.`
        : 'Revise o e-mail antes de continuar.';
    }

    if (safeMessages.has(error.message)) {
      return `Não foi possível iniciar o pagamento agora (${error.message}).`;
    }

    if (process.env.NODE_ENV !== 'production') {
      return `Não foi possível iniciar o pagamento agora (${error.name}: ${error.message.slice(0, 160)}).`;
    }
  }

  return 'Não foi possível iniciar o pagamento agora.';
}

function hashCheckoutPayload(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function getCheckoutAttemptFingerprint(input: CheckoutInput) {
  const items = input.items
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }))
    .sort((a, b) =>
      `${a.productId}:${a.variantId}`.localeCompare(
        `${b.productId}:${b.variantId}`
      )
    );
  const customer = input.customer;
  const address = customer.shippingAddress;

  return {
    cartHash: hashCheckoutPayload({
      paymentMethod: input.paymentMethod,
      items,
      shippingQuoteId: input.shippingQuoteId,
    }),
    customerHash: hashCheckoutPayload({
      name: customer.name.trim(),
      email: customer.email.trim().toLowerCase(),
      phone: onlyDigits(customer.phone),
      document: onlyDigits(customer.document),
      customerType:
        customer.customerType ?? getCustomerTypeFromDocument(customer.document),
      legalName: customer.legalName?.trim(),
      stateRegistration: customer.stateRegistration?.trim(),
      stateRegistrationExempt: customer.stateRegistrationExempt ?? false,
      acceptsMarketing: customer.acceptsMarketing ?? false,
      shippingAddress: {
        postalCode: onlyDigits(address.postalCode),
        street: address.street.trim(),
        number: address.number?.trim(),
        complement: address.complement?.trim(),
        district: address.district?.trim(),
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
      },
    }),
  };
}

function assertCheckoutEmailLooksIntentional(email: string) {
  const suggestion = getCommonEmailTypoSuggestion(email);

  if (suggestion) {
    throw new Error(`checkout_email_typo:${suggestion}`);
  }
}

function maskEmail(email: string) {
  const normalizedEmail = normalizeEmailAddress(email);
  const [localPart = '', domain = ''] = normalizedEmail.split('@');
  const visiblePrefix = localPart.slice(0, Math.min(3, localPart.length));
  const maskedLocal =
    localPart.length <= 3 ? `${visiblePrefix}***` : `${visiblePrefix}***`;

  return domain ? `${maskedLocal}@${domain}` : `${maskedLocal}@***`;
}

function mapCheckoutCustomerSnapshot(
  customer: NonNullable<Awaited<ReturnType<typeof findCheckoutCustomerByIdentifier>>>
): CheckoutCustomerSnapshot {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    document: customer.document,
    customerType: customer.customerType,
    legalName: customer.legalName,
    stateRegistration: customer.stateRegistration,
    stateRegistrationExempt: customer.stateRegistrationExempt,
    acceptsMarketing: customer.acceptsMarketing,
    shippingAddress: customer.defaultAddress
      ? {
          postalCode: customer.defaultAddress.postalCode,
          street: customer.defaultAddress.street,
          number: customer.defaultAddress.number,
          complement: customer.defaultAddress.complement,
          district: customer.defaultAddress.district,
          city: customer.defaultAddress.city,
          state: customer.defaultAddress.state,
        }
      : undefined,
  };
}

async function findCheckoutCustomerForIdentifier(identifier: string) {
  const store = await resolveCurrentStoreFromHeaders();
  const customer = await findCheckoutCustomerByIdentifier({
    storeId: store.id,
    identifier,
  });

  return {
    store,
    customer,
  };
}

function getCustomerEmailForCode(customer: { email?: string } | null) {
  const email = normalizeEmailAddress(customer?.email ?? '');

  return email || null;
}

function getSavedCustomerEmailTypoErrorMessage(email: string) {
  const suggestion = getCommonEmailTypoSuggestion(email);

  if (!suggestion) {
    return null;
  }

  return `O e-mail cadastrado parece incorreto (${maskEmail(email)}). Use Alterar e-mail/CPF/CNPJ e informe o e-mail correto, ou fale com atendimento.`;
}

async function requireVerifiedCheckoutEmail(input: {
  email: string;
}) {
  const checkoutEmail = normalizeEmailAddress(input.email);
  assertCheckoutEmailLooksIntentional(checkoutEmail);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('checkout_email_not_verified');
  }

  const sessionEmail = normalizeEmailAddress(data.user.email ?? '');

  if (!sessionEmail || sessionEmail !== checkoutEmail) {
    throw new Error('checkout_email_mismatch');
  }

  return {
    authUserId: data.user.id,
    email: sessionEmail,
  };
}

function canReusePaymentOrder(order: OrderListItem) {
  return order.paymentStatus !== 'paid' && order.status !== 'cancelled';
}

async function buildMercadoPagoStartResult(input: {
  storeId: string;
  order: OrderListItem;
  orderNumber: string;
  preferenceId?: string;
  checkoutUrl?: string;
  sandboxCheckoutUrl?: string;
  publicKey?: string;
  environment?: MercadoPagoEnvironment;
}): Promise<CheckoutCartActionResult> {
  const environment =
    input.environment ?? getDefaultMercadoPagoCheckoutEnvironment();
  let publicKey = input.publicKey;

  if (!publicKey) {
    const accessContext = await getMercadoPagoAccessContext({
      storeId: input.storeId,
      environment,
    });
    publicKey = accessContext.publicKey;
  }

  if (publicKey && input.preferenceId) {
    return {
      ok: true,
      orderNumber: input.orderNumber,
      paymentProvider: 'mercado_pago',
      paymentMode: 'payment_brick',
      orderId: input.order.id,
      amount: input.order.total,
      preferenceId: input.preferenceId,
      publicKey,
      environment,
      paymentAttemptKey: randomUUID(),
      fallbackPaymentUrl: input.checkoutUrl ?? input.sandboxCheckoutUrl,
    };
  }

  const paymentUrl = input.checkoutUrl ?? input.sandboxCheckoutUrl;

  if (!paymentUrl) {
    throw new Error('mercado_pago_preference_without_checkout_url');
  }

  return {
    ok: true,
    orderNumber: input.orderNumber,
    paymentProvider: 'mercado_pago',
    paymentMode: 'checkout_pro',
    paymentUrl,
  };
}

function getDefaultMercadoPagoCheckoutEnvironment(): MercadoPagoEnvironment {
  return process.env.MERCADO_PAGO_ENV === 'production'
    ? 'production'
    : 'test';
}

function getPaymentRedirectPath(orderId: string, status: string) {
  return `/conta/pedidos/${orderId}?payment=${encodeURIComponent(status)}`;
}

const checkoutEmailCodeRequestSchema = z.object({
  email: z.string().trim().email(),
});

const checkoutEmailCodeVerificationSchema = checkoutEmailCodeRequestSchema.extend({
  token: z.string().trim().min(4).max(12),
});

const checkoutAccountIdentifierSchema = z.object({
  identifier: z.string().trim().min(3),
});

const checkoutAccountCodeVerificationSchema =
  checkoutAccountIdentifierSchema.extend({
    token: z.string().trim().min(4).max(12),
  });

export async function requestCheckoutEmailCodeAction(
  rawInput: unknown
): Promise<CheckoutEmailCodeActionResult> {
  const parsed = checkoutEmailCodeRequestSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe um e-mail válido.',
    };
  }

  const email = normalizeEmailAddress(parsed.data.email);
  const typoMessage = getEmailTypoErrorMessage(email);

  if (typoMessage) {
    return {
      ok: false,
      error: typoMessage,
    };
  }

  try {
    const store = await resolveCurrentStoreFromHeaders();

    await requestCustomerLoginCode({
      storeId: store.id,
      storeName: store.name,
      email,
      baseUrl: await getCurrentStorefrontOrigin(store),
      next: '/carrinho',
    });

    return {
      ok: true,
      email,
      message: 'Enviamos um código para validar seu e-mail.',
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível enviar o código agora. Tente novamente em instantes.',
    };
  }
}

export async function verifyCheckoutEmailCodeAction(
  rawInput: unknown
): Promise<CheckoutEmailCodeActionResult> {
  const parsed = checkoutEmailCodeVerificationSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe o código recebido por e-mail.',
    };
  }

  const email = normalizeEmailAddress(parsed.data.email);
  const typoMessage = getEmailTypoErrorMessage(email);

  if (typoMessage) {
    return {
      ok: false,
      error: typoMessage,
    };
  }

  const store = await resolveCurrentStoreFromHeaders();
  const result = await verifyCustomerLoginCode({
    storeId: store.id,
    email,
    token: parsed.data.token,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: 'Código inválido ou expirado. Solicite um novo código.',
    };
  }

  return {
    ok: true,
    email,
    message: 'E-mail validado.',
  };
}

export async function requestCheckoutAccountCodeAction(
  rawInput: unknown
): Promise<CheckoutAccountCodeActionResult> {
  const parsed = checkoutAccountIdentifierSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe um e-mail, CPF ou CNPJ válido.',
    };
  }

  const { store, customer } = await findCheckoutCustomerForIdentifier(
    parsed.data.identifier
  );
  const email = getCustomerEmailForCode(customer);

  if (!customer || !email) {
    return {
      ok: false,
      error: 'Não encontramos um e-mail validável para este cadastro.',
    };
  }

  const typoMessage = getSavedCustomerEmailTypoErrorMessage(email);

  if (typoMessage) {
    return {
      ok: false,
      error: typoMessage,
    };
  }

  try {
    await requestCustomerLoginCode({
      storeId: store.id,
      storeName: store.name,
      email,
      baseUrl: await getCurrentStorefrontOrigin(store),
      next: '/carrinho',
    });

    return {
      ok: true,
      emailHint: maskEmail(email),
      message: 'Enviamos um código para o e-mail cadastrado.',
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível enviar o código agora. Tente novamente em instantes.',
    };
  }
}

export async function verifyCheckoutAccountCodeAction(
  rawInput: unknown
): Promise<CheckoutAccountCodeVerificationActionResult> {
  const parsed = checkoutAccountCodeVerificationSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe o código recebido por e-mail.',
    };
  }

  const { store, customer } = await findCheckoutCustomerForIdentifier(
    parsed.data.identifier
  );
  const email = getCustomerEmailForCode(customer);

  if (!customer || !email) {
    return {
      ok: false,
      error: 'Não encontramos um e-mail validável para este cadastro.',
    };
  }

  const typoMessage = getSavedCustomerEmailTypoErrorMessage(email);

  if (typoMessage) {
    return {
      ok: false,
      error: typoMessage,
    };
  }

  const result = await verifyCustomerLoginCode({
    storeId: store.id,
    email,
    token: parsed.data.token,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: 'Código inválido ou expirado. Solicite um novo código.',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ok: false,
      error: 'Não foi possível carregar sua sessão validada.',
    };
  }

  const hydratedCustomer =
    (await findCustomerByAuthUserId({
      storeId: store.id,
      authUserId: data.user.id,
    })) ?? customer;

  return {
    ok: true,
    email,
    message: 'Conta validada. Seus dados foram carregados.',
    customer: mapCheckoutCustomerSnapshot(hydratedCustomer),
  };
}

export async function switchCheckoutAccountAction(): Promise<SwitchCheckoutAccountActionResult> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return {
      ok: true,
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível trocar a conta agora. Tente novamente.',
    };
  }
}

const checkoutPostalCodeLookupSchema = z.object({
  postalCode: z.string().trim().min(8),
});

const mercadoPagoBrickPaymentSchema = z.object({
  orderId: z.string().trim().uuid(),
  idempotencyKey: z.string().trim().uuid(),
  formData: z.record(z.string(), z.unknown()),
});

function getPostalCodeLookupErrorMessage(errorCode: string) {
  if (errorCode === 'invalid_postal_code') {
    return 'Informe um CEP válido com 8 dígitos.';
  }

  if (errorCode === 'postal_code_not_found') {
    return 'CEP não encontrado. Revise o número ou preencha o endereço manualmente.';
  }

  if (errorCode === 'postal_code_incomplete') {
    return 'Não foi possível completar este CEP. Preencha o endereço manualmente.';
  }

  return 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.';
}

function getBrickPaymentStatus(
  status: string | undefined
): MercadoPagoBrickActionStatus {
  if (
    status === 'approved' ||
    status === 'pending' ||
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'refunded'
  ) {
    return status;
  }

  if (
    status === 'in_process' ||
    status === 'authorized' ||
    status === 'in_mediation'
  ) {
    return 'pending';
  }

  if (status === 'charged_back') {
    return 'cancelled';
  }

  return 'error';
}

function getBrickPaymentMessage(status: string) {
  switch (status) {
    case 'approved':
      return 'Pagamento aprovado. Estamos preparando seu pedido.';
    case 'pending':
      return 'Pagamento gerado. Acompanhe a confirmação na área do pedido.';
    case 'rejected':
      return 'Pagamento recusado. Revise os dados e tente novamente.';
    case 'cancelled':
      return 'Pagamento cancelado. Você pode tentar novamente.';
    default:
      return 'Não foi possível confirmar o pagamento agora.';
  }
}

function getPaymentEnvironmentFromTransaction(
  transaction: Awaited<ReturnType<typeof getLatestPaymentTransactionByOrderId>>
) {
  const environment = transaction?.metadata?.environment;

  return environment === 'production' || environment === 'test'
    ? environment
    : undefined;
}

export async function lookupCheckoutPostalCodeAction(
  rawInput: unknown
): Promise<CheckoutPostalCodeLookupActionResult> {
  const parsed = checkoutPostalCodeLookupSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe um CEP válido com 8 dígitos.',
    };
  }

  const result = await lookupBrazilianPostalCode(parsed.data.postalCode);

  if (!result.ok) {
    return {
      ok: false,
      error: getPostalCodeLookupErrorMessage(result.errorCode),
    };
  }

  return {
    ok: true,
    address: {
      postalCode: result.postalCode,
      street: result.street,
      district: result.district,
      city: result.city,
      state: result.state,
    },
  };
}

export async function checkoutCartAction(
  rawInput: unknown
): Promise<CheckoutCartActionResult> {
  const parsed = checkoutSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Revise os dados do cliente e os itens do carrinho.',
    };
  }

  let reservedAttempt:
    | {
        id: string;
        storeId: string;
      }
    | undefined;

  try {
    const store = await resolveCurrentStoreFromHeaders();
    const verifiedEmail = await requireVerifiedCheckoutEmail({
      email: parsed.data.customer.email,
    });
    const checkoutInput = {
      ...parsed.data,
      customer: {
        ...parsed.data.customer,
        email: verifiedEmail.email,
      },
    } satisfies CheckoutInput;
    const baseUrl = await getCurrentStorefrontOrigin(store);
    const fingerprint = getCheckoutAttemptFingerprint(checkoutInput);

    await ensureMercadoPagoCheckoutReady(store.id);

    const reusableAttempt = await findReusableCheckoutAttempt({
      storeId: store.id,
      ...fingerprint,
    });

    if (reusableAttempt?.orderId) {
      const reusableOrder = await getOrderByIdFromRepository(
        store.id,
        reusableAttempt.orderId
      );

      if (reusableOrder && canReusePaymentOrder(reusableOrder)) {
        return buildMercadoPagoStartResult({
          storeId: store.id,
          order: reusableOrder,
          orderNumber: reusableAttempt.orderNumber ?? reusableOrder.orderNumber,
          preferenceId: reusableAttempt.providerReference,
          checkoutUrl: reusableAttempt.checkoutUrl,
          sandboxCheckoutUrl: reusableAttempt.sandboxCheckoutUrl,
        });
      }
    }

    const reservation = await reserveCheckoutAttempt({
      storeId: store.id,
      attemptKey: parsed.data.checkoutAttemptId,
      ...fingerprint,
    });

    if (reservation.state === 'completed' && reservation.attempt.checkoutUrl) {
      const existingOrder = reservation.attempt.orderId
        ? await getOrderByIdFromRepository(store.id, reservation.attempt.orderId)
        : null;

      if (existingOrder && canReusePaymentOrder(existingOrder)) {
        return buildMercadoPagoStartResult({
          storeId: store.id,
          order: existingOrder,
          orderNumber:
            reservation.attempt.orderNumber ?? existingOrder.orderNumber,
          preferenceId: reservation.attempt.providerReference,
          checkoutUrl: reservation.attempt.checkoutUrl,
          sandboxCheckoutUrl: reservation.attempt.sandboxCheckoutUrl,
        });
      }

      throw new Error('checkout_attempt_completed_without_payable_order');
    }

    if (reservation.state === 'in_progress') {
      return {
        ok: false,
        error:
          'Já estamos iniciando este pagamento. Aguarde alguns segundos e tente novamente.',
      };
    }

    if (reservation.state === 'fingerprint_mismatch') {
      return {
        ok: false,
        error:
          'Esta tentativa de pagamento pertence a outro carrinho. Revise o carrinho e tente novamente.',
      };
    }

    reservedAttempt = {
      id: reservation.attempt.id,
      storeId: store.id,
    };

    const order = await createOrder({
      storeId: store.id,
      customer: {
        ...checkoutInput.customer,
        authUserId: verifiedEmail.authUserId,
      },
      items: checkoutInput.items,
      shippingQuoteId: checkoutInput.shippingQuoteId,
      marketingContext: parseMarketingContextCookie(
        (await cookies()).get('zalen_marketing_context')?.value
      ),
      sendToErp: false,
      requirePersistence: true,
    });
    const payment = await createCheckoutPreference({
      order,
      baseUrl,
    });

    await completeCheckoutAttempt({
      storeId: store.id,
      attemptId: reservation.attempt.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerReference: payment.preferenceId,
      checkoutUrl: payment.checkoutUrl,
      sandboxCheckoutUrl: payment.sandboxInitPoint,
    });

    await sendOrderReceivedStoreEmail({
      storeId: store.id,
      storeName: store.shortName,
      order,
      baseUrl,
    }).catch(() => undefined);

    return buildMercadoPagoStartResult({
      storeId: store.id,
      order,
      orderNumber: order.orderNumber,
      preferenceId: payment.preferenceId,
      checkoutUrl: payment.checkoutUrl,
      sandboxCheckoutUrl: payment.sandboxInitPoint,
      publicKey: payment.publicKey,
      environment: payment.environment,
    });
  } catch (error) {
    if (reservedAttempt) {
      await markCheckoutAttemptError({
        storeId: reservedAttempt.storeId,
        attemptId: reservedAttempt.id,
        errorMessage:
          error instanceof Error ? error.message : 'checkout_failed',
      }).catch(() => undefined);
    }

    return {
      ok: false,
      error: getSafeCheckoutError(error),
    };
  }
}

export async function processMercadoPagoBrickPaymentAction(
  rawInput: unknown
): Promise<MercadoPagoBrickPaymentActionResult> {
  const parsed = mercadoPagoBrickPaymentSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Revise os dados de pagamento e tente novamente.',
      status: 'error',
    };
  }

  try {
    const store = await resolveCurrentStoreFromHeaders();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return {
        ok: false,
        error: 'Entre na sua conta para concluir o pagamento.',
        status: 'error',
      };
    }

    const customer = await findCustomerByAuthUserId({
      storeId: store.id,
      authUserId: data.user.id,
    });
    const order = await getOrderByIdFromRepository(
      store.id,
      parsed.data.orderId
    );

    if (!customer || !order) {
      return {
        ok: false,
        error: 'Não encontramos este pedido para pagamento.',
        status: 'error',
      };
    }

    const sessionEmail = normalizeEmailAddress(data.user.email ?? '');
    const orderEmail = normalizeEmailAddress(order.customerEmail ?? '');
    const belongsToCustomer =
      order.customerId === customer.id ||
      (sessionEmail && orderEmail && sessionEmail === orderEmail);

    if (!belongsToCustomer) {
      return {
        ok: false,
        error: 'Não encontramos este pedido para pagamento.',
        status: 'error',
      };
    }

    if (!canReusePaymentOrder(order)) {
      return {
        ok: false,
        error: 'Este pedido não está mais disponível para pagamento.',
        status: 'error',
      };
    }

    const latestTransaction = await getLatestPaymentTransactionByOrderId({
      storeId: store.id,
      orderId: order.id,
    });
    const baseUrl = await getCurrentStorefrontOrigin(store);
    const environment = getPaymentEnvironmentFromTransaction(latestTransaction);
    const formData =
      parsed.data.formData as MercadoPagoBrickPaymentFormData;
    const idempotencyKey = formData.token
      ? parsed.data.idempotencyKey
      : `${order.id}:mercado-pago-brick`;
    const payment = await createMercadoPagoBrickPayment({
      order,
      baseUrl,
      formData,
      idempotencyKey,
      providerReference: latestTransaction?.providerReference,
      environment,
    });
    const reconciliation = await processMercadoPagoPaymentUpdate({
      storeId: store.id,
      paymentId: payment.id,
      environment,
      source: 'return',
    });
    const status = getBrickPaymentStatus(
      reconciliation.ok ? reconciliation.status : payment.status
    );
    const redirectPath = getPaymentRedirectPath(order.id, status);
    const message = getBrickPaymentMessage(status);

    if (status === 'rejected' || status === 'cancelled' || status === 'error') {
      return {
        ok: false,
        error:
          reconciliation.errorCode === 'payment_amount_mismatch'
            ? 'O Mercado Pago retornou um valor diferente do pedido. Tente novamente.'
            : message,
        status,
      };
    }

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      status,
      redirectPath,
      message,
    };
  } catch (error) {
    return {
      ok: false,
      error: getSafeCheckoutError(error),
      status: 'error',
    };
  }
}

const identifyCheckoutCustomerSchema = z.object({
  identifier: z.string().trim().min(3),
});

export async function identifyCheckoutCustomerAction(
  rawInput: unknown
): Promise<IdentifyCheckoutCustomerActionResult> {
  const parsed = identifyCheckoutCustomerSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Informe um e-mail, CPF ou CNPJ válido.',
    };
  }

  const identifier = parsed.data.identifier;
  const digits = onlyDigits(identifier);
  const isDocumentLookup = digits.length >= 11;
  const isEmailLookup = isEmailLike(identifier);
  const customerType =
    isDocumentLookup && isValidCpfOrCnpj(identifier)
      ? getCustomerTypeFromDocument(identifier)
      : undefined;

  if (!isEmailLookup && (!isDocumentLookup || !customerType)) {
    return {
      ok: false,
      error: 'Informe um e-mail, CPF ou CNPJ válido.',
    };
  }

  if (isEmailLookup) {
    const email = normalizeEmailAddress(identifier);
    const typoMessage = getEmailTypoErrorMessage(email);

    if (typoMessage) {
      return {
        ok: false,
        error: typoMessage,
      };
    }
  }

  const { customer } = await findCheckoutCustomerForIdentifier(identifier);

  if (!customer) {
    return {
      ok: true,
      status: 'new_customer',
      customerType,
      customer: isDocumentLookup
        ? {
            document: digits,
            customerType,
          }
        : {
            email: isEmailLookup ? normalizeEmailAddress(identifier) : undefined,
          },
    };
  }

  const email = getCustomerEmailForCode(customer);

  if (!email) {
    return {
      ok: true,
      status: 'new_customer',
      customerType: customer.customerType,
      customer: {
        document: isDocumentLookup ? digits : customer.document,
        customerType: customer.customerType,
      },
    };
  }

  const typoMessage = getSavedCustomerEmailTypoErrorMessage(email);

  if (typoMessage) {
    return {
      ok: false,
      error: typoMessage,
    };
  }

  return {
    ok: true,
    status: 'existing_customer_requires_code',
    customerType: customer.customerType,
    emailHint: maskEmail(email),
    message: 'Identificamos um cadastro. Valide o e-mail para carregar seus dados.',
  };
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const checkoutPreviewSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  customerType: z.enum(['pf', 'pj']).optional(),
  document: z.string().trim().optional(),
});

const checkoutShippingQuoteSchema = checkoutPreviewSchema.extend({
  shippingAddress: checkoutShippingAddressSchema,
});

export async function previewCheckoutCartAction(
  rawInput: unknown
): Promise<CheckoutPreviewActionResult> {
  const parsed = checkoutPreviewSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Não foi possível calcular o carrinho.',
    };
  }

  const customerType = parsed.data.document
    ? getCustomerTypeFromDocument(parsed.data.document)
    : parsed.data.customerType ?? 'pf';

  try {
    const store = await resolveCurrentStoreFromHeaders();
    const pricing = await resolveCheckoutPricing({
      storeId: store.id,
      customerType,
      items: parsed.data.items,
    });

    return {
      ok: true,
      customerType: pricing.customerType,
      priceListName: pricing.priceListName,
      items: pricing.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        usedFallbackPrice: item.usedFallbackPrice,
      })),
      subtotal: pricing.subtotal,
      shippingTotal: pricing.shippingTotal,
      discountTotal: pricing.discountTotal,
      total: pricing.total,
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível calcular os preços agora.',
    };
  }
}

export async function quoteCheckoutShippingAction(
  rawInput: unknown
): Promise<CheckoutShippingQuoteActionResult> {
  const parsed = checkoutShippingQuoteSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Revise o endereço de entrega para calcular o frete.',
    };
  }

  const customerType = parsed.data.document
    ? getCustomerTypeFromDocument(parsed.data.document)
    : parsed.data.customerType ?? 'pf';

  try {
    const store = await resolveCurrentStoreFromHeaders();
    const pricing = await resolveCheckoutPricing({
      storeId: store.id,
      customerType,
      items: parsed.data.items,
    });
    const shippingOptions = await quoteShipping({
      storeId: store.id,
      subtotal: pricing.subtotal,
      destinationPostalCode: parsed.data.shippingAddress.postalCode,
      items: parsed.data.items,
    });

    if (shippingOptions.length === 0) {
      return {
        ok: false,
        error:
          'Nenhum método de envio ativo foi encontrado para este endereço.',
      };
    }

    return {
      ok: true,
      customerType: pricing.customerType,
      priceListName: pricing.priceListName,
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shippingOptions,
    };
  } catch (error) {
    return {
      ok: false,
      error: getSafeCheckoutError(error),
    };
  }
}
