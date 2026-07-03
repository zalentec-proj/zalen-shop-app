import type { MetadataRoute } from 'next';
import { getCurrentOrigin } from '@/modules/seo/seo.service';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getCurrentOrigin();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api',
        '/login',
        '/conta',
        '/carrinho',
        '/pagamento',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
