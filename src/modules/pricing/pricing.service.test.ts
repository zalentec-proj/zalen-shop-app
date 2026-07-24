import { describe, expect, it } from 'vitest';
import { calculateAutomaticPjUnitPrice } from './pricing.service';

describe('automatic PJ pricing', () => {
  it('applies 10% to the regular product price', () => {
    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 100,
        percentage: 10,
        promotionPolicy: 'best_price',
      })
    ).toBe(90);
  });

  it('uses the best price without accumulating the promotion', () => {
    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 100,
        promotionalPrice: 95,
        percentage: 10,
        promotionPolicy: 'best_price',
      })
    ).toBe(90);

    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 100,
        promotionalPrice: 85,
        percentage: 10,
        promotionPolicy: 'best_price',
      })
    ).toBe(85);
  });

  it('rounds the final unit price before quantity multiplication', () => {
    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 19.99,
        percentage: 10,
        promotionPolicy: 'best_price',
      })
    ).toBe(17.99);
  });

  it('limits an invalid percentage to the safe zero-to-one-hundred range', () => {
    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 100,
        percentage: -10,
        promotionPolicy: 'best_price',
      })
    ).toBe(100);
    expect(
      calculateAutomaticPjUnitPrice({
        regularPrice: 100,
        percentage: 110,
        promotionPolicy: 'best_price',
      })
    ).toBe(0);
  });
});
