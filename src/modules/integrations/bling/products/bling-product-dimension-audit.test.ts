import { describe, expect, it } from 'vitest';
import {
  BLING_DIMENSION_UNIT,
  auditBlingDimensions,
  toCentimeters,
} from './bling-product-dimension-audit';

describe('Bling product dimension audit', () => {
  it('keeps centimeters unchanged', () => {
    expect(
      auditBlingDimensions({
        largura: 12,
        altura: 7,
        profundidade: 16,
        unidadeMedida: BLING_DIMENSION_UNIT.CENTIMETERS,
      })
    ).toMatchObject({
      classification: 'safe',
      convertedToCentimeters: { width: 12, height: 7, depth: 16 },
    });
  });

  it('converts real meters to centimeters', () => {
    expect(toCentimeters(0.12, BLING_DIMENSION_UNIT.METERS)).toBe(12);
    expect(toCentimeters(0.07, BLING_DIMENSION_UNIT.METERS)).toBe(7);
    expect(toCentimeters(0.16, BLING_DIMENSION_UNIT.METERS)).toBe(16);
  });

  it('converts millimeters to centimeters', () => {
    expect(toCentimeters(120, BLING_DIMENSION_UNIT.MILLIMETERS)).toBe(12);
  });

  it('marks meter values that look like centimeters as ambiguous', () => {
    expect(
      auditBlingDimensions({
        largura: 12,
        altura: 7,
        profundidade: 16,
        unidadeMedida: BLING_DIMENSION_UNIT.METERS,
      })
    ).toMatchObject({
      classification: 'ambiguous',
      reason: 'meter_values_look_like_centimeters',
      convertedToCentimeters: { width: 1200, height: 700, depth: 1600 },
      suggested: { unit: BLING_DIMENSION_UNIT.CENTIMETERS, width: 12, height: 7, depth: 16 },
    });
  });

  it('blocks incomplete dimensions instead of inventing data', () => {
    expect(
      auditBlingDimensions({
        largura: 12,
        altura: 7,
        unidadeMedida: BLING_DIMENSION_UNIT.CENTIMETERS,
      })
    ).toMatchObject({ classification: 'blocked', reason: 'dimensions_missing' });
  });

  it('is idempotent for an already corrected centimeter entry', () => {
    const corrected = {
      largura: 12,
      altura: 7,
      profundidade: 16,
      unidadeMedida: BLING_DIMENSION_UNIT.CENTIMETERS,
    };

    expect(auditBlingDimensions(corrected)).toEqual(auditBlingDimensions(corrected));
  });
});
