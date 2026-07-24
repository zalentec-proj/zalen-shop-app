import 'server-only';

import { createHash } from 'node:crypto';
import { isValidCpf, isValidCnpj, onlyDigits } from '@/modules/customers/br-document';
import { getProductById } from '@/modules/catalog/product.service';
import type { ProductVariant } from '@/modules/catalog/product.types';
import {
  getDefaultPriceListFromRepository,
  getVariantPriceFromRepository,
  listAdminVariantPriceSummariesFromRepository,
  updateAutomaticPjDiscountPolicyInRepository,
  upsertVariantPriceForCustomerTypeInRepository,
} from './pricing.repository';
import type {
  AdminVariantPriceSummary,
  CheckoutPricingResult,
  CustomerType,
  PriceList,
  PromotionPolicy,
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

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateAutomaticPjUnitPrice(input: {
  regularPrice: number;
  promotionalPrice?: number;
  percentage: number;
  promotionPolicy: PromotionPolicy;
}) {
  const regularPrice = roundCurrency(input.regularPrice);
  const promotionalPrice =
    input.promotionalPrice === undefined
      ? undefined
      : roundCurrency(input.promotionalPrice);
  const catalogPrice = promotionalPrice ?? regularPrice;
  const percentage = Math.min(100, Math.max(0, input.percentage));
  const discountedRegularPrice = roundCurrency(
    regularPrice * (1 - percentage / 100)
  );

  if (input.promotionPolicy === 'stack' && promotionalPrice !== undefined) {
    return roundCurrency(promotionalPrice * (1 - percentage / 100));
  }

  if (
    input.promotionPolicy === 'promotion_only' &&
    promotionalPrice !== undefined
  ) {
    return promotionalPrice;
  }

  return Math.min(catalogPrice, discountedRegularPrice);
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
      discountPercentage: 0,
      productDiscountAmount: 0,
      priceSource: 'catalog',
      usedFallback: true,
    };
  }

  const variantPrice = await getVariantPriceFromRepository({
    storeId: input.storeId,
    variantId: input.variant.id,
    priceListId: priceList.id,
  });

  if (!variantPrice) {
    const shouldApplyAutomaticDiscount =
      input.customerType === 'pj' &&
      priceList.automaticDiscountEnabled &&
      priceList.automaticDiscountPercentage > 0;
    const automaticUnitPrice = shouldApplyAutomaticDiscount
      ? calculateAutomaticPjUnitPrice({
          regularPrice: input.variant.price,
          promotionalPrice: input.variant.promotionalPrice,
          percentage: priceList.automaticDiscountPercentage,
          promotionPolicy: priceList.promotionPolicy,
        })
      : baseUnitPrice;
    const unitPrice = Math.min(baseUnitPrice, automaticUnitPrice);
    const productDiscountAmount = roundCurrency(baseUnitPrice - unitPrice);

    return {
      customerType: input.customerType,
      priceListId: priceList.id,
      priceListName: priceList.name,
      unitPrice,
      baseUnitPrice,
      discountPercentage:
        productDiscountAmount > 0
          ? priceList.automaticDiscountPercentage
          : 0,
      productDiscountAmount,
      priceSource:
        productDiscountAmount > 0 ? 'automatic_discount' : 'catalog',
      usedFallback: !shouldApplyAutomaticDiscount,
    };
  }

  const unitPrice = Math.min(
    baseUnitPrice,
    variantPrice.promotionalPrice ?? variantPrice.price
  );
  const productDiscountAmount = roundCurrency(baseUnitPrice - unitPrice);
  const effectiveDiscountPercentage =
    baseUnitPrice > 0 && productDiscountAmount > 0
      ? roundCurrency((productDiscountAmount / baseUnitPrice) * 100)
      : 0;

  return {
    customerType: input.customerType,
    priceListId: priceList.id,
    priceListName: priceList.name,
    unitPrice,
    baseUnitPrice,
    discountPercentage: effectiveDiscountPercentage,
    productDiscountAmount,
    priceSource:
      productDiscountAmount > 0 ? 'variant_override' : 'catalog',
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
      const baseUnitPrice = roundCurrency(resolvedPrice.baseUnitPrice);
      const total = roundCurrency(unitPrice * item.quantity);
      const baseTotal = roundCurrency(baseUnitPrice * item.quantity);
      const productDiscountTotal = roundCurrency(baseTotal - total);

      return {
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        sku: variant.sku,
        name: product.name,
        quantity: item.quantity,
        baseUnitPrice,
        baseTotal,
        unitPrice,
        total,
        discountPercentage:
          productDiscountTotal > 0 ? resolvedPrice.discountPercentage : 0,
        productDiscountTotal,
        priceSource: resolvedPrice.priceSource,
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
  const catalogSubtotal = roundCurrency(
    items.reduce((accumulator, item) => accumulator + item.baseTotal, 0)
  );
  const productSavingsTotal = roundCurrency(
    items.reduce(
      (accumulator, item) => accumulator + item.productDiscountTotal,
      0
    )
  );
  const shippingTotal = 0;
  const discountTotal = 0;
  const firstPricedItem = items.find((item) => item.priceListId);
  const activePriceList = await getDefaultPriceListFromRepository({
    storeId: input.storeId,
    customerType: input.customerType,
  });
  const pricingFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        customerType: input.customerType,
        priceList: activePriceList
          ? {
              id: activePriceList.id,
              updatedAt: activePriceList.updatedAt,
              automaticDiscountEnabled:
                activePriceList.automaticDiscountEnabled,
              automaticDiscountPercentage:
                activePriceList.automaticDiscountPercentage,
              promotionPolicy: activePriceList.promotionPolicy,
            }
          : null,
        items: items.map((item) => ({
          variantId: item.variantId,
          baseUnitPrice: item.baseUnitPrice,
          unitPrice: item.unitPrice,
          priceSource: item.priceSource,
        })),
      })
    )
    .digest('hex');

  return {
    customerType: input.customerType,
    priceListId: firstPricedItem?.priceListId,
    priceListName: firstPricedItem?.priceListName,
    items,
    catalogSubtotal,
    subtotal,
    productSavingsTotal,
    shippingTotal,
    discountTotal,
    pricingFingerprint,
    total: roundCurrency(subtotal + shippingTotal - discountTotal),
  };
}

export async function getAutomaticPjDiscountPolicy(
  storeId: string
): Promise<PriceList | null> {
  return getDefaultPriceListFromRepository({
    storeId,
    customerType: 'pj',
  });
}

export async function updateAutomaticPjDiscountPolicy(input: {
  storeId: string;
  enabled: boolean;
  percentage: number;
}): Promise<PriceList | null> {
  if (
    !Number.isFinite(input.percentage) ||
    input.percentage < 0 ||
    input.percentage > 100 ||
    (input.enabled && input.percentage <= 0)
  ) {
    throw new Error('automatic_pj_discount_invalid');
  }

  return updateAutomaticPjDiscountPolicyInRepository(input);
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
