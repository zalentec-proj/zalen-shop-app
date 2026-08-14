import type { NextConfig } from 'next';

export function buildContentSecurityPolicy(environment = process.env.NODE_ENV) {
  const developmentEval = environment === 'development' ? " 'unsafe-eval'" : '';

  return (
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://*.mercadopago.com; script-src 'self' 'unsafe-inline'" +
    developmentEval +
    " https://sdk.mercadopago.com https://http2.mlstatic.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://api-static.mercadopago.com https://secure-fields.mercadopago.com https://secure-fields-stg.mercadopago.com https://api.mercadolibre.com https://www.mercadolibre.com https://http2.mlstatic.com https://www.google-analytics.com https://graph.facebook.com; frame-src https://*.mercadopago.com https://www.mercadolibre.com"
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'brasil-drones.lvh.me'],
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source:
          '/api/webhooks/mercado-pago/:store_id/:environment(test|production)',
        destination:
          '/api/webhooks/mercado-pago?store_id=:store_id&environment=:environment',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
