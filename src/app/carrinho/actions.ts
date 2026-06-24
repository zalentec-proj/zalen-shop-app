'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createOrder } from '@/modules/orders/order.service';
import { isValidCpfOrCnpj, onlyDigits } from '@/modules/customers/br-document';
import { findCheckoutCustomerByIdentifier } from '@/modules/customers/customer.service';
import { CustomerPersistenceError } from '@/modules/customers/customer.repository';
import { getServerEnv } from '@/lib/env/server';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  MercadoPagoPreferenceError,
  createCheckoutPreference,
  ensureMercadoPagoCheckoutReady,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import {
  getCustomerTypeFromDocument,
  isValidDocumentForCustomerType,
  resolveCheckoutPricing,
} from '@/modules/pricing/pricing.service';
import type { CustomerType } from '@/modules/pricing/pricing.types';

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
  shippingAddress: z
    .object({
      postalCode: z.string().trim().min(8),
      street: z.string().trim().min(2),
      number: optionalCheckoutString,
      complement: optionalCheckoutString,
      district: optionalCheckoutString,
      city: z.string().trim().min(2),
      state: z.string().trim().min(2).max(2),
    })
    .required(),
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
  items: z.array(checkoutItemSchema).min(1).max(50),
  customer: checkoutCustomerSchema,
  paymentMethod: z.literal('mercado_pago_checkout_pro'),
});

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

  if (error instanceof Error) {
    const safeMessages = new Set([
      'mercado_pago_preference_without_id',
      'mercado_pago_preference_without_checkout_url',
      'Unable to save payment transaction.',
      'Failed to persist order in Supabase.',
      'Failed to persist order items in Supabase.',
      'fetch failed',
    ]);

    if (safeMessages.has(error.message)) {
      return `Não foi possível iniciar o pagamento agora (${error.message}).`;
    }

    if (process.env.NODE_ENV !== 'production') {
      return `Não foi possível iniciar o pagamento agora (${error.name}: ${error.message.slice(0, 160)}).`;
    }
  }

  return 'Não foi possível iniciar o pagamento agora.';
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

  try {
    const store = await resolveCurrentStoreFromHeaders();
    const requestHeaders = await headers();
    const baseUrl =
      requestHeaders.get('origin') ??
      getServerEnv().APP_URL ??
      'http://localhost:3000';

    await ensureMercadoPagoCheckoutReady(store.id);

    const order = await createOrder({
      storeId: store.id,
      customer: parsed.data.customer,
      items: parsed.data.items,
      sendToErp: false,
    });
    const payment = await createCheckoutPreference({
      order,
      baseUrl,
    });

    return {
      ok: true,
      orderNumber: order.orderNumber,
      paymentProvider: payment.provider,
      paymentUrl: payment.checkoutUrl,
    };
  } catch (error) {
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
