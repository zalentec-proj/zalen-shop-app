import type { ProductStatus } from '@/modules/catalog/product.types';
import { isTemporaryBlingImageUrl } from '@/modules/catalog/catalog-image-url';
import type {
  BlingProductDetail,
  BlingProductImageItem,
  BlingProductVariation,
  MappedBlingProduct,
} from './bling-product.types';

const provider = 'bling';

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNonNegativeNumber(value: number | string | null | undefined) {
  return Math.max(toNumber(value) ?? 0, 0);
}

function toStock(value: number | string | null | undefined) {
  return Math.max(Math.floor(toNumber(value) ?? 0), 0);
}

function toSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'produto';
}

function toStatus(situacao: string | number | boolean | undefined): ProductStatus {
  const normalized = String(situacao ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (['A', 'ATIVO', 'ACTIVE', 'S', 'SIM', 'TRUE', '1'].includes(normalized)) {
    return 'active';
  }

  if (['I', 'INATIVO', 'INACTIVE', 'N', 'NAO', 'FALSE', '0'].includes(normalized)) {
    return 'inactive';
  }

  return 'draft';
}

function toCentimeters(
  value: number | undefined,
  unidadeMedida: number | string | undefined
) {
  if (value === undefined) {
    return undefined;
  }

  if (unidadeMedida === 0 || unidadeMedida === '0') {
    return value * 100;
  }

  if (unidadeMedida === 2 || unidadeMedida === '2') {
    return value / 10;
  }

  return value;
}

function normalizeImageUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // Internal Bling media is returned as a signed S3 URL. It is only a
      // temporary preview and must not replace the permanent storefront
      // gallery, otherwise the image disappears when `Expires` is reached.
      if (isTemporaryBlingImageUrl(url.toString())) {
        return undefined;
      }

      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getImageItemUrl(image: BlingProductImageItem | undefined) {
  return (
    normalizeImageUrl(image?.link) ??
    normalizeImageUrl(image?.url) ??
    normalizeImageUrl(image?.imagemURL) ??
    normalizeImageUrl(image?.imageUrl) ??
    normalizeImageUrl(image?.linkMiniatura)
  );
}

function getFirstImageItemUrl(images: BlingProductImageItem[] | undefined) {
  for (const image of images ?? []) {
    const url = getImageItemUrl(image);

    if (url) {
      return url;
    }
  }

  return undefined;
}

function getImageUrl(product: BlingProductDetail) {
  return (
    normalizeImageUrl(product.imagemURL) ??
    normalizeImageUrl(product.imagemUrl) ??
    normalizeImageUrl(product.imageUrl) ??
    normalizeImageUrl(product.urlImagem) ??
    getImageItemUrl(product.imagem) ??
    getFirstImageItemUrl(product.imagens) ??
    getFirstImageItemUrl(product.midia?.imagens?.externas) ??
    getFirstImageItemUrl(product.midia?.imagens?.internas) ??
    getFirstImageItemUrl(product.midia?.imagens?.imagens)
  );
}

const htmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        const value = Number.parseInt(code.slice(2), 16);
        return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
          ? String.fromCodePoint(value)
          : entity;
      }

      if (code.startsWith('#')) {
        const value = Number.parseInt(code.slice(1), 10);
        return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
          ? String.fromCodePoint(value)
          : entity;
      }

      return htmlEntities[code.toLowerCase()] ?? entity;
    }
  );
}

export function normalizeBlingProductDescription(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const text = decodeHtmlEntities(
    trimmed
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|section|article|table|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return text || undefined;
}

function mapProductVariant(input: {
  product: BlingProductDetail | BlingProductVariation;
  fallbackProduct: BlingProductDetail;
  stockByProductId?: Map<string, number>;
}) {
  const externalId = String(input.product.id ?? input.fallbackProduct.id);
  const dimensions = input.product.dimensoes ?? input.fallbackProduct.dimensoes;
  const unidadeMedida = dimensions?.unidadeMedida;
  const width = toCentimeters(toNumber(dimensions?.largura), unidadeMedida);
  const height = toCentimeters(toNumber(dimensions?.altura), unidadeMedida);
  const depth = toCentimeters(toNumber(dimensions?.profundidade), unidadeMedida);
  const weight = toNumber(
    input.product.pesoBruto ??
      input.product.pesoLiquido ??
      input.fallbackProduct.pesoBruto ??
      input.fallbackProduct.pesoLiquido
  );
  const variationName =
    'variacao' in input.product ? input.product.variacao?.nome : undefined;
  const stock =
    input.stockByProductId?.get(externalId) ??
    toStock(input.product.estoque?.saldoVirtualTotal);

  const attributes: Record<string, string> | undefined = variationName
    ? { variacao: variationName }
    : undefined;

  return {
    externalId,
    sku: input.product.codigo?.trim() || input.fallbackProduct.codigo?.trim() || undefined,
    price: toNonNegativeNumber(input.product.preco ?? input.fallbackProduct.preco),
    stock,
    weight,
    width,
    height,
    depth,
    attributes,
  };
}

export function mapBlingProductToCatalogInput(input: {
  storeId: string;
  product: BlingProductDetail;
  categoryName?: string;
  stockByProductId?: Map<string, number>;
  resolvedImageUrls?: string[];
}): MappedBlingProduct {
  if (!input.product.id) {
    throw new Error('missing_bling_product_id');
  }

  const name = input.product.nome?.trim();

  if (!name) {
    throw new Error('missing_bling_product_name');
  }

  const externalId = String(input.product.id);
  const categoryId = input.product.categoria?.id;
  const categoryWasClear = Boolean(categoryId && input.categoryName);
  const variations = Array.isArray(input.product.variacoes)
    ? input.product.variacoes.filter((variation) => variation.id)
    : [];
  const mappedVariants =
    variations.length > 0
      ? variations.map((variation) =>
          mapProductVariant({
            product: variation,
            fallbackProduct: input.product,
            stockByProductId: input.stockByProductId,
          })
        )
      : [
          mapProductVariant({
            product: input.product,
            fallbackProduct: input.product,
            stockByProductId: input.stockByProductId,
          }),
        ];
  const imageUrls = Array.from(
    new Set(
      (input.resolvedImageUrls ?? [
        getImageUrl(input.product),
        ...variations.map((variation) => getImageUrl(variation)),
      ]).filter((url): url is string => Boolean(url))
    )
  );
  const imageUrl = imageUrls[0];

  return {
    storeId: input.storeId,
    externalProvider: provider,
    externalId,
    name,
    slug: toSlug(name),
    description: normalizeBlingProductDescription(input.product.descricaoCurta),
    brand: input.product.marca?.trim() || undefined,
    status: toStatus(input.product.situacao),
    requiresShipping: true,
    freeShipping: input.product.freteGratis === true,
    variant: {
      ...mappedVariants[0],
    },
    variants: mappedVariants,
    category:
      categoryWasClear && categoryId && input.categoryName
        ? {
            externalId: `${provider}:${categoryId}`,
            name: input.categoryName,
          }
        : undefined,
    imageUrl,
    imageUrls,
    categoryWasClear,
    hasComplexVariations: false,
  };
}
