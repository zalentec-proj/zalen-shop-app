import type { ProductVariant } from './product.types';

const amountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Presentation only. Checkout continues to resolve prices on the server. */
export function catalogUnitPrice(
  variant?: Pick<ProductVariant, 'price' | 'promotionalPrice'>
) {
  return variant?.promotionalPrice ?? variant?.price ?? 0;
}

export function formatCatalogAmount(amount: number) {
  return amountFormatter.format(amount);
}
