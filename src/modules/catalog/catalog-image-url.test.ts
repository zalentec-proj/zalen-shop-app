import { describe, expect, it } from 'vitest';
import {
  isRenderableCatalogImageUrl,
  isTemporaryBlingImageUrl,
} from './catalog-image-url';

describe('catalog image URLs', () => {
  it('rejects temporary signed Bling media URLs', () => {
    const url =
      'https://orgbling.s3.amazonaws.com/product/image?AWSAccessKeyId=key&Expires=1786989750&Signature=signed';

    expect(isTemporaryBlingImageUrl(url)).toBe(true);
    expect(isRenderableCatalogImageUrl(url)).toBe(false);
  });

  it('accepts permanent Supabase Storage URLs', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/product-images/catalog/product.webp';

    expect(isTemporaryBlingImageUrl(url)).toBe(false);
    expect(isRenderableCatalogImageUrl(url)).toBe(true);
  });

  it('accepts local fallback assets', () => {
    expect(isRenderableCatalogImageUrl('/_next/static/media/fallback.png')).toBe(
      true
    );
  });
});
