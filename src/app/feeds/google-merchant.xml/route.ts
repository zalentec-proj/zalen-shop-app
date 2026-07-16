import { NextResponse, type NextRequest } from 'next/server';
import { listStorefrontProducts } from '@/modules/catalog/product.service';
import { getStoreMarketingSettings } from '@/modules/marketing/marketing.service';
import { absoluteStoreUrl } from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  getCurrentStorefrontOrigin,
  resolveStoreFromRequest,
} from '@/modules/stores/store-resolution';

export const dynamic = 'force-dynamic';

function xml(value: string | number | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(origin: string, value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, origin).toString();
  } catch {
    return undefined;
  }
}

function getOrigin(request: NextRequest) {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https');

  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const resolution = await resolveStoreFromRequest(request);
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    return new NextResponse('Store not found.', { status: 404 });
  }

  const requestOrigin = getOrigin(request);
  const origin = await getCurrentStorefrontOrigin(store);

  if (new URL(requestOrigin).origin !== new URL(origin).origin) {
    return NextResponse.redirect(
      new URL('/feeds/google-merchant.xml', origin),
      308
    );
  }
  const [settings, products] = await Promise.all([
    getStoreMarketingSettings(store.id),
    listStorefrontProducts(store.id),
  ]);
  const merchantSettings = settings.google_merchant_center;

  const items = products.flatMap((product) => {
    if (product.status !== 'active') {
      return [];
    }

    const imageUrl = toAbsoluteUrl(origin, product.images[0]?.url);
    const link = absoluteStoreUrl(origin, `/produto/${product.slug}`);
    const description =
      product.description ?? product.seoDescription ?? product.name;

    return product.variants
      .map((variant) => {
        const price = variant.promotionalPrice ?? variant.price;

        if (!price || !imageUrl || !link) {
          return null;
        }

        const productType = product.categories
          .map((category) => category.name)
          .join(' > ');

        return `
          <item>
            <g:id>${xml(`${product.id}:${variant.id}`)}</g:id>
            <g:title>${xml(product.name)}</g:title>
            <g:description>${xml(description)}</g:description>
            <g:link>${xml(link)}</g:link>
            <g:image_link>${xml(imageUrl)}</g:image_link>
            <g:availability>${variant.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
            <g:price>${xml(price.toFixed(2))} BRL</g:price>
            <g:brand>${xml(product.brand ?? store.shortName)}</g:brand>
            <g:condition>new</g:condition>
            ${
              productType
                ? `<g:product_type>${xml(productType)}</g:product_type>`
                : ''
            }
            ${
              merchantSettings.defaultGoogleProductCategory
                ? `<g:google_product_category>${xml(
                    merchantSettings.defaultGoogleProductCategory
                  )}</g:google_product_category>`
                : ''
            }
          </item>
        `;
      })
      .filter((item): item is string => Boolean(item));
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(store.name)}</title>
    <link>${xml(absoluteStoreUrl(origin, '/'))}</link>
    <description>${xml(`${store.name} - catálogo para Google Merchant Center`)}</description>
    ${items.join('\n')}
  </channel>
</rss>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
