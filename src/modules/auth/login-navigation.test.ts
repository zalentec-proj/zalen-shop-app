import { describe, expect, it } from 'vitest';
import { getLoginRequestOrigin, getSafeLoginNextTarget } from './login-navigation';

const platform = 'https://app.zalenshop.com.br';
const store = 'https://brasil-drones.zalenshop.com.br';

describe('login navigation', () => {
  it.each([undefined, '/admin'])('keeps a neutral default pending authorization: %s', (next) => {
    expect(getSafeLoginNextTarget(next, platform)).toBe('/admin');
  });

  it('preserves the admin route, filters and copied drawer', () => {
    expect(getSafeLoginNextTarget('/admin/pedidos?q=Drone%20Mini&page=2&pedido=order-id#detalhes', platform))
      .toBe('/admin/pedidos?q=Drone%20Mini&page=2&pedido=order-id#detalhes');
  });

  it('preserves another canonical store instead of selecting the default store', () => {
    const destination = 'https://lb-london.zalenshop.com.br/admin/produtos?page=2';
    expect(getSafeLoginNextTarget(destination, platform)).toBe(destination);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://brasil-drones.lvh.me:3000', 'https://branch-preview.vercel.app', store])
    ('keeps same-origin admin navigation on %s', (origin) => {
      expect(getSafeLoginNextTarget('/admin/produtos?page=2', origin)).toBe('/admin/produtos?page=2');
    });

  it('supports a configured platform root without hardcoding the store hostname', () => {
    expect(getSafeLoginNextTarget('https://another-store.example.com/admin', 'https://app.example.com', 'example.com'))
      .toBe('https://another-store.example.com/admin');
  });

  it('keeps safe non-admin paths on the login origin', () => {
    expect(getSafeLoginNextTarget('/conta', platform)).toBe('/conta');
  });

  it.each([
    'https://evil.example/admin', '//evil.example/admin', '/\\evil.example/admin',
    '/%5Cevil.example/admin', '/\n/evil.example/admin', 'javascript:alert(1)',
    'https://app.zalenshop.com.br.evil.example/admin',
    'https://user:pass@app.zalenshop.com.br/admin',
    'http://app.zalenshop.com.br/admin', 'https://app.zalenshop.com.br:444/admin',
    'https://assets.zalenshop.com.br/admin', 'https://unknown.nested.zalenshop.com.br/admin',
    'https://lb-london.zalenshop.com.br/administer', 'https://lb-london.zalenshop.com.br/conta',
    'http://localhost:9000/admin', 'https://lb-london.lvh.me:3000/admin',
  ])('rejects unsafe next destinations: %s', (next) => {
    expect(getSafeLoginNextTarget(next, platform)).toBe('/admin');
  });

  it('accepts an absolute local admin path only on the current origin', () => {
    expect(getSafeLoginNextTarget('http://localhost:3000/admin', 'http://localhost:3000'))
      .toBe('http://localhost:3000/admin');
  });

  it.each(['/platform', '/platform/lojas?q=London', '/lojas', `${platform}/platform/lojas`])('accepts platform destinations pending role checks: %s', (next) => {
    expect(getSafeLoginNextTarget(next, store)).toBe(next);
  });

  it('does not accept platform paths on another store host', () => {
    expect(getSafeLoginNextTarget('https://lb-london.zalenshop.com.br/platform', platform)).toBe('/admin');
  });

  it('takes the public host rather than an internal forwarded deployment host', () => {
    const headers = new Headers({ host: 'app.zalenshop.com.br', 'x-forwarded-host': 'internal.vercel.app', 'x-forwarded-proto': 'https' });
    expect(getLoginRequestOrigin(headers, 'http://localhost:3000')).toBe(platform);
  });

  it('uses a configured origin only when the request has no host', () => {
    expect(getLoginRequestOrigin(new Headers(), platform)).toBe(platform);
  });
});
