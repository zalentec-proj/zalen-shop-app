export const BLING_DIMENSION_UNIT = {
  METERS: 0,
  CENTIMETERS: 1,
  MILLIMETERS: 2,
} as const;

export type BlingDimensionUnit =
  (typeof BLING_DIMENSION_UNIT)[keyof typeof BLING_DIMENSION_UNIT];

export type BlingDimensions = {
  largura?: number | null;
  altura?: number | null;
  profundidade?: number | null;
  unidadeMedida?: number | string | null;
};

export type DimensionAuditClassification = 'safe' | 'ambiguous' | 'blocked';

export type DimensionAudit = {
  classification: DimensionAuditClassification;
  reason:
    | 'dimensions_valid'
    | 'dimensions_missing'
    | 'dimensions_invalid'
    | 'dimension_unit_unknown'
    | 'meter_values_look_like_centimeters';
  currentUnit?: BlingDimensionUnit;
  received?: { width: number; height: number; depth: number };
  convertedToCentimeters?: { width: number; height: number; depth: number };
  suggested?: {
    unit: typeof BLING_DIMENSION_UNIT.CENTIMETERS;
    width: number;
    height: number;
    depth: number;
  };
};

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBlingDimensionUnit(
  value: number | string | null | undefined
): BlingDimensionUnit | undefined {
  const parsed = toFiniteNumber(value);

  if (
    parsed === BLING_DIMENSION_UNIT.METERS ||
    parsed === BLING_DIMENSION_UNIT.CENTIMETERS ||
    parsed === BLING_DIMENSION_UNIT.MILLIMETERS
  ) {
    return parsed;
  }

  return undefined;
}

export function toCentimeters(
  value: number | string | null | undefined,
  unit: number | string | null | undefined
) {
  const numericValue = toFiniteNumber(value);
  const parsedUnit = parseBlingDimensionUnit(unit);

  if (numericValue === undefined || parsedUnit === undefined) return undefined;

  if (parsedUnit === BLING_DIMENSION_UNIT.METERS) {
    return roundDimension(numericValue * 100);
  }
  if (parsedUnit === BLING_DIMENSION_UNIT.MILLIMETERS) {
    return roundDimension(numericValue / 10);
  }
  return numericValue;
}

function roundDimension(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function looksLikeCentimeterEntry(values: [number, number, number]) {
  // This intentionally stays conservative: an integer-only entry such as
  // 12 x 7 x 16 with unit "meters" is suspicious, but never auto-corrected.
  return values.every(
    (value) => Number.isInteger(value) && value >= 1 && value <= 200
  );
}

export function auditBlingDimensions(dimensions?: BlingDimensions): DimensionAudit {
  const width = toFiniteNumber(dimensions?.largura);
  const height = toFiniteNumber(dimensions?.altura);
  const depth = toFiniteNumber(dimensions?.profundidade);
  const unit = parseBlingDimensionUnit(dimensions?.unidadeMedida);

  if (width === undefined || height === undefined || depth === undefined) {
    return { classification: 'blocked', reason: 'dimensions_missing' };
  }

  if (width <= 0 || height <= 0 || depth <= 0) {
    return { classification: 'blocked', reason: 'dimensions_invalid' };
  }

  if (unit === undefined) {
    return { classification: 'blocked', reason: 'dimension_unit_unknown' };
  }

  const received = { width, height, depth };
  const convertedToCentimeters = {
    width: toCentimeters(width, unit)!,
    height: toCentimeters(height, unit)!,
    depth: toCentimeters(depth, unit)!,
  };

  if (
    unit === BLING_DIMENSION_UNIT.METERS &&
    looksLikeCentimeterEntry([width, height, depth])
  ) {
    return {
      classification: 'ambiguous',
      reason: 'meter_values_look_like_centimeters',
      currentUnit: unit,
      received,
      convertedToCentimeters,
      suggested: {
        unit: BLING_DIMENSION_UNIT.CENTIMETERS,
        ...received,
      },
    };
  }

  return {
    classification: 'safe',
    reason: 'dimensions_valid',
    currentUnit: unit,
    received,
    convertedToCentimeters,
  };
}
