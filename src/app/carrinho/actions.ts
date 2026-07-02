'use server';

import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createOrder } from '@/modules/orders/order.service';
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
import { lookupBrazilianPostalCode } from '@/modules/address/postal-code.service';
import { getServerEnv } from '@/lib/env/server';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  MercadoPagoPreferenceError,
  createCheckoutPreference,
  ensureMercadoPagoCheckoutReady,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import {
  CheckoutAttemptPersistenceError,
  completeCheckoutAttempt,
  markCheckoutAttemptError,
  reserveCheckoutAttempt,
} from '@/modules/payments/checkout-attempt.repository';
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
  paymentMethod: z.literal('mercado_pago_checkout_pro'),
});

type CheckoutInput = z.infer<typeof checkoutSchema>;

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
      paymentUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

export type IdentifyCheckoutCustomerActionResult =
  | {
      ok: true;
      found: boolean;
      customerType?: CustomerType;
      customer?: {
        name?: string;
        email?: string;
        phone?: string;
        document?: string;
        customerType?: CustomerType;
        legalName?: string;
        stateRegistration?: string;
        stateRegistrationExempt?: boolean;
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

async function getCheckoutBaseUrl() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get('origin') ??
    getServerEnv().APP_URL ??
    'http://localhost:3000'
  );
}

function assertCheckoutEmailLooksIntentional(email: string) {
  const suggestion = getCommonEmailTypoSuggestion(email);

  if (suggestion) {
    throw new Error(`checkout_email_typo:${suggestion}`);
  }
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

const checkoutEmailCodeRequestSchema = z.object({
  email: z.string().trim().email(),
});

const checkoutEmailCodeVerificationSchema = checkoutEmailCodeRequestSchema.extend({
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
      baseUrl: await getCheckoutBaseUrl(),
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

const checkoutPostalCodeLookupSchema = z.object({
  postalCode: z.string().trim().min(8),
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
    const baseUrl = await getCheckoutBaseUrl();
    const fingerprint = getCheckoutAttemptFingerprint(checkoutInput);

    await ensureMercadoPagoCheckoutReady(store.id);

    const reservation = await reserveCheckoutAttempt({
      storeId: store.id,
      attemptKey: parsed.data.checkoutAttemptId,
      ...fingerprint,
    });

    if (reservation.state === 'completed' && reservation.attempt.checkoutUrl) {
      return {
        ok: true,
        orderNumber: reservation.attempt.orderNumber ?? 'Pedido',
        paymentProvider: 'mercado_pago',
        paymentUrl: reservation.attempt.checkoutUrl,
      };
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

    return {
      ok: true,
      orderNumber: order.orderNumber,
      paymentProvider: payment.provider,
      paymentUrl: payment.checkoutUrl,
    };
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
  const customerType =
    isDocumentLookup && isValidCpfOrCnpj(identifier)
      ? getCustomerTypeFromDocument(identifier)
      : undefined;

  if (isDocumentLookup && !customerType) {
    return {
      ok: false,
      error: 'CPF/CNPJ inválido.',
    };
  }

  const store = await resolveCurrentStoreFromHeaders();
  const customer = await findCheckoutCustomerByIdentifier({
    storeId: store.id,
    identifier,
  });

  if (!customer) {
    return {
      ok: true,
      found: false,
      customerType,
      customer: isDocumentLookup
        ? {
            document: digits,
            customerType,
          }
        : {
            email: identifier.includes('@') ? identifier.toLowerCase() : undefined,
          },
    };
  }

  if (!isDocumentLookup) {
    return {
      ok: true,
      found: true,
      customerType: customer.customerType,
      customer: {
        email: customer.email,
        customerType: customer.customerType,
      },
    };
  }

  return {
    ok: true,
    found: true,
    customerType: customer.customerType,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      document: customer.document,
      customerType: customer.customerType,
      legalName: customer.legalName,
      stateRegistration: customer.stateRegistration,
      stateRegistrationExempt: customer.stateRegistrationExempt,
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
    },
  };
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
