import type { ProductStatus } from '@/modules/catalog/product.types';
import type {
  BlingProductDetail,
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

function getImageUrl(product: BlingProductDetail) {
  return (
    product.imagemURL ||
    product.midia?.imagens?.externas?.find((image) => image.link)?.link ||
    product.midia?.imagens?.internas?.find((image) => image.link)?.link ||
    product.midia?.imagens?.internas?.find((image) => image.linkMiniatura)
      ?.linkMiniatura
  );
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

  return {
    storeId: input.storeId,
    externalProvider: provider,
    externalId,
    name,
    slug: toSlug(name),
    description: input.product.descricaoCurta?.trim() || undefined,
    brand: input.product.marca?.trim() || undefined,
    status: toStatus(input.product.situacao),
    requiresShipping: true,
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
    imageUrl: getImageUrl(input.product),
    categoryWasClear,
    hasComplexVariations: false,
  };
}
