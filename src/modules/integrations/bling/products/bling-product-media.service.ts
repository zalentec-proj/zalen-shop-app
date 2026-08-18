import 'server-only';

import { createHash } from 'node:crypto';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import { isRenderableCatalogImageUrl } from '@/modules/catalog/catalog-image-url';
import type {
  BlingProductDetail,
  BlingProductImageItem,
} from './bling-product.types';

const productImagesBucket = 'product-images';
const blingInternalMediaHostname = 'orgbling.s3.amazonaws.com';
const maxImageBytes = 10 * 1024 * 1024;
const imageFetchTimeoutMs = 15_000;

const extensionByContentType: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function normalizeSourceUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getImageItemUrl(image: BlingProductImageItem | undefined) {
  return [
    image?.link,
    image?.url,
    image?.imagemURL,
    image?.imageUrl,
    image?.linkMiniatura,
  ]
    .map(normalizeSourceUrl)
    .find(Boolean);
}

function getProductImageCandidates(product: BlingProductDetail) {
  return [
    product.imagemURL,
    product.imagemUrl,
    product.imageUrl,
    product.urlImagem,
    getImageItemUrl(product.imagem),
    ...(product.imagens ?? []).map(getImageItemUrl),
    ...(product.midia?.imagens?.externas ?? []).map(getImageItemUrl),
    ...(product.midia?.imagens?.internas ?? []).map(getImageItemUrl),
    ...(product.midia?.imagens?.imagens ?? []).map(getImageItemUrl),
  ];
}

export function collectBlingProductImageUrls(product: BlingProductDetail) {
  const uniqueUrls = new Map<string, string>();
  const candidates = [
    ...getProductImageCandidates(product),
    ...(product.variacoes ?? []).flatMap(getProductImageCandidates),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSourceUrl(candidate);

    if (!normalized) {
      continue;
    }

    const url = new URL(normalized);
    const identity =
      url.hostname === blingInternalMediaHostname
        ? `${url.origin}${url.pathname}`
        : url.toString();

    if (!uniqueUrls.has(identity)) {
      uniqueUrls.set(identity, normalized);
    }
  }

  return Array.from(uniqueUrls.values());
}

function parseInternalBlingMediaUrl(value: string) {
  try {
    const url = new URL(value);

    if (
      url.protocol !== 'https:' ||
      url.hostname !== blingInternalMediaHostname
    ) {
      return undefined;
    }

    return url;
  } catch {
    return undefined;
  }
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || 'unknown';
}

function createStorageObjectPath(input: {
  storeId: string;
  productId: string;
  sourceUrl: URL;
}) {
  const sourceIdentity = `${input.sourceUrl.origin}${input.sourceUrl.pathname}`;
  const sourceHash = createHash('sha256')
    .update(sourceIdentity)
    .digest('hex')
    .slice(0, 24);

  return `bling/${sanitizePathSegment(input.storeId)}/${sanitizePathSegment(
    input.productId
  )}/${sourceHash}`;
}

async function downloadImage(sourceUrl: URL) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), imageFetchTimeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error('bling_image_download_failed');
    }

    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase();
    const extension = contentType ? extensionByContentType[contentType] : undefined;

    if (!contentType || !extension) {
      throw new Error('bling_image_content_type_invalid');
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);

    if (Number.isFinite(contentLength) && contentLength > maxImageBytes) {
      throw new Error('bling_image_too_large');
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength === 0 || buffer.byteLength > maxImageBytes) {
      throw new Error('bling_image_size_invalid');
    }

    return { buffer, contentType, extension };
  } finally {
    clearTimeout(timeout);
  }
}

export interface ResolvedBlingProductMedia {
  urls: string[];
  imagesFound: number;
  imagesCopied: number;
  imageErrors: number;
}

export async function resolveBlingProductMedia(input: {
  storeId: string;
  product: BlingProductDetail;
  existingImageUrls?: string[];
  forceRefresh?: boolean;
}): Promise<ResolvedBlingProductMedia> {
  const sourceUrls = collectBlingProductImageUrls(input.product);
  const existingPermanentUrls = (input.existingImageUrls ?? []).filter(
    isRenderableCatalogImageUrl
  );
  const permanentSourceUrls = sourceUrls.filter(isRenderableCatalogImageUrl);
  const internalSourceUrls = sourceUrls
    .map(parseInternalBlingMediaUrl)
    .filter((url): url is URL => Boolean(url));

  if (
    !input.forceRefresh &&
    internalSourceUrls.length > 0 &&
    existingPermanentUrls.length >= internalSourceUrls.length
  ) {
    return {
      urls: Array.from(new Set([...permanentSourceUrls, ...existingPermanentUrls])),
      imagesFound: sourceUrls.length,
      imagesCopied: 0,
      imageErrors: 0,
    };
  }

  if (internalSourceUrls.length === 0) {
    return {
      urls: Array.from(new Set([...permanentSourceUrls, ...existingPermanentUrls])),
      imagesFound: sourceUrls.length,
      imagesCopied: 0,
      imageErrors: 0,
    };
  }

  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  const existingUrlSet = new Set(existingPermanentUrls);
  const copiedUrls: string[] = [];
  let imagesCopied = 0;
  let imageErrors = 0;

  for (const sourceUrl of internalSourceUrls) {
    const objectPathWithoutExtension = createStorageObjectPath({
      storeId: input.storeId,
      productId: String(input.product.id ?? 'unknown'),
      sourceUrl,
    });
    let resolvedUrl: string | undefined;

    for (const extension of Object.values(extensionByContentType)) {
      const candidatePath = `${objectPathWithoutExtension}.${extension}`;
      const { data } = supabase.storage
        .from(productImagesBucket)
        .getPublicUrl(candidatePath);

      if (data?.publicUrl && existingUrlSet.has(data.publicUrl)) {
        resolvedUrl = data.publicUrl;
        break;
      }
    }

    if (resolvedUrl) {
      copiedUrls.push(resolvedUrl);
      continue;
    }

    try {
      const image = await downloadImage(sourceUrl);
      const objectPath = `${objectPathWithoutExtension}.${image.extension}`;
      const { error: uploadError } = await supabase.storage
        .from(productImagesBucket)
        .upload(objectPath, image.buffer, {
          cacheControl: '31536000',
          contentType: image.contentType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error('bling_image_upload_failed');
      }

      const { data } = supabase.storage
        .from(productImagesBucket)
        .getPublicUrl(objectPath);

      if (!data?.publicUrl) {
        throw new Error('bling_image_public_url_missing');
      }

      copiedUrls.push(data.publicUrl);
      imagesCopied += 1;
    } catch {
      imageErrors += 1;
    }
  }

  return {
    urls: Array.from(
      new Set([...permanentSourceUrls, ...copiedUrls, ...existingPermanentUrls])
    ),
    imagesFound: sourceUrls.length,
    imagesCopied,
    imageErrors,
  };
}
