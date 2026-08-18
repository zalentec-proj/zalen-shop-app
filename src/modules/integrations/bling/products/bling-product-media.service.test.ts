import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicUrl, upload } = vi.hoisted(() => ({
  getPublicUrl: vi.fn((path: string) => ({
    data: {
      publicUrl: `https://project.supabase.co/storage/v1/object/public/product-images/${path}`,
    },
  })),
  upload: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createOptionalAdminClient: () => ({
    storage: {
      from: () => ({ getPublicUrl, upload }),
    },
  }),
}));

import {
  collectBlingProductImageUrls,
  resolveBlingProductMedia,
} from './bling-product-media.service';

describe('Bling product media service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects every unique product and variation image', () => {
    const urls = collectBlingProductImageUrls({
      id: 123,
      imagens: [
        { link: 'https://orgbling.s3.amazonaws.com/catalog/one.jpg?Expires=1' },
        { link: 'https://orgbling.s3.amazonaws.com/catalog/two.jpg?Expires=1' },
      ],
      midia: {
        imagens: {
          internas: [
            { link: 'https://orgbling.s3.amazonaws.com/catalog/one.jpg?Expires=1' },
          ],
        },
      },
      variacoes: [
        {
          id: 124,
          imagemURL: 'https://orgbling.s3.amazonaws.com/catalog/three.jpg?Expires=1',
        },
      ],
    });

    expect(urls).toHaveLength(3);
  });

  it('downloads internal Bling media and returns permanent Storage URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    );

    const result = await resolveBlingProductMedia({
      storeId: 'store-1',
      product: {
        id: 123,
        midia: {
          imagens: {
            internas: [
              { link: 'https://orgbling.s3.amazonaws.com/catalog/one?Expires=1' },
              { link: 'https://orgbling.s3.amazonaws.com/catalog/two?Expires=1' },
            ],
          },
        },
      },
      forceRefresh: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      imagesFound: 2,
      imagesCopied: 2,
      imageErrors: 0,
    });
    expect(result.urls).toHaveLength(2);
    expect(result.urls.every((url) => url.includes('/product-images/bling/'))).toBe(
      true
    );

    fetchMock.mockRestore();
  });

  it('never fetches signed media from a host outside Bling', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const result = await resolveBlingProductMedia({
      storeId: 'store-1',
      product: {
        id: 123,
        imagemURL: 'https://example.com/private.jpg?Expires=1&Signature=value',
      },
      forceRefresh: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.urls).toEqual([]);
    fetchMock.mockRestore();
  });
});
