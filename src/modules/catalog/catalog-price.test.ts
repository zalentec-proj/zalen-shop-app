import { describe, expect, it } from 'vitest';
import { catalogUnitPrice, formatCatalogAmount } from './catalog-price';

describe('catalog price presentation', () => {
  it('uses the promotion without inventing a payment-method discount', () => {
    expect(catalogUnitPrice({ price: 100, promotionalPrice: 90 })).toBe(90);
    expect(catalogUnitPrice({ price: 100 })).toBe(100);
    expect(catalogUnitPrice({ price: 100, promotionalPrice: 0 })).toBe(0);
    expect(catalogUnitPrice()).toBe(0);
  });
  it('formats prices and installments with exactly two decimal places', () => {
    expect(formatCatalogAmount(399.99 / 12)).toBe('33,33');
    expect(formatCatalogAmount(1234.5)).toBe('1.234,50');
    expect(formatCatalogAmount(0)).toBe('0,00');
  });
});
