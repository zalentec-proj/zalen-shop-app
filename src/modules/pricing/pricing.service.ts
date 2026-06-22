import 'server-only';

import { isValidCpf, isValidCnpj, onlyDigits } from '@/modules/customers/br-document';
import { getProductById } from '@/modules/catalog/product.service';
import type { ProductVariant } from '@/modules/catalog/product.types';
import {
  getDefaultPriceListFromRepository,
  getVariantPriceFromRepository,
  listAdminVariantPriceSummariesFromRepository,
  upsertVariantPriceForCustomerTypeInRepository,
} from './pricing.repository';
import type {
  AdminVariantPriceSummary,
  CheckoutPricingResult,
  CustomerType,
  ResolvedVariantPrice,
} from './pricing.types';

export type { AdminVariantPriceSummary, CheckoutPricingResult, CustomerType };

export interface CheckoutPricingInput {
  storeId: string;
  customerType: CustomerType;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
}

export interface UpdateVariantBusinessPriceInput {
  storeId: string;
  variantId: string;
  price: number;
}

function getBaseVariantUnitPrice(variant: ProductVariant) {
  return variant.promotionalPrice ?? variant.price;
}

function calculateShippingTotal(subtotal: number): number {
  return subtotal >= 500 ? 0 : 49.9;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getCustomerTypeFromDocument(
  document: string | undefined
): CustomerType {
  const digits = onlyDigits(document);

  if (digits.length === 14 && isValidCnpj(digits)) {
    return 'pj';
  }

  return 'pf';
}

export function isValidDocumentForCustomerType(input: {
  document: string | undefined;
  customerType: CustomerType;
}) {
  return input.customerType === 'pj'
    ? isValidCnpj(input.document)
    : isValidCpf(input.document);
}

export async function resolveVariantPrice(input: {
  storeId: string;
  customerType: CustomerType;
  variant: ProductVariant;
}): Promise<ResolvedVariantPrice> {
  const baseUnitPrice = getBaseVariantUnitPrice(input.variant);
  const priceList = await getDefaultPriceListFromRepository({
    storeId: input.storeId,
    customerType: input.customerType,
  });

  if (!priceList) {
    return {
      customerType: input.customerType,
      unitPrice: baseUnitPrice,
      baseUnitPrice,
      usedFallback: true,
    };
  }

  const variantPrice = await getVariantPriceFromRepository({
    storeId: input.storeId,
    variantId: input.variant.id,
    priceListId: priceList.id,
  });

  if (!variantPrice) {
    return {
      customerType: input.customerType,
      priceListId: priceList.id,
      priceListName: priceList.name,
      unitPrice: baseUnitPrice,
      baseUnitPrice,
      usedFallback: true,
    };
  }

  return {
    customerType: input.customerType,
    priceListId: priceList.id,
    priceListName: priceList.name,
    unitPrice: variantPrice.promotionalPrice ?? variantPrice.price,
    baseUnitPrice,
    usedFallback: false,
  };
}

export async function resolveCheckoutPricing(
  input: CheckoutPricingInput
): Promise<CheckoutPricingResult> {
  const items = await Promise.all(
    input.items.map(async (item) => {
      const product = await getProductById(input.storeId, item.productId);

      if (!product) {
        throw new Error('Product not found for checkout pricing.');
      }

      const variant = product.variants.find(
        (candidate) => candidate.id === item.variantId
      );

      if (!variant) {
        throw new Error('Product variant not found for checkout pricing.');
      }

      const resolvedPrice = await resolveVariantPrice({
        storeId: input.storeId,
        customerType: input.customerType,
        variant,
      });
      const unitPrice = roundCurrency(resolvedPrice.unitPrice);
      const total = roundCurrency(unitPrice * item.quantity);

      return {
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        sku: variant.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        total,
        priceListId: resolvedPrice.priceListId,
        priceListName: resolvedPrice.priceListName,
        customerType: resolvedPrice.customerType,
        usedFallbackPrice: resolvedPrice.usedFallback,
      };
    })
  );

  const storeId = items[0]?.storeId ?? input.storeId;

  if (items.some((item) => item.storeId !== storeId)) {
    throw new Error('Checkout contains products from different stores.');
  }

  const subtotal = roundCurrency(
    items.reduce((accumulator, item) => accumulator + item.total, 0)
  );
  const shippingTotal = calculateShippingTotal(subtotal);
  const discountTotal = 0;
  const firstPricedItem = items.find((item) => item.priceListId);

  return {
    customerType: input.customerType,
    priceListId: firstPricedItem?.priceListId,
    priceListName: firstPricedItem?.priceListName,
    items,
    subtotal,
    shippingTotal,
    discountTotal,
    total: roundCurrency(subtotal + shippingTotal - discountTotal),
  };
}

export async function listAdminVariantPriceSummaries(
  storeId: string
): Promise<AdminVariantPriceSummary[]> {
  return listAdminVariantPriceSummariesFromRepository(storeId);
}

export async function updateVariantBusinessPrice(
  input: UpdateVariantBusinessPriceInput
): Promise<AdminVariantPriceSummary | null> {
  return upsertVariantPriceForCustomerTypeInRepository({
    ...input,
    customerType: 'pj',
  });
}
