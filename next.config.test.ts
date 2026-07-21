import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('global security headers', () => {
  it('protects every route from framing, content sniffing and permissive browser APIs', async () => {
    const rules = await nextConfig.headers?.();
    const headers = Object.fromEntries(rules?.[0]?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(rules?.[0]?.source).toBe('/:path*');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).toContain(
      'connect-src \'self\' https://*.supabase.co https://api.mercadopago.com https://api-static.mercadopago.com https://secure-fields.mercadopago.com https://secure-fields-stg.mercadopago.com https://api.mercadolibre.com https://www.mercadolibre.com https://http2.mlstatic.com'
    );
    expect(headers['Content-Security-Policy']).toContain(
      'frame-src https://*.mercadopago.com https://www.mercadolibre.com'
    );
    expect(headers['Content-Security-Policy']).toContain(
      "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://http2.mlstatic.com"
    );
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe('Mercado Pago webhook routing', () => {
  it('keeps tenant context in the path for providers that strip query strings', async () => {
    const rules = await nextConfig.rewrites?.();

    expect(rules).toContainEqual({
      source:
        '/api/webhooks/mercado-pago/:store_id/:environment(test|production)',
      destination:
        '/api/webhooks/mercado-pago?store_id=:store_id&environment=:environment',
    });
  });
});
